"""Explicit, read-only Gmail lookup and local application-thread associations."""
import fcntl
import importlib.util
from pathlib import Path
import re
import time
import todoctl

ROOT = Path(__file__).resolve().parent
_spec = importlib.util.spec_from_file_location('tracking_receiver', ROOT/'mail-trigger'/'receiver.py')
receiver = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(receiver)


def tracking_status(config):
    monitor = receiver.read_json(config['monitorFile'])
    details = monitor.get('threadBindings', {})
    return {task: {'threadId': thread, 'subject': details.get(task, {}).get('subject', ''),
                   'boundAt': details.get(task, {}).get('boundAt', ''),
                   'url': 'https://mail.google.com/mail/u/0/#all/'+thread}
            for task, thread in monitor.get('trackedThreads', {}).items()}


def application(config, task_id):
    task = next((t for t in todoctl.load_store(Path(config['store']))['tasks'] if t['id'] == task_id), None)
    if not task or task.get('cat') != '申请' or task.get('kind') == 'board' or task.get('archived'):
        raise ValueError('请选择未归档的具体申请。')
    source = Path(task.get('source') or '')
    if not source.is_absolute() or not source.is_file():
        raise ValueError('请先为申请设置有效的主记录文件，再关联邮件。')
    return task


def thread_summary(gmail, thread_id):
    if not re.fullmatch(r'[a-fA-F0-9]{8,32}', thread_id):
        raise ValueError('邮件会话 ID 无效。')
    thread = gmail.get('threads/'+thread_id, {'format': 'metadata', 'metadataHeaders': ['Subject','To','From','Date']})
    if thread.get('id') != thread_id:
        raise ValueError('邮件会话不匹配。')
    sent = [m for m in thread.get('messages', []) if 'SENT' in m.get('labelIds', [])]
    if not sent:
        raise ValueError('这个会话中没有已发送邮件，请选择实际投递的邮件。')
    message = max(sent, key=lambda m: int(m.get('internalDate', 0)))
    h = receiver.headers(message)
    return {'threadId': thread_id, 'subject': receiver.text_only(h.get('subject', '（无主题）'), 250),
            'to': receiver.text_only(h.get('to', ''), 350), 'date': receiver.text_only(h.get('date', ''), 100),
            'baselineMessageIds': [m['id'] for m in thread.get('messages', [])]}


def search_sent(config, gmail, task_id, query):
    application(config, task_id)
    query = query.strip()
    if len(query) < 2 or len(query) > 300:
        raise ValueError('请输入 2–300 字的收件邮箱或主题关键词。')
    data = gmail.get('threads', {'q': 'in:sent ('+query+')', 'maxResults': 10})
    results = []
    for item in data.get('threads', []):
        try:
            summary = thread_summary(gmail, item['id'])
        except ValueError:
            continue
        summary.pop('baselineMessageIds')
        results.append(summary)
    return results


def bind_thread(config, gmail, task_id, thread_id, expected_thread):
    task = application(config, task_id)
    summary = thread_summary(gmail, thread_id)
    path = Path(config['monitorFile'])
    with todoctl.locked_store(path):
        monitor = receiver.read_json(path)
        mapping = monitor.setdefault('trackedThreads', {})
        current = mapping.get(task_id, '')
        if current != expected_thread:
            raise ValueError('关联已在其他地方变化，请刷新后再试。')
        if any(other != task_id and thread == thread_id for other, thread in mapping.items()):
            raise ValueError('该邮件已关联另一项申请，请核对机构和岗位。')
        if current == thread_id:
            return
        metadata = {**summary, 'boundAt': receiver.stamp(), 'version': str(time.time_ns())}
        # Write canonical evidence before exposing the local association to the receiver.
        source = Path(task['source'])
        with source.open('r+', encoding='utf-8') as f:
            fcntl.flock(f.fileno(), fcntl.LOCK_EX)
            f.seek(0, 2)
            f.write('\n\n### 申请邮件关联（'+metadata['boundAt']+' · Europe/Paris）\n\n'
                    +task_id+' 由用户确认关联 Gmail 会话 '+thread_id+'。\n'
                    +'主题：'+summary['subject']+'；收件人：'+summary['to']+'。\n'
                    +'关联时已有邮件作为历史基线，不生成新进展提醒；关联不改变投递或回复状态。\n')
            f.flush()
        if current:
            monitor.setdefault('bindingHistory', []).append({'taskId': task_id, 'threadId': current,
                'replacedAt': metadata['boundAt'], 'metadata': monitor.get('threadBindings', {}).get(task_id, {})})
        mapping[task_id] = thread_id
        monitor.setdefault('threadBindings', {})[task_id] = metadata
        receiver.atomic_json(path, monitor)

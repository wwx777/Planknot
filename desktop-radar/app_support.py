#!/usr/bin/env python3
"""Local app preferences, sanitized receiver status and source-backed interview dates."""
import argparse
from datetime import datetime, timedelta, timezone
import hashlib
import json
from pathlib import Path
import re
import subprocess
import os
from zoneinfo import ZoneInfo
import todoctl

ROOT = Path(__file__).resolve().parent
DEFAULT_PREFS = ROOT / 'store' / 'preferences.json'
DEFAULTS = {'interviewReminders': False, 'reminderMinutes': 30, 'reminderOffsets': [4320, 30], 'displayTimezone': 'Europe/Paris', 'deadlineReminders': False, 'deadlineOffsets': [1440, 60], 'routineReminders': False}


def local_config() -> dict:
    """Local environment values; config.local.json is git-ignored, example is the fallback."""
    path = ROOT / 'config.local.json'
    if not path.exists():
        path = ROOT / 'config.example.json'
    try:
        value = json.loads(path.read_text())
        return value if isinstance(value, dict) else {}
    except (OSError, ValueError, json.JSONDecodeError):
        return {}


def service_label() -> str:
    return str(local_config().get('serviceLabel') or 'com.example.planknot.application-mail')


def preferences(path=DEFAULT_PREFS):
    value = {**DEFAULTS, **(json.loads(Path(path).read_text()) if Path(path).exists() else {})}
    if type(value['interviewReminders']) is not bool or type(value['reminderMinutes']) is not int or value['reminderMinutes'] not in (5, 15, 30, 60, 1440):
        raise ValueError('提醒设置无效')
    offsets = value['reminderOffsets']
    if not isinstance(offsets, list) or not offsets or any(type(n) is not int or n not in (5,15,30,60,1440,4320) for n in offsets) or len(set(offsets)) != len(offsets):
        raise ValueError('提醒时间组合无效')
    if any(type(value[k]) is not bool for k in ('deadlineReminders', 'routineReminders')) or value['deadlineOffsets'] != [1440, 60]:
        raise ValueError('DDL或日常提醒设置无效')
    ZoneInfo(value['displayTimezone'])
    return value


def interview_time(item):
    """Reject incomplete, nonexistent and ambiguous local times, never guess DST."""
    text = item.get('startsAt', '').strip()
    if not re.fullmatch(r'\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(?::\d{2})?(?:Z|[+-]\d{2}:\d{2})?', text):
        raise ValueError('请填写 YYYY-MM-DD HH:mm 或带偏移量的 ISO 时间')
    zone = ZoneInfo(item.get('timezone', ''))
    value = datetime.fromisoformat(text.replace('Z', '+00:00'))
    if value.tzinfo is not None:
        if value.utcoffset() != value.astimezone(zone).utcoffset() or value.replace(tzinfo=None) != value.astimezone(zone).replace(tzinfo=None):
            raise ValueError('时间偏移量与原时区不一致')
        return value.astimezone(zone)
    candidates = []
    for fold in (0, 1):
        zoned = value.replace(tzinfo=zone, fold=fold)
        if zoned.astimezone(timezone.utc).astimezone(zone).replace(tzinfo=None) == value:
            if not any(c.timestamp() == zoned.timestamp() for c in candidates):
                candidates.append(zoned)
    if len(candidates) != 1:
        raise ValueError('夏令时切换导致时间不存在或有歧义，请填写准确偏移量')
    return candidates[0]


def interview_calendar(tasks, prefs, now=None):
    now = now or datetime.now(timezone.utc)
    events, reminders, unscheduled = [], [], []
    for task in tasks:
        if task.get('archived'):
            continue
        for item in task.get('interviews', []):
            try:
                starts = interview_time(item)
            except (ValueError, KeyError) as exc:
                if item.get('status') not in ('已完成', '已取消') and not task.get('completed'):
                    unscheduled.append({'taskId': task['id'], 'round': item['round'], 'reason': str(exc)})
                continue
            local = starts.astimezone(ZoneInfo(prefs['displayTimezone']))
            ended = task.get('completed') or task.get('stage') in ('已结束', '未通过', '已撤回')
            event = {'taskId': task['id'], 'interviewId': item['id'], 'round': item['round'],
                     'day': local.strftime('%Y-%m-%d'), 'time': local.strftime('%H:%M'),
                     'originalTime': item['startsAt'], 'originalTimezone': item['timezone'],
                     'status': item['status'], 'meetingUrl': item.get('meetingUrl', ''),
                     'timestamp': starts.timestamp(), 'ended': bool(ended)}
            events.append(event)
            for minutes in prefs.get('reminderOffsets', [4320, 30]):
                # Subtract elapsed time in UTC, including across DST transitions.
                fire = starts.astimezone(timezone.utc) - timedelta(minutes=minutes)
                if item['status'] == '已安排' and not ended and fire > now:
                    identifier = hashlib.sha256((task['id']+'\0'+item['id']).encode()).hexdigest()[:24]
                    label = '提前三天' if minutes == 4320 else '提前半小时' if minutes == 30 else f'提前{minutes}分钟'
                    reminders.append({'id': 'interview.'+identifier+'.'+str(minutes), 'taskId': task['id'],
                        'title': label+' · '+task['title']+' · '+item['round'],
                        'body': f"{local:%m-%d %H:%M} {prefs['displayTimezone']}（原时间：{item['startsAt']} {item['timezone']}）",
                        'fireAt': fire.timestamp(), 'minutesBefore': minutes})
    events.sort(key=lambda e:e['timestamp']); reminders.sort(key=lambda e:e['fireAt'])
    return {'calendarEvents': events, 'reminders': reminders[:60], 'reminderOverflow': max(0,len(reminders)-60), 'unscheduled': unscheduled}


def task_reminders(tasks, prefs, now=None):
    """Only exact, source-backed deadlines; daily routine uses calendar recurrence."""
    now = now or datetime.now(timezone.utc)
    deadlines, skipped, routines = [], [], []
    for task in tasks:
        if task.get('completed') or task.get('archived') or task.get('kind') == 'board':
            continue
        if task['id'] == 'DAILY-INTERVIEW-PRACTICE':
            if prefs.get('routineReminders'):
                routines.append({'id': 'routine.daily-practice', 'taskId': task['id'],
                    'title': '八股与 coding 时间到了',
                    'body': '开始今晚的八股复习和 coding 练习。点击打开任务。',
                    'hour': 21, 'minute': 0, 'timezone': 'Europe/Paris'})
            continue
        text = task.get('due', '').strip()
        if not prefs.get('deadlineReminders') or not re.match(r'^\d{4}-\d{2}-\d{2}', text):
            continue
        # Goals, uncertain dates and multiple dates/ranges aren't official exact deadlines.
        if any(word in text for word in ('非官方', '用户目标', '待核实', '待确认', '未确认')):
            continue
        match = re.match(r'^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2})(?![\d:])', text)
        zone = re.search(r'(?<![\w/])([A-Za-z_]+/[A-Za-z_]+(?:/[A-Za-z_]+)?)(?![\w/])', text)
        if not match or not zone or re.search(r'[–—~～]|\d{4}-\d{2}-\d{2}', text[match.end():] if match else text):
            skipped.append({'taskId': task['id'], 'reason': '需要唯一且明确的截止时间与时区'})
            continue
        try:
            starts = interview_time({'startsAt': match[1]+' '+match[2], 'timezone': zone[1]})
        except (ValueError, KeyError):
            skipped.append({'taskId': task['id'], 'reason': '截止时间或时区需确认'})
            continue
        for minutes in prefs['deadlineOffsets']:
            fire = starts.astimezone(timezone.utc) - timedelta(minutes=minutes)
            if fire <= now:
                continue
            label = 'DDL 提前1天' if minutes == 1440 else 'DDL 提前1小时'
            identifier = hashlib.sha256(task['id'].encode()).hexdigest()[:24]
            deadlines.append({'id': 'deadline.'+identifier+'.'+str(minutes), 'taskId': task['id'],
                'title': label+' · '+task['title'], 'body': '截止：'+text,
                'fireAt': fire.timestamp(), 'minutesBefore': minutes})
    return {'deadlinePlan': sorted(deadlines, key=lambda r: r['fireAt']),
            'deadlineUnscheduled': skipped, 'routinePlan': routines}


def safe_json(path):
    try:
        return json.loads(Path(path).read_text())
    except (OSError, ValueError):
        return {}


def mail_status(root=ROOT):
    private = root / 'mail-trigger' / 'private'
    state = safe_json(private/'state.json')
    health = safe_json(private/'health.json')
    auth = safe_json(private/'authorization.json')
    config = safe_json(root/'mail-trigger'/'config.json')
    result = subprocess.run(['/bin/launchctl', 'print', f'gui/{os.getuid()}/{service_label()}'], capture_output=True, text=True, timeout=3)
    authorized = (private/'token.json').exists()
    watch_expiry = int(state.get('watchExpiration') or 0)/1000
    now = datetime.now(timezone.utc)
    running = 'state = running' in result.stdout
    error = state.get('lastError') or health.get('error')
    healthy = running and authorized and not error and watch_expiry > now.timestamp()
    return {'account': config.get('account','未配置'), 'authorized': authorized,
        'running': running, 'healthy': healthy, 'lastEventAt': state.get('lastNotificationAt'),
        'watchExpiresAt': datetime.fromtimestamp(watch_expiry,timezone.utc).isoformat() if watch_expiry else None,
        'lastError': error, 'pendingCount':len(state.get('pending',{})),
        'authorizationExpectedExpiresAt': auth.get('expectedExpiresAt'),
        'authorizationInProgress': auth_in_progress(private),
        'testing':True, 'modelInterpretation':False}


def auth_in_progress(private):
    import fcntl
    path=private/'authorization.lock'
    if not path.exists(): return False
    with path.open('a') as f:
        try: fcntl.flock(f,fcntl.LOCK_EX|fcntl.LOCK_NB)
        except BlockingIOError: return True
        return False


def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('command',choices=['status','save','search-mail','bind-mail'])
    p.add_argument('--store',type=Path,default=todoctl.DEFAULT_STORE)
    p.add_argument('--preferences',type=Path,default=DEFAULT_PREFS)
    p.add_argument('--enabled',choices=['true','false'])
    p.add_argument('--minutes',type=int,choices=[5,15,30,60,1440,4320])
    p.add_argument('--offsets', help='Comma-separated reminder minutes, e.g. 4320,30')
    p.add_argument('--task-id', default='')
    p.add_argument('--query', default='')
    p.add_argument('--thread-id', default='')
    p.add_argument('--expected-thread', default='')
    p.add_argument('--deadlines-enabled', choices=['true','false'])
    p.add_argument('--routine-enabled', choices=['true','false'])
    a=p.parse_args()
    prefs=preferences(a.preferences)
    if a.command=='save':
        if a.deadlines_enabled is not None:prefs['deadlineReminders']=a.deadlines_enabled=='true'
        if a.routine_enabled is not None:prefs['routineReminders']=a.routine_enabled=='true'
        if a.enabled is not None:prefs['interviewReminders']=a.enabled=='true'
        if a.minutes is not None:
            prefs['reminderMinutes']=a.minutes
            prefs['reminderOffsets']=[a.minutes]
        if a.offsets is not None:
            offsets=[int(n) for n in a.offsets.split(',')]
            if not offsets or len(set(offsets)) != len(offsets) or any(n not in (5,15,30,60,1440,4320) for n in offsets):
                raise ValueError('提醒时间组合无效')
            prefs['reminderOffsets']=offsets
        with todoctl.locked_store(a.preferences):
            # Preferences are separate from the task store; never edit tasks.json.
            a.preferences.parent.mkdir(parents=True,exist_ok=True)
            temp=a.preferences.with_suffix('.next')
            temp.write_text(json.dumps(prefs,ensure_ascii=False,indent=2)+'\n');temp.replace(a.preferences)
    import mail_tracking
    config = safe_json(ROOT/'mail-trigger'/'config.json')
    operation = {'mailOperationTask': a.task_id} if a.command in ('search-mail','bind-mail') else {}
    if a.command in ('search-mail','bind-mail'):
        try:
            mail_tracking.require_receiver()
            gmail = mail_tracking.receiver.Gmail(mail_tracking.receiver.credentials(config))
            if a.command == 'search-mail':
                operation['mailSearch'] = mail_tracking.search_sent(config, gmail, a.task_id, a.query)
            else:
                mail_tracking.bind_thread(config, gmail, a.task_id, a.thread_id, a.expected_thread)
                operation['mailBound'] = a.task_id
        except ValueError as exc:
            operation['mailOperationError'] = str(exc)
        except Exception:
            operation['mailOperationError'] = '无法连接 Gmail，请检查网络与邮箱授权后重试。'
    tasks=todoctl.load_store(a.store)['tasks']
    print(json.dumps({'preferences':prefs,'mail':mail_status(),'mailTracking':mail_tracking.tracking_status(config),**operation,**interview_calendar(tasks,prefs),**task_reminders(tasks,prefs)},ensure_ascii=False))

if __name__=='__main__':main()

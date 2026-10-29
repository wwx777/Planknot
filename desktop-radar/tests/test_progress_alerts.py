"""Exercise event retry, exact acknowledgement and concurrent writers in isolated stores."""
import concurrent.futures
import json
from pathlib import Path
import subprocess
import tempfile
import unittest

CLI = Path(__file__).resolve().parents[1] / 'todoctl.py'

class ProgressAlerts(unittest.TestCase):
    def setUp(self):
        # Keep generated fixtures for diagnosis; never mutate the real task store.
        self.store = Path(tempfile.mkdtemp(prefix='todo-alert-test-')) / 'tasks.json'
        self.store.write_text(json.dumps({'schemaVersion': 1, 'revision': 0, 'tasks': [
            {'id': 'TEST', 'title': '演示事项（隔离测试）', 'lane': '等待外部',
             'completed': False, 'cat': '工具', 'due': '未设置', 'risk': '',
             'project': 'BOARD', 'stage': '已投递', 'reply': '等待回复'},
            {'id': 'BOARD', 'title': '演示板块', 'kind': 'board', 'lane': '进行中',
             'completed': False}
        ]}))

    def call(self, *args, ok=True):
        result = subprocess.run(['python3', str(CLI), '--store', str(self.store), *args], capture_output=True, text=True)
        self.assertEqual(result.returncode, 0 if ok else 1, result.stderr)
        return json.loads(result.stdout if ok else result.stderr)

    def notify(self, event):
        return self.call('notify', 'TEST', '--event-id', event, '--title', '演示更新',
                         '--text', '仅为隔离测试', '--source', '/tmp/isolated-evidence.md')

    def test_retry_after_ack_never_reopens(self):
        first = self.notify('gmail-message-1')
        self.call('ack', first['alert']['id'])
        duplicate = self.notify('gmail-message-1')
        self.assertTrue(duplicate['duplicate'])
        self.assertEqual(duplicate['revision'], 2)
        self.assertEqual(self.call('alerts')['alerts'], [])
        self.assertEqual(len(self.call('alerts', '--all')['alerts']), 1)

    def test_ack_snapshot_preserves_new_arrival(self):
        first = self.notify('message-1')['alert']['id']
        second = self.notify('message-2')['alert']['id']
        self.call('ack', first)
        self.assertEqual([a['id'] for a in self.call('alerts')['alerts']], [second])
        self.assertEqual(self.call('ack', first)['revision'], 3)

    def test_concurrent_delivery_is_deduplicated_and_lossless(self):
        events = ['same'] * 4 + ['other-1', 'other-2']
        with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
            list(pool.map(self.notify, events))
        data = json.loads(self.store.read_text())
        self.assertEqual(len(data['alerts']), 3)
        self.assertEqual(data['revision'], 3)
        self.assertEqual(data['tasks'][0]['stage'], '已投递')
        self.assertEqual(data['tasks'][0]['project'], 'BOARD')

    def test_invalid_alert_and_unknown_ack_do_not_write(self):
        original = self.store.read_bytes()
        self.call('notify', 'MISSING', '--event-id', 'm1', '--title', '标题', '--text', '正文', '--source', '/tmp/source', ok=False)
        self.call('notify', 'TEST', '--event-id', 'm1', '--title', ' ', '--text', '正文', '--source', '/tmp/source', ok=False)
        self.call('ack', 'not-an-alert', ok=False)
        self.assertEqual(self.store.read_bytes(), original)

    def test_ordinary_edit_does_not_create_alert(self):
        self.call('update', 'TEST', '--detail', '查收未见回复')
        self.assertEqual(self.call('alerts')['alerts'], [])
        self.assertTrue(self.call('validate')['ok'])

if __name__ == '__main__':
    unittest.main()

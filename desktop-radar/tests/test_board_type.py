"""DIY project boards: boardType field drives application tracking."""
import json
from pathlib import Path
import subprocess
import tempfile
import unittest

CLI = Path(__file__).resolve().parents[1] / 'todoctl.py'


class BoardType(unittest.TestCase):
    def setUp(self):
        self.store = Path(tempfile.mkdtemp(prefix='todo-boardtype-test-')) / 'tasks.json'
        self.store.write_text(json.dumps({'schemaVersion': 1, 'revision': 0, 'tasks': []}))

    def call(self, *args, ok=True):
        p = subprocess.run(['python3', str(CLI), '--store', str(self.store), *args],
                           capture_output=True, text=True)
        self.assertEqual(p.returncode, 0 if ok else 1, p.stderr)
        return json.loads(p.stdout if ok else p.stderr)

    def test_application_board_roundtrips(self):
        board = self.call('add', '--id', 'MY-APPS', '--title', '我的申请', '--category', '申请',
                          '--lane', '进行中', '--kind', 'board', '--board-type', 'application')['task']
        self.assertEqual(board['boardType'], 'application')
        self.assertEqual(self.call('update', 'MY-APPS', '--board-type', 'project')['task']['boardType'], 'project')

    def test_board_type_rejected_on_plain_task(self):
        self.call('add', '--id', 'X', '--title', '普通事项', '--board-type', 'application', ok=False)

    def test_invalid_board_type_rejected(self):
        p = subprocess.run(['python3', str(CLI), '--store', str(self.store), 'add',
                            '--id', 'B', '--title', '板块', '--kind', 'board',
                            '--board-type', 'nonsense'], capture_output=True, text=True)
        self.assertNotEqual(p.returncode, 0)
        self.assertIn('invalid choice', p.stderr)

    def test_default_board_has_no_board_type(self):
        board = self.call('add', '--id', 'G', '--title', '通用板块', '--kind', 'board')['task']
        self.assertNotIn('boardType', board)

"""Multi-round interview persistence and atomic validation in isolated stores."""
import json
from pathlib import Path
import subprocess
import tempfile
import unittest

CLI = Path(__file__).resolve().parents[1] / 'todoctl.py'

class Interviews(unittest.TestCase):
    def setUp(self):
        self.store = Path(tempfile.mkdtemp(prefix='todo-interview-test-')) / 'tasks.json'
        self.store.write_text(json.dumps({'schemaVersion': 1, 'revision': 0, 'tasks': [
            {'id':'BOARD','title':'隔离板块','kind':'board','lane':'进行中','completed':False}]}))
        self.rounds = [dict(id=f'r{i}',round=label,status=status,startsAt=time,timezone=zone,
            meetingUrl=url,location='会议号 123（隔离示例）',notes='仅测试') for i,label,status,time,zone,url in [
            (1,'一面','已完成','2026-10-20 14:00','Asia/Shanghai','https://meeting.tencent.com/example'),
            (2,'二面','已安排','2026-10-30 16:00','Asia/Shanghai','https://example.org/meeting'),
            (3,'三面','待安排','','','')]]

    def call(self,*args,ok=True):
        p=subprocess.run(['python3',str(CLI),'--store',str(self.store),*args],capture_output=True,text=True)
        self.assertEqual(p.returncode,0 if ok else 1,p.stderr)
        return json.loads(p.stdout if ok else p.stderr)

    def add(self):
        return self.call('add','--id','TEST','--title','隔离面试测试','--project','BOARD',
            '--stage','面试中','--interviews-json',json.dumps(self.rounds))['task']

    def test_rounds_survive_edit_complete_reopen_and_ending(self):
        self.assertEqual(self.add()['interviews'],self.rounds)
        self.call('update','TEST','--detail','与面试无关的编辑')
        self.call('complete','TEST'); self.call('reopen','TEST')
        t=self.call('update','TEST','--stage','已结束','--end-reason','隔离示例结束',
            '--ended-at','2026-10-31 · Europe/Paris')['task']
        self.assertEqual(t['interviews'],self.rounds)
        self.assertEqual(t['endReason'],'隔离示例结束')
        self.assertEqual(self.call('alerts')['alerts'],[])

    def test_cancel_reschedule_clear_link_retains_history(self):
        self.add()
        self.rounds[1].update(status='已取消',meetingUrl='',notes='保留取消原因')
        self.call('update','TEST','--interviews-json',json.dumps(self.rounds))
        before=json.loads(next((self.store.parent/'history').glob('tasks-r000001-*')).read_text())
        self.assertEqual(before['tasks'][1]['interviews'][1]['status'],'已安排')
        t=self.call('list','--project','BOARD','--json')['tasks'][0]
        self.assertEqual(t['interviews'][1]['status'],'已取消')
        self.assertEqual(len(t['interviews']),3)

    def test_invalid_round_is_atomic(self):
        self.add(); original=self.store.read_bytes()
        for key,value in [('meetingUrl','javascript:alert(1)'),('meetingUrl','https://user:pass@example.org'),
                          ('timezone',''),('status','Offer'),('id','r1')]:
            rounds=json.loads(json.dumps(self.rounds)); rounds[1][key]=value
            self.call('update','TEST','--interviews-json',json.dumps(rounds),ok=False)
            self.assertEqual(self.store.read_bytes(),original)
        self.call('update','TEST','--interviews-json','{}',ok=False)
        self.assertEqual(self.store.read_bytes(),original)

if __name__=='__main__': unittest.main()

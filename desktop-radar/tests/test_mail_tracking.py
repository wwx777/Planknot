"""Association tests use isolated source/monitor/store fixtures, never live Gmail."""
import json
from pathlib import Path
import sys
import tempfile
import unittest
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import mail_tracking as tracking
import test_mail_receiver as receiver_tests

THREAD='1a16f085eca041d7'
OTHER='1a16f181b0dd7f1c'

class Gmail:
    def __init__(self):
        self.calls=[]
        self.threads={THREAD:{'id':THREAD,'messages':[{'id':'sent','labelIds':['SENT'],'internalDate':'100',
            'payload':{'headers':[{'name':'Subject','value':'Application'},{'name':'To','value':'hr@example.com'}]}},
            {'id':'old-reply','labelIds':['INBOX'],'internalDate':'200'}]}}
    def get(self,path,params):
        self.calls.append((path,params))
        if path=='threads':return {'threads':[{'id':THREAD}]}
        return self.threads[path.split('/')[1]]

class MailTracking(unittest.TestCase):
    def setUp(self):
        self.root=Path(tempfile.mkdtemp(prefix='mail-binding-test-'))
        source=self.root/'source.md';source.write_text('# isolated\n')
        store=self.root/'tasks.json';store.write_text(json.dumps({'schemaVersion':1,'revision':0,'tasks':[
            {'id':'APP','title':'Isolated application','cat':'申请','lane':'等待外部','source':str(source),'completed':False}]}))
        monitor=self.root/'monitor.json';monitor.write_text(json.dumps({'trackedThreads':{},'unrelated':'preserved'}))
        self.config={'store':str(store),'monitorFile':str(monitor)};self.gmail=Gmail()
    def test_lookup_fetches_metadata_and_search_is_sent_scoped(self):
        results=tracking.search_sent(self.config,self.gmail,'APP','hr@example.com')
        self.assertEqual(results[0]['to'],'hr@example.com')
        self.assertNotIn('baselineMessageIds',results[0])
        self.assertTrue(self.gmail.calls[0][1]['q'].startswith('in:sent ('))
        self.assertEqual(self.gmail.calls[1][1]['format'],'metadata')
    def test_bind_preserves_store_and_baselines_existing_mail(self):
        before=Path(self.config['store']).read_bytes()
        tracking.bind_thread(self.config,self.gmail,'APP',THREAD,'')
        monitor=json.loads(Path(self.config['monitorFile']).read_text())
        self.assertEqual(monitor['unrelated'],'preserved')
        self.assertEqual(monitor['trackedThreads']['APP'],THREAD)
        self.assertEqual(monitor['threadBindings']['APP']['baselineMessageIds'],['sent','old-reply'])
        self.assertEqual(Path(self.config['store']).read_bytes(),before)
        self.assertEqual(tracking.tracking_status(self.config)['APP']['subject'],'Application')
    def test_conflicting_or_duplicate_thread_does_not_rewrite(self):
        path=Path(self.config['monitorFile']);path.write_text(json.dumps({'trackedThreads':{'OTHER':THREAD}}));before=path.read_bytes()
        with self.assertRaisesRegex(ValueError,'另一项'):tracking.bind_thread(self.config,self.gmail,'APP',THREAD,'')
        self.assertEqual(path.read_bytes(),before)
        with self.assertRaisesRegex(ValueError,'变化'):tracking.bind_thread(self.config,self.gmail,'APP',THREAD,OTHER)
    def test_non_sent_thread_rejected_and_existing_binding_retained(self):
        self.gmail.threads[THREAD]['messages']=[]
        with self.assertRaisesRegex(ValueError,'没有已发送'):tracking.bind_thread(self.config,self.gmail,'APP',THREAD,'')
        self.assertEqual(tracking.tracking_status(self.config),{})
    def test_replacement_keeps_history(self):
        tracking.bind_thread(self.config,self.gmail,'APP',THREAD,'')
        self.gmail.threads[OTHER]={**self.gmail.threads[THREAD],'id':OTHER}
        tracking.bind_thread(self.config,self.gmail,'APP',OTHER,THREAD)
        monitor=json.loads(Path(self.config['monitorFile']).read_text())
        self.assertEqual(monitor['trackedThreads']['APP'],OTHER)
        self.assertEqual(monitor['bindingHistory'][0]['threadId'],THREAD)
    def test_recovery_skips_baseline_then_delivers_once_without_polling(self):
        harness=receiver_tests.MailReceiver();harness.setUp()
        change=harness.message('fresh')
        monitor=Path(harness.config['monitorFile'])
        monitor.write_text(json.dumps({'trackedThreads':{'APP':'thread1'},'threadBindings':{'APP':{
            'version':'new','baselineMessageIds':['historical']}}}))
        original=harness.gmail.get
        requests=[]
        def get(path,params):
            requests.append(path)
            if path=='threads/thread1':return {'messages':[{'id':'historical'},{'id':'fresh'}]}
            return original(path,params)
        harness.gmail.get=get
        harness.r.recover_bindings();harness.r.recover_bindings()
        self.assertEqual(requests,['threads/thread1','messages/fresh'])
        self.assertEqual(harness.r.state['processed'],['fresh'])
        self.assertEqual(harness.r.state['recoveredBindings']['APP'],'new')

if __name__=='__main__':unittest.main()

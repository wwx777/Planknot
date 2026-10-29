"""Timezone, scheduling and sanitized settings tests without real notifications."""
import importlib.util
from pathlib import Path
import json
import sys
import tempfile
import unittest
from datetime import datetime, timezone
from unittest.mock import patch

RADAR=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(RADAR))
spec=importlib.util.spec_from_file_location('app_support',RADAR/'app_support.py')
support=importlib.util.module_from_spec(spec);spec.loader.exec_module(support)

class AppSupport(unittest.TestCase):
    def setUp(self):
        self.prefs=dict(support.DEFAULTS)
        self.now=datetime(2026,10,25,0,0,tzinfo=timezone.utc)
        self.round={'id':'round1','round':'二面','status':'已安排','startsAt':'2026-10-30 00:30',
                    'timezone':'Asia/Shanghai','meetingUrl':'https://meeting.tencent.com/example'}
        self.task={'id':'APP','title':'隔离申请','completed':False,'stage':'面试中','interviews':[self.round]}

    def plan(self):
        return support.interview_calendar([self.task],self.prefs,self.now)

    def test_original_time_converts_to_previous_paris_day(self):
        d=self.plan();event=d['calendarEvents'][0]
        self.assertEqual((event['day'],event['time']),('2026-10-29','17:30'))
        self.assertEqual(event['originalTime'],'2026-10-30 00:30')
        self.assertEqual([r['minutesBefore'] for r in d['reminders']],[4320,30])
        self.assertEqual(d['reminders'][1]['fireAt'],datetime(2026,10,29,16,0,tzinfo=timezone.utc).timestamp())
        self.assertNotEqual(d['reminders'][0]['id'],d['reminders'][1]['id'])

    def test_dst_gap_and_fold_are_not_guessed(self):
        self.round['timezone']='Europe/Paris'
        for text in ('2026-03-29 02:30','2026-10-25 02:30','2026-02-30 10:00'):
            self.round['startsAt']=text
            self.assertEqual(self.plan()['reminders'],[])
            self.assertEqual(len(self.plan()['unscheduled']),1)
        self.round['startsAt']='2026-10-25T02:30:00+02:00';a=support.interview_time(self.round)
        self.round['startsAt']='2026-10-25T02:30:00+01:00';b=support.interview_time(self.round)
        self.assertEqual(b.timestamp()-a.timestamp(),3600)
        self.round['startsAt']='2026-10-25T02:30:00+08:00'
        self.assertEqual(self.plan()['reminders'],[])

    def test_reschedule_replaces_same_id_and_cancellation_removes_plan(self):
        before=self.plan()['reminders'][0]
        self.round['startsAt']='2026-10-31 10:00';after=self.plan()['reminders'][0]
        self.assertEqual(before['id'],after['id']);self.assertNotEqual(before['fireAt'],after['fireAt'])
        for status in ('已取消','已完成','待安排'):
            self.round['status']=status;self.assertEqual(self.plan()['reminders'],[])
            self.assertEqual(len(self.plan()['calendarEvents']),1)
        self.round['status']='已安排';self.task['stage']='已结束'
        self.assertEqual(self.plan()['reminders'],[])
        self.task['archived']=True;self.assertEqual(self.plan()['calendarEvents'],[])

    def test_unknown_dates_and_past_reminders_are_not_scheduled(self):
        for text in ('','下周二下午','2026-10-30'):
            self.round['startsAt']=text
            self.assertEqual(self.plan()['reminders'],[])
            self.assertEqual(len(self.plan()['unscheduled']),1)
        self.round['startsAt']='2026-10-01 10:00'
        self.assertEqual(self.plan()['reminders'],[])

    def test_late_booking_keeps_only_future_reminder(self):
        self.now=datetime(2026,10,29,15,0,tzinfo=timezone.utc)
        self.assertEqual([r['minutesBefore'] for r in self.plan()['reminders']],[30])
        self.now=datetime(2026,10,29,16,15,tzinfo=timezone.utc)
        self.assertEqual(self.plan()['reminders'],[])

    def test_three_days_is_elapsed_time_across_dst(self):
        self.round.update(timezone='Europe/Paris',startsAt='2026-10-26 10:00')
        self.now=datetime(2026,10,20,tzinfo=timezone.utc)
        starts=support.interview_time(self.round).timestamp()
        self.assertEqual(starts-self.plan()['reminders'][0]['fireAt'],72*3600)

    def test_deadline_alerts_use_source_timezone_and_cancel_with_task(self):
        self.prefs['deadlineReminders']=True
        task={'id':'DDL','title':'截止测试','due':'2026-11-01 23:59 CET · Europe/Paris','completed':False}
        plan=support.task_reminders([task],self.prefs,self.now)['deadlinePlan']
        self.assertEqual(len(plan),2)
        self.assertEqual(plan[0]['fireAt'],datetime(2026,10,31,22,59,tzinfo=timezone.utc).timestamp())
        self.assertEqual(plan[1]['fireAt'],datetime(2026,11,1,21,59,tzinfo=timezone.utc).timestamp())
        task['due']='2026-11-02 23:59 · Europe/Paris'
        changed=support.task_reminders([task],self.prefs,self.now)['deadlinePlan']
        self.assertEqual(plan[0]['id'],changed[0]['id'])
        self.assertNotEqual(plan[0]['fireAt'],changed[0]['fireAt'])
        task['completed']=True
        self.assertEqual(support.task_reminders([task],self.prefs,self.now)['deadlinePlan'],[])

    def test_no_guessed_deadline_times_or_prose_dates(self):
        self.prefs['deadlineReminders']=True
        for due in ('2026-11-10 · Europe/Paris','2026-12-16 / 17 09:00–12:00 · Europe/Paris',
                    '2026-11-01 23:59','2026-11-01 23:59 · Europe/Paris（用户目标，非官方DDL）',
                    '证明有效期2027-01-10', '2026-11-01 09:00–12:00 · Europe/Paris'):
            task={'id':'D','title':'测试','due':due}
            self.assertEqual(support.task_reminders([task],self.prefs,self.now)['deadlinePlan'],[])

    def test_routine_is_a_single_daily_calendar_rule_and_respects_active_state(self):
        task={'id':'DAILY-INTERVIEW-PRACTICE','title':'练习'}
        self.assertEqual(support.task_reminders([task],self.prefs,self.now)['routinePlan'],[])
        self.prefs['routineReminders']=True
        plan=support.task_reminders([task],self.prefs,self.now)['routinePlan']
        self.assertEqual(len(plan),1)
        self.assertEqual((plan[0]['hour'],plan[0]['minute'],plan[0]['timezone']),(21,0,'Europe/Paris'))
        task['archived']=True
        self.assertEqual(support.task_reminders([task],self.prefs,self.now)['routinePlan'],[])

    def test_status_does_not_return_credentials_or_confuse_saved_token_with_online(self):
        root=Path(tempfile.mkdtemp(prefix='todo-settings-test-'))
        private=root/'mail-trigger/private';private.mkdir(parents=True)
        (private/'token.json').write_text(json.dumps({'token':'SENSITIVE_TOKEN'}))
        (private/'state.json').write_text(json.dumps({'watchExpiration':'2000000000000'}))
        class Stopped:stdout='state = waiting'
        with patch.object(support.subprocess,'run',return_value=Stopped()):d=support.mail_status(root)
        self.assertTrue(d['authorized']);self.assertFalse(d['healthy']);self.assertFalse(d['running'])
        self.assertNotIn('SENSITIVE_TOKEN',json.dumps(d))
        self.assertIsNone(d['authorizationExpectedExpiresAt'])

if __name__=='__main__':unittest.main()

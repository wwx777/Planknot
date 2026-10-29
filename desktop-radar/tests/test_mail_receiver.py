"""Isolated inbox events: no live Gmail, source records or production board writes."""
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

RADAR = Path(__file__).resolve().parents[1]
if not (RADAR / 'mail-trigger/receiver.py').exists():
    raise unittest.SkipTest('Optional local mail receiver is not installed')
spec = importlib.util.spec_from_file_location("receiver", RADAR / "mail-trigger" / "receiver.py")
receiver = importlib.util.module_from_spec(spec)
spec.loader.exec_module(receiver)


class FakeGmail:
    def __init__(self):
        self.messages = {}
        self.fetched = []
        self.added = []
        self.latest = "20"

    def get(self, path, params):
        msg_id = path.split("/")[1]
        self.fetched.append(msg_id)
        return self.messages[msg_id]

    def changes(self, start):
        return self.added, self.latest

    def watch(self, topic):
        return {"historyId": "999", "expiration": "2000000000000"}


class MailReceiver(unittest.TestCase):
    def setUp(self):
        # Retain temp fixtures; never delete existing user files.
        self.root = Path(tempfile.mkdtemp(prefix="mail-events-test-"))
        self.source = self.root / "source.md"
        self.source.write_text("# 隔离主记录\n")
        self.store = self.root / "tasks.json"
        self.store.write_text(json.dumps({"schemaVersion": 1, "revision": 0, "tasks": [
            {"id": "APP", "title": "隔离申请", "cat": "申请", "lane": "等待外部",
             "completed": False, "stage": "面试中", "reply": "等待回复", "source": str(self.source)}]}))
        monitor = self.root / "monitor.json"
        monitor.write_text(json.dumps({"trackedThreads": {"APP": "thread1"}}))
        self.config = {"privateDir": str(self.root / "private"), "monitorFile": str(monitor),
                       "store": str(self.store), "todoctl": str(RADAR / "todoctl.py"),
                       "account": "me@example.com", "topic": "projects/test/topics/test"}
        # Never fire a real osascript notification from the test run.
        self.config["notify"] = {"enabled": False}
        self.gmail = FakeGmail()
        self.r = receiver.Receiver(self.config, self.gmail)
        self.r.state.update({"historyId": "10", "baselineAt": "2026-10-24T12:00:00+02:00"})
        self.r.save()

    def message(self, mid="incoming", labels=None, date="1792843200000"):
        # 2026-10-24 after the baseline; body is untrusted external content.
        self.gmail.messages[mid] = {"id": mid, "threadId": "thread1", "internalDate": date,
                                   "labelIds": labels or ["INBOX"], "snippet": "请查看安排",
                                   "payload": {"headers": [{"name": "From", "value": "hr@example.com"},
                                                             {"name": "Subject", "value": "回复申请"}]}}
        return {"id": mid, "threadId": "thread1"}

    def test_only_tracked_incoming_is_reported_and_stage_preserved(self):
        self.gmail.added = [{"id": "unrelated", "threadId": "other"},
                            self.message("sent", ["SENT"]), self.message()]
        self.r.catch_up()
        data = receiver.read_json(self.store)
        self.assertEqual(self.gmail.fetched, ["sent", "incoming"])
        self.assertEqual(data["tasks"][0]["stage"], "面试中")
        self.assertEqual(data["tasks"][0]["reply"], "已回复")
        self.assertEqual([a["eventId"] for a in data["alerts"]], ["incoming"])
        self.assertIn("gmail-event:incoming", self.source.read_text())
        self.assertEqual(self.r.state["historyId"], "20")

    def test_replay_after_partial_write_is_idempotent(self):
        msg = self.message()
        original_deliver = self.r.deliver
        def crash_after_delivery(event):
            original_deliver(event)
            raise RuntimeError("simulated crash before marking processed")
        with patch.object(self.r, "deliver", crash_after_delivery):
            with self.assertRaises(RuntimeError):
                self.r.process(msg)
        restarted = receiver.Receiver(self.config, self.gmail)
        restarted.catch_up()
        self.assertEqual(len(receiver.read_json(self.store)["alerts"]), 1)
        self.assertEqual(self.source.read_text().count("<!-- gmail-event:incoming -->"), 1)
        self.assertEqual(restarted.state["processed"], ["incoming"])

    def test_baseline_and_renewal_do_not_create_alerts_or_lose_cursor(self):
        self.gmail.added = [self.message("old", date="1000000")]
        self.r.renew()
        self.assertEqual(self.r.state["historyId"], "10")
        self.r.catch_up()
        self.assertNotIn("alerts", receiver.read_json(self.store))
        self.assertEqual(self.source.read_text(), "# 隔离主记录\n")

    def test_failed_source_write_preserves_history_cursor(self):
        self.gmail.added = [self.message()]
        with patch.object(self.r, "append_source", side_effect=OSError("denied")):
            with self.assertRaises(OSError):
                self.r.catch_up()
        self.assertEqual(receiver.read_json(self.r.state_path)["historyId"], "10")
        self.assertNotIn("alerts", receiver.read_json(self.store))

    def test_failure_alert_dedup_and_recovery(self):
        self.config["healthSource"] = str(self.source)
        self.r.cli("add", "--id", "TOOLING", "--title", "隔离工具事项")
        receiver.report_failure(self.config, ValueError("sensitive text must not be recorded"))
        receiver.report_failure(self.config, ValueError("same ongoing failure"))
        alerts = self.r.cli("alerts")["alerts"]
        self.assertEqual(len(alerts), 1)
        self.assertNotIn("sensitive text", self.source.read_text())
        self.r.cli("ack", alerts[0]["id"])
        receiver.report_failure(self.config, ValueError("retry after acknowledgement"))
        self.assertEqual(self.r.cli("alerts")["alerts"], [])
        receiver.report_healthy(self.config)
        receiver.report_failure(self.config, ValueError("new outage"))
        self.assertEqual(len(self.r.cli("alerts")["alerts"]), 1)
        self.assertEqual(len(self.r.cli("alerts", "--all")["alerts"]), 2)

    def test_classify_reply_is_tentative_and_extracts_meeting_url(self):
        interview = receiver.classify_reply({"subject": "面试安排", "excerpt": "邀请您参加线上面试，会议链接 https://zoom.us/j/123"})
        self.assertEqual(interview["kind"], "interview")
        self.assertIn("疑似", interview["hint"])
        self.assertEqual(interview["meetingUrl"], "https://zoom.us/j/123")

        offer = receiver.classify_reply({"subject": "Offer letter", "excerpt": "congratulations"})
        self.assertEqual(offer["kind"], "offer")

        rejection = receiver.classify_reply({"subject": "更新", "excerpt": "Unfortunately we are unable to offer you a position"})
        self.assertEqual(rejection["kind"], "rejection")

        generic = receiver.classify_reply({"subject": "跟进", "excerpt": "想确认一下时间"})
        self.assertEqual(generic["kind"], "generic")
        self.assertEqual(generic["meetingUrl"], "")

    def test_notify_disabled_and_configured_command(self):
        self.assertFalse(receiver.notify_user({"notify": {"enabled": False}}, "标题", "正文"))

        out = self.root / "notify-args.txt"
        script = "import sys; open(%r, 'w').write('|'.join(sys.argv[1:]))" % str(out)
        command = ["python3", "-c", script, "{title}", "{message}"]
        self.assertTrue(receiver.notify_user({"notify": {"command": command}}, "新回复", "请查看邮件"))
        self.assertEqual(out.read_text(encoding="utf-8"), "新回复|请查看邮件")


if __name__ == "__main__":
    unittest.main()

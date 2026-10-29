#!/usr/bin/env python3
"""Atomic local task-store CLI shared by Codex threads and Planknot.app."""

from __future__ import annotations

import argparse
import copy
import fcntl
import hashlib
import json
import os
import re
import socket
import sys
import subprocess
import tempfile
from contextlib import contextmanager
from datetime import datetime
from pathlib import Path
from typing import Any, Iterator
from zoneinfo import ZoneInfo
from urllib.parse import urlsplit


ROOT = Path(__file__).resolve().parent
DEFAULT_STORE = ROOT / "store" / "tasks.json"
PARIS = ZoneInfo("Europe/Paris")
LANES = {"临近 / 已过", "进行中", "等待外部", "待核实", "已完成"}
TIMELINE_KINDS = {"status", "note", "milestone"}
STAGES = ["待核实", "待准备", "待审稿", "已投递", "面试中", "Offer", "未通过", "已撤回", "已结束"]
DEFAULT_CATEGORIES = ["课程", "生活", "申请", "科研", "工具"]
DEFAULT_CATEGORIES_PATH = ROOT / "store" / "categories.json"
LINK_TYPES = {"web", "doc", "chat", "other"}
PROJECT_FIELDS = {
    "kind": "kind", "project": "project", "stage": "stage",
    "contact": "contact", "submitted_at": "submittedAt", "reply": "reply",
    "reply_checked_at": "replyCheckedAt", "follow_up": "followUp",
    "ended_at": "endedAt", "end_reason": "endReason", "prep_note": "prepNote",
}


def validate_interviews(rounds: Any) -> None:
    if not isinstance(rounds, list):
        raise ValueError("interviews must be a list")
    seen = set()
    for item in rounds:
        if not isinstance(item, dict):
            raise ValueError("interview must be an object")
        for key in ("id", "round", "status", "startsAt", "timezone", "meetingUrl", "location", "notes"):
            if not isinstance(item.get(key), str):
                raise ValueError(f"interview {key} must be text")
        if not item["id"].strip() or item["id"] in seen or not item["round"].strip():
            raise ValueError("interview needs a unique id and round label")
        seen.add(item["id"])
        if item["status"] not in {"待安排", "已安排", "已完成", "已取消"}:
            raise ValueError("invalid interview status")
        if item["startsAt"].strip() and not item["timezone"].strip():
            raise ValueError("interview time requires a timezone")
        if item["timezone"]:
            try:
                ZoneInfo(item["timezone"])
            except (KeyError, ValueError):
                raise ValueError("interview timezone must be an IANA name, e.g. Asia/Shanghai")
        if item["meetingUrl"]:
            url = urlsplit(item["meetingUrl"])
            if url.scheme != "https" or not url.hostname or url.username or url.password or any(c.isspace() for c in item["meetingUrl"]):
                raise ValueError("meeting link must be an https URL without credentials")


def parse_interviews(value: str | None) -> Any:
    if value is None:
        return None
    rounds = json.loads(value)
    validate_interviews(rounds)
    return rounds


def parse_links(value: str | None) -> Any:
    if value is None:
        return None
    if not value.strip():
        return []
    links = json.loads(value)
    validate_links(links)
    return links


def validate_links(links: Any) -> None:
    if not isinstance(links, list):
        raise ValueError("links must be a list")
    seen: set[str] = set()
    for link in links:
        if not isinstance(link, dict):
            raise ValueError("link must be an object")
        for key in ("id", "type", "label", "url"):
            if not isinstance(link.get(key), str) or not link[key].strip():
                raise ValueError(f"link {key} must be non-empty text")
        if link["id"] in seen:
            raise ValueError("link id must be unique")
        seen.add(link["id"])
        if link["type"] not in LINK_TYPES:
            raise ValueError(f"invalid link type: {link['type']}")
        if link["type"] == "web":
            url = urlsplit(link["url"])
            if url.scheme != "https" or not url.hostname or url.username or url.password:
                raise ValueError("web link must be an https URL without credentials")


def sync_application_stage(task: dict, old_stage: str = "") -> None:
    ended = {"已结束", "未通过", "已撤回"}
    if task.get("stage") in ended:
        if task["lane"] != "已完成":
            task["previousLane"] = task["lane"]
        task["lane"], task["completed"] = "已完成", True
    elif old_stage in ended and task.get("stage"):
        if task["lane"] == "已完成":
            task["lane"] = task.get("previousLane") or "进行中"
        task["previousLane"], task["completed"] = None, False


def now_iso() -> str:
    return datetime.now(PARIS).isoformat(timespec="seconds")


def default_actor() -> str:
    return os.environ.get("CODEX_THREAD_ID") or f"codex@{socket.gethostname()}"


def categories_path(store_path: Path) -> Path:
    """Categories are a per-store config file, not part of the task schema."""
    return store_path.with_name("categories.json")


def load_categories(store_path: Path) -> list[str]:
    path = categories_path(store_path)
    if not path.exists():
        return list(DEFAULT_CATEGORIES)
    try:
        value = json.loads(path.read_text())
    except (OSError, json.JSONDecodeError):
        return list(DEFAULT_CATEGORIES)
    names = value.get("categories") if isinstance(value, dict) else None
    if not isinstance(names, list) or not names or any(not isinstance(n, str) or not n.strip() for n in names):
        return list(DEFAULT_CATEGORIES)
    seen: set[str] = set()
    deduped: list[str] = []
    for name in names:
        name = name.strip()
        if name and name not in seen:
            seen.add(name)
            deduped.append(name)
    return deduped or list(DEFAULT_CATEGORIES)


def save_categories(store_path: Path, names: list[str]) -> list[str]:
    cleaned: list[str] = []
    seen: set[str] = set()
    for name in names:
        name = name.strip()
        if not name:
            raise ValueError("分类名不能为空")
        if len(name) > 24:
            raise ValueError(f"分类名过长：{name}")
        if name in seen:
            raise ValueError(f"分类重复：{name}")
        seen.add(name)
        cleaned.append(name)
    if not cleaned:
        raise ValueError("至少保留一个分类")
    path = categories_path(store_path)
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(".next")
    tmp.write_text(json.dumps({"categories": cleaned}, ensure_ascii=False, indent=2) + "\n")
    tmp.replace(path)
    return cleaned


def load_store(path: Path) -> dict[str, Any]:
    data = json.loads(path.read_text())
    validate_store(data)
    return data


def validate_store(data: dict[str, Any]) -> None:
    if data.get("schemaVersion") != 1:
        raise ValueError("unsupported schemaVersion")
    if not isinstance(data.get("revision"), int):
        raise ValueError("revision must be an integer")
    tasks = data.get("tasks")
    if not isinstance(tasks, list):
        raise ValueError("tasks must be a list")
    seen: set[str] = set()
    for index, task in enumerate(tasks):
        if not isinstance(task, dict):
            raise ValueError(f"task {index} is not an object")
        task_id = task.get("id")
        if not isinstance(task_id, str) or not task_id.strip():
            raise ValueError(f"task {index} has no id")
        if task_id in seen:
            raise ValueError(f"duplicate task id: {task_id}")
        seen.add(task_id)
        if not isinstance(task.get("title"), str) or not task["title"].strip():
            raise ValueError(f"task {task_id} has no title")
        if task.get("lane") not in LANES:
            raise ValueError(f"task {task_id} has invalid lane: {task.get('lane')}")
        if not isinstance(task.get("completed"), bool):
            raise ValueError(f"task {task_id} completed must be boolean")
        if "archived" in task and not isinstance(task["archived"], bool):
            raise ValueError(f"task {task_id} archived must be boolean")
        for field in PROJECT_FIELDS.values():
            if field in task and not isinstance(task[field], str):
                raise ValueError(f"task {task_id} {field} must be text")
        if task.get("kind", "task") not in {"task", "board"}:
            raise ValueError(f"task {task_id} has invalid kind")
        if task.get("stage") and task["stage"] not in STAGES:
            raise ValueError(f"task {task_id} has invalid stage")
        if task.get("prepNote") and (not Path(task["prepNote"]).is_absolute() or Path(task["prepNote"]).suffix.lower() != ".md"):
            raise ValueError("prepNote must be an absolute Markdown note path")
        validate_interviews(task.get("interviews", []))
        validate_links(task.get("links", []))
        if task.get("kind") == "board" and task.get("project"):
            raise ValueError("a board cannot be nested inside another board")
        timeline = task.get("timeline", [])
        if not isinstance(timeline, list):
            raise ValueError(f"task {task_id} timeline must be a list")
        for entry in timeline:
            if (not isinstance(entry, dict) or entry.get("kind") not in TIMELINE_KINDS
                    or not isinstance(entry.get("title"), str) or not entry.get("at")):
                raise ValueError(f"task {task_id} has an invalid timeline entry")
    boards = {t["id"] for t in tasks if t.get("kind") == "board"}
    for task in tasks:
        if task.get("project") and task["project"] not in boards:
            raise ValueError(f"task {task['id']} project must refer to an existing board")
    alerts = data.get("alerts", [])
    if not isinstance(alerts, list):
        raise ValueError("alerts must be a list")
    alert_ids: set[str] = set()
    for alert in alerts:
        if not isinstance(alert, dict) or any(
            not isinstance(alert.get(key), str) or not alert[key].strip()
            for key in ("id", "eventId", "taskId", "title", "text", "source", "at")
        ):
            raise ValueError("invalid progress alert")
        if alert["taskId"] not in seen or alert["id"] in alert_ids:
            raise ValueError("alert must have a unique ID and an existing task")
        if "readAt" in alert and not isinstance(alert["readAt"], str):
            raise ValueError("alert readAt must be text")
        alert_ids.add(alert["id"])


@contextmanager
def locked_store(path: Path) -> Iterator[None]:
    path.parent.mkdir(parents=True, exist_ok=True)
    lock_path = path.with_suffix(path.suffix + ".lock")
    with lock_path.open("a+") as lock:
        fcntl.flock(lock.fileno(), fcntl.LOCK_EX)
        try:
            yield
        finally:
            fcntl.flock(lock.fileno(), fcntl.LOCK_UN)


def task_by_id(data: dict[str, Any], task_id: str) -> dict[str, Any]:
    for task in data["tasks"]:
        if task["id"] == task_id:
            return task
    raise KeyError(f"unknown task id: {task_id}")


def write_store(path: Path, data: dict[str, Any], *, actor: str, action: str,
                task_id: str, before: dict[str, Any] | None,
                after: dict[str, Any] | None) -> None:
    validate_store(data)
    history_dir = path.parent / "history"
    history_dir.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now(PARIS).strftime("%Y%m%dT%H%M%S%z")
    if path.exists():
        snapshot = history_dir / f"tasks-r{data['revision'] - 1:06d}-{stamp}.json"
        snapshot.write_text(path.read_text())
    encoded = json.dumps(data, ensure_ascii=False, indent=2) + "\n"
    fd, temp_name = tempfile.mkstemp(prefix="tasks-", suffix=".tmp", dir=path.parent)
    try:
        with os.fdopen(fd, "w") as temp:
            temp.write(encoded)
            temp.flush()
            os.fsync(temp.fileno())
        os.replace(temp_name, path)
    finally:
        if os.path.exists(temp_name):
            os.unlink(temp_name)
    event = {
        "at": data["updatedAt"],
        "revision": data["revision"],
        "actor": actor,
        "action": action,
        "taskId": task_id,
        "before": before,
        "after": after,
    }
    with (path.parent / "events.jsonl").open("a") as log:
        log.write(json.dumps(event, ensure_ascii=False, separators=(",", ":")) + "\n")


def commit(path: Path, actor: str, action: str, task_id: str,
           mutator: Any) -> dict[str, Any]:
    with locked_store(path):
        data = load_store(path)
        existing = None
        try:
            existing = copy.deepcopy(task_by_id(data, task_id))
        except KeyError:
            pass
        result = mutator(data)
        timestamp = now_iso()
        if result is not None:
            result["updatedAt"] = timestamp
            result["updatedBy"] = actor
        data["revision"] += 1
        data["updatedAt"] = timestamp
        write_store(path, data, actor=actor, action=action, task_id=task_id,
                    before=existing, after=copy.deepcopy(result))
        return {"revision": data["revision"], "task": result}


def add_entry(task: dict[str, Any], kind: str, title: str, by: str, *,
              date: str | None = None, done: bool | None = None) -> dict[str, Any]:
    entry: dict[str, Any] = {"at": now_iso(), "kind": kind, "title": title.strip(), "by": by}
    if date:
        entry["date"] = date
    if done is not None:
        entry["done"] = done
    task.setdefault("timeline", []).append(entry)
    return entry


def note_state_change(task: dict[str, Any], by: str, old_lane: str, old_completed: bool) -> None:
    """Append automatic timeline entries for status changes. Never invents history."""
    if task["completed"] and not old_completed:
        add_entry(task, "milestone", "任务完成", by, done=True)
    elif not task["completed"] and old_completed:
        add_entry(task, "status", f"重新打开 → {task['lane']}", by)
    elif task["lane"] != old_lane:
        add_entry(task, "status", f"状态 {old_lane} → {task['lane']}", by)
    if not task["completed"] and task.get("archived"):
        task["archived"] = False
        task.pop("archivedAt", None)
        add_entry(task, "status", "重新打开,已取消归档", by)


def generate_id(data: dict[str, Any], title: str) -> str:
    base = re.sub(r"[^A-Z0-9]+", "-", title.upper()).strip("-")[:28]
    if not base:
        base = datetime.now(PARIS).strftime("TASK-%Y%m%d-%H%M%S")
    used = {task["id"] for task in data["tasks"]}
    candidate = base
    suffix = 2
    while candidate in used:
        candidate = f"{base}-{suffix}"
        suffix += 1
    return candidate


def add_task(args: argparse.Namespace) -> dict[str, Any]:
    holder: dict[str, str] = {}

    def mutate(data: dict[str, Any]) -> dict[str, Any]:
        task_id = args.id or generate_id(data, args.title)
        if any(task["id"] == task_id for task in data["tasks"]):
            raise ValueError(f"task id already exists: {task_id}")
        holder["id"] = task_id
        task = {
            "id": task_id,
            "cat": args.category,
            "lane": args.lane,
            "title": args.title.strip(),
            "detail": args.detail or "",
            "due": args.due or "未设置",
            "flag": args.flag or "新任务",
            "risk": args.risk or "",
            "source": args.source or "",
            "checked": datetime.now(PARIS).strftime("%m/%d"),
            "completed": args.lane == "已完成",
            "previousLane": None,
        }
        data["tasks"].append(task)
        return task

    # The id is generated while holding the lock, so use a placeholder for the event call.
    with locked_store(args.store):
        data = load_store(args.store)
        task_id = args.id or generate_id(data, args.title)
        if any(task["id"] == task_id for task in data["tasks"]):
            raise ValueError(f"task id already exists: {task_id}")
        holder["id"] = task_id
        task = {
            "id": task_id, "cat": args.category, "lane": args.lane,
            "title": args.title.strip(), "detail": args.detail or "",
            "due": args.due or "未设置", "flag": args.flag or "新任务",
            "risk": args.risk or "", "source": args.source or "",
            "checked": datetime.now(PARIS).strftime("%m/%d"),
            "completed": args.lane == "已完成", "previousLane": None,
            "updatedAt": now_iso(), "updatedBy": args.by,
        }
        add_entry(task, "status", f"创建 · {args.lane}", args.by)
        for arg, field in PROJECT_FIELDS.items():
            value = getattr(args, arg, None)
            if value is not None:
                task[field] = value
        if getattr(args, "interviews_json", None) is not None:
            task["interviews"] = parse_interviews(args.interviews_json)
        if getattr(args, "links_json", None) is not None:
            task["links"] = parse_links(args.links_json)
        sync_application_stage(task)
        data["tasks"].append(task)
        data["revision"] += 1
        data["updatedAt"] = task["updatedAt"]
        write_store(args.store, data, actor=args.by, action="add", task_id=task_id,
                    before=None, after=copy.deepcopy(task))
        return {"revision": data["revision"], "task": task}


def update_task(args: argparse.Namespace) -> dict[str, Any]:
    fields = {
        "title": args.title, "cat": args.category, "lane": args.lane,
        "detail": args.detail, "due": args.due, "flag": args.flag,
        "risk": args.risk, "source": args.source,
    }
    fields.update({field: getattr(args, arg, None) for arg, field in PROJECT_FIELDS.items()})
    fields["interviews"] = parse_interviews(getattr(args, "interviews_json", None))
    fields["links"] = parse_links(getattr(args, "links_json", None))
    if all(value is None for value in fields.values()) and args.completed is None:
        raise ValueError("no update fields supplied")

    def mutate(data: dict[str, Any]) -> dict[str, Any]:
        task = task_by_id(data, args.id)
        old_lane, old_completed = task["lane"], task["completed"]
        old_stage = task.get("stage", "")
        old_interviews = copy.deepcopy(task.get("interviews", []))
        for key, value in fields.items():
            if value is not None:
                task[key] = value
        if args.completed is not None:
            desired = args.completed == "true"
            if desired and not task["completed"]:
                task["previousLane"] = task["lane"]
                task["lane"] = "已完成"
            elif not desired and task["completed"]:
                task["lane"] = task.get("previousLane") or "进行中"
                task["previousLane"] = None
            task["completed"] = desired
        if task["lane"] == "已完成":
            task["completed"] = True
        elif args.lane is not None:
            task["completed"] = False
        if getattr(args, "stage", None) is not None:
            sync_application_stage(task, old_stage)
        task["checked"] = datetime.now(PARIS).strftime("%m/%d")
        note_state_change(task, args.by, old_lane, old_completed)
        if task.get("stage", "") != old_stage:
            add_entry(task, "status", f"申请阶段 {old_stage or '未设置'} → {task.get('stage') or '未设置'}", args.by)
        if task.get("interviews", []) != old_interviews:
            add_entry(task, "note", "更新面试轮次 / 时间 / 会议信息（变更前内容保留于修订历史）", args.by)
        return task

    return commit(args.store, args.by, "update", args.id, mutate)


def set_completion(args: argparse.Namespace, completed: bool) -> dict[str, Any]:
    def mutate(data: dict[str, Any]) -> dict[str, Any]:
        task = task_by_id(data, args.id)
        old_lane, old_completed = task["lane"], task["completed"]
        if completed and not task["completed"]:
            task["previousLane"] = task["lane"]
            task["lane"] = "已完成"
        elif not completed and task["completed"]:
            task["lane"] = task.get("previousLane") or "进行中"
            task["previousLane"] = None
        task["completed"] = completed
        task["checked"] = datetime.now(PARIS).strftime("%m/%d")
        note_state_change(task, args.by, old_lane, old_completed)
        return task

    return commit(args.store, args.by, "complete" if completed else "reopen",
                  args.id, mutate)


def set_archived(args: argparse.Namespace, archived: bool) -> dict[str, Any]:
    def mutate(data: dict[str, Any]) -> dict[str, Any]:
        task = task_by_id(data, args.id)
        if archived:
            if task.get("archived"):
                raise ValueError(f"task already archived: {args.id}")
            if not task["completed"] and not getattr(args, "force", False):
                raise ValueError("only completed tasks can be archived; use --force for an open task")
            task["archived"] = True
            task["archivedAt"] = now_iso()
            add_entry(task, "status", "已归档", args.by)
        else:
            if not task.get("archived"):
                raise ValueError(f"task is not archived: {args.id}")
            task["archived"] = False
            task.pop("archivedAt", None)
            add_entry(task, "status", "取消归档", args.by)
        return task

    return commit(args.store, args.by, "archive" if archived else "unarchive", args.id, mutate)


def add_note(args: argparse.Namespace) -> dict[str, Any]:
    def mutate(data: dict[str, Any]) -> dict[str, Any]:
        task = task_by_id(data, args.id)
        add_entry(task, "note", args.text, args.by)
        return task

    return commit(args.store, args.by, "note", args.id, mutate)


def add_milestone(args: argparse.Namespace) -> dict[str, Any]:
    def mutate(data: dict[str, Any]) -> dict[str, Any]:
        task = task_by_id(data, args.id)
        add_entry(task, "milestone", args.title, args.by, date=args.date, done=args.done)
        return task

    return commit(args.store, args.by, "milestone", args.id, mutate)


def finish_milestone(args: argparse.Namespace) -> dict[str, Any]:
    def mutate(data: dict[str, Any]) -> dict[str, Any]:
        task = task_by_id(data, args.id)
        for entry in reversed(task.get("timeline", [])):
            if entry["kind"] == "milestone" and entry["title"] == args.title.strip() and entry.get("done") is False:
                entry["done"] = True
                entry["doneAt"] = now_iso()
                return task
        raise KeyError(f"no open milestone titled: {args.title}")

    return commit(args.store, args.by, "milestone-done", args.id, mutate)


def show_timeline(args: argparse.Namespace) -> None:
    task = task_by_id(load_store(args.store), args.id)
    for entry in reversed(task.get("timeline", [])):
        mark = {"milestone": "◆", "status": "●", "note": "·"}[entry["kind"]]
        state = "" if entry.get("done") is None else (" [已达成]" if entry["done"] else " [未达成]")
        when = f" · {entry['date']}" if entry.get("date") else ""
        print(f"{entry['at']}  {mark} {entry['title']}{when}{state}")


def progress_alert(args: argparse.Namespace) -> dict[str, Any]:
    """Persist explicit evidence-backed alerts; duplicate events are a no-op."""
    with locked_store(args.store):
        data = load_store(args.store)
        alerts = data.setdefault("alerts", [])
        before = copy.deepcopy(alerts)
        timestamp = now_iso()
        if args.command == "notify":
            task = task_by_id(data, args.id)
            alert_id = hashlib.sha256(f"{args.id}:{args.event_id}".encode()).hexdigest()[:24]
            existing = next((a for a in alerts if a["id"] == alert_id), None)
            if existing:
                return {"revision": data["revision"], "duplicate": True, "alert": existing}
            alert = {"id": alert_id, "eventId": args.event_id, "taskId": args.id, "taskTitle": task["title"],
                     "title": args.title.strip(), "text": args.text.strip(),
                     "source": args.source.strip(), "at": timestamp}
            alerts.append(alert)
            result = {"alert": alert}
        else:
            requested = set(args.ids)
            if requested - {a["id"] for a in alerts}:
                raise ValueError("unknown alert ID; reload before acknowledging")
            changed = [a for a in alerts if a["id"] in requested and not a.get("readAt")]
            if not changed:
                return {"revision": data["revision"], "acknowledged": []}
            for alert in changed:
                alert["readAt"] = timestamp
            result = {"acknowledged": [a["id"] for a in changed]}
        data["revision"] += 1
        data["updatedAt"] = timestamp
        write_store(args.store, data, actor=args.by, action=args.command,
                    task_id=getattr(args, "id", ""), before={"alerts": before},
                    after={"alerts": copy.deepcopy(alerts)})
        return {"revision": data["revision"], **result}


def refresh_widget(path: Path) -> None:
    """Ask the signed native host to reload WidgetKit, only for the live store."""
    app = ROOT / "native" / "Planknot.app"
    if sys.platform != "darwin" or path != DEFAULT_STORE.resolve() or not app.exists():
        return
    try:
        subprocess.run(["/usr/bin/open", "-g", "-a", str(app), "todolist://refresh"],
                       capture_output=True, timeout=5, check=True)
    except (OSError, subprocess.SubprocessError) as exc:
        print(f"Widget refresh request failed: {exc}", file=sys.stderr)


def list_tasks(args: argparse.Namespace) -> None:
    data = load_store(args.store)
    tasks = data["tasks"]
    hidden = sum(1 for task in tasks if task.get("archived"))
    if args.archived == "true":
        tasks = [task for task in tasks if task.get("archived")]
    elif not args.all and args.archived != "false":
        tasks = [task for task in tasks if not task.get("archived")]
    elif args.archived == "false":
        tasks = [task for task in tasks if not task.get("archived")]
    if args.category:
        tasks = [task for task in tasks if task["cat"] == args.category]
    if args.project:
        tasks = [task for task in tasks if task.get("project") == args.project]
    if args.lane:
        tasks = [task for task in tasks if task["lane"] == args.lane]
    if args.completed is not None:
        desired = args.completed == "true"
        tasks = [task for task in tasks if task["completed"] == desired]
    if args.json:
        print(json.dumps({"revision": data["revision"], "tasks": tasks,
                          "alerts": data.get("alerts", []),
                          "categories": load_categories(args.store)},
                         ensure_ascii=False, indent=2))
        return
    for task in tasks:
        marker = "▣" if task.get("archived") else ("✓" if task["completed"] else "○")
        print(f"{marker} {task['id']}\t{task['cat']}\t{task['lane']}\t{task['title']}")
    if hidden and not args.all and args.archived is None:
        print(f"(另有 {hidden} 项已归档;--all 显示全部,--archived true 只看归档)")


def category_usage(data: dict[str, Any], name: str) -> list[str]:
    return [task["id"] for task in data["tasks"] if task.get("cat") == name]


def category_op(args: argparse.Namespace) -> dict[str, Any]:
    current = load_categories(args.store)
    if args.op == "list":
        if args.json:
            print(json.dumps({"categories": current}, ensure_ascii=False, indent=2))
            return {}
        print("\n".join(current))
        return {}
    if args.op == "add":
        name = (args.name or "").strip()
        if not name:
            raise ValueError("请提供 --name")
        if name in current:
            raise ValueError(f"分类已存在：{name}")
        save_categories(args.store, current + [name])
        return {"categories": load_categories(args.store)}
    if args.op == "remove":
        name = (args.name or "").strip()
        if name not in current:
            raise ValueError(f"分类不存在：{name}")
        with locked_store(args.store):
            data = load_store(args.store)
            used = category_usage(data, name)
            if used and not args.reassign:
                raise ValueError(f"分类「{name}」仍被 {len(used)} 项任务使用，请先用 --reassign 指定迁移目标")
            target = None
            if used:
                target = (args.reassign or "").strip()
                if target == name:
                    raise ValueError("迁移目标不能是被删除的分类本身")
                remaining = [c for c in current if c != name]
                if target not in remaining:
                    raise ValueError(f"迁移目标必须是保留的分类之一：{'、'.join(remaining)}")
                for task in data["tasks"]:
                    if task.get("cat") == name:
                        task["cat"] = target
                data["revision"] += 1
                data["updatedAt"] = now_iso()
                write_store(args.store, data, actor=args.by, action="category",
                            task_id="__categories__", before=None,
                            after={"removed": name, "reassignedTo": target, "count": len(used)})
            save_categories(args.store, [c for c in current if c != name])
        return {"categories": load_categories(args.store)}
    if args.op == "rename":
        src = (getattr(args, "from", None) or "").strip()
        dst = (args.to or "").strip()
        if src not in current:
            raise ValueError(f"分类不存在：{src}")
        if not dst:
            raise ValueError("请提供 --to")
        if dst in current and dst != src:
            raise ValueError(f"目标分类已存在：{dst}")
        with locked_store(args.store):
            data = load_store(args.store)
            used = category_usage(data, src)
            for task in data["tasks"]:
                if task.get("cat") == src:
                    task["cat"] = dst
            if used:
                data["revision"] += 1
                data["updatedAt"] = now_iso()
                write_store(args.store, data, actor=args.by, action="category",
                            task_id="__categories__", before=None,
                            after={"renamedFrom": src, "renamedTo": dst, "count": len(used)})
            save_categories(args.store, [dst if c == src else c for c in current])
        return {"categories": load_categories(args.store)}
    raise ValueError("unknown category operation")


def set_categories(args: argparse.Namespace) -> dict[str, Any]:
    incoming = [name.strip() for name in args.names]
    current = load_categories(args.store)
    removed = [name for name in current if name not in incoming]
    with locked_store(args.store):
        data = load_store(args.store)
        blocked = {name: len(category_usage(data, name)) for name in removed if category_usage(data, name)}
        if blocked:
            detail = "；".join(f"「{name}」{count} 项" for name, count in blocked.items())
            raise ValueError(f"以下分类仍被任务使用，请先迁移或保留：{detail}")
    cleaned = save_categories(args.store, incoming)
    return {"categories": cleaned}


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Update the shared Planknot store")
    parser.add_argument("--store", type=Path,
                        default=Path(os.environ.get("TODO_STORE_PATH", DEFAULT_STORE)))
    parser.add_argument("--by", default=default_actor(), help="actor recorded in audit log")
    sub = parser.add_subparsers(dest="command", required=True)

    listing = sub.add_parser("list")
    listing.add_argument("--category")
    listing.add_argument("--project", help="board ID; show its child tasks")
    listing.add_argument("--lane", choices=sorted(LANES))
    listing.add_argument("--completed", choices=["true", "false"])
    listing.add_argument("--json", action="store_true")
    listing.add_argument("--all", action="store_true", help="include archived tasks")
    listing.add_argument("--archived", choices=["true", "false"])

    add = sub.add_parser("add")
    add.add_argument("--id")
    add.add_argument("--title", required=True)
    add.add_argument("--category", default="工具")
    add.add_argument("--lane", choices=sorted(LANES), default="待核实")
    add.add_argument("--detail")
    add.add_argument("--due")
    add.add_argument("--flag")
    add.add_argument("--risk", choices=["", "urgent", "watch"], default="")
    add.add_argument("--source")

    update = sub.add_parser("update")
    update.add_argument("id")
    update.add_argument("--title")
    update.add_argument("--category")
    update.add_argument("--lane", choices=sorted(LANES))
    update.add_argument("--detail")
    update.add_argument("--due")
    update.add_argument("--flag")
    update.add_argument("--risk", choices=["", "urgent", "watch"])
    update.add_argument("--source")
    update.add_argument("--completed", choices=["true", "false"])
    for command in (add, update):
        command.add_argument("--prep-note", help="absolute Markdown path to open in Obsidian; empty clears")
        command.add_argument("--kind", choices=["task", "board"])
        command.add_argument("--project", help="parent board ID; empty string clears it")
        command.add_argument("--stage", choices=["", *STAGES])
        command.add_argument("--contact")
        command.add_argument("--submitted-at", help="source-backed date including timezone")
        command.add_argument("--reply", choices=["", "待核实", "等待回复", "已回复"])
        command.add_argument("--reply-checked-at", help="last actual reply check, including timezone")
        command.add_argument("--follow-up", help="next action/date; do not invent a deadline")
        command.add_argument("--ended-at", help="source-backed end time including timezone")
        command.add_argument("--end-reason", help="application result or closure reason")
        command.add_argument("--interviews-json", help="complete interview array; preserve existing rounds, mark cancelled instead of removing")
        command.add_argument("--links-json", help="JSON array of {id,type,label,url}; types web/doc/chat/other; empty string clears")

    complete = sub.add_parser("complete")
    complete.add_argument("id")
    reopen = sub.add_parser("reopen")
    reopen.add_argument("id")
    archive = sub.add_parser("archive")
    archive.add_argument("id")
    archive.add_argument("--force", action="store_true", help="archive a task that is not completed")
    unarchive = sub.add_parser("unarchive")
    unarchive.add_argument("id")
    note = sub.add_parser("note", help="add a timeline note")
    note.add_argument("id")
    note.add_argument("--text", required=True)
    milestone = sub.add_parser("milestone", help="add a key milestone to the timeline")
    milestone.add_argument("id")
    milestone.add_argument("--title", required=True)
    milestone.add_argument("--date", help="source-backed date text; omit if unknown")
    milestone.add_argument("--done", action="store_true", help="the milestone is already reached")
    milestone_done = sub.add_parser("milestone-done", help="mark an open milestone as reached")
    milestone_done.add_argument("id")
    milestone_done.add_argument("--title", required=True)
    timeline = sub.add_parser("timeline", help="print a task timeline, newest first")
    timeline.add_argument("id")
    notify = sub.add_parser("notify", help="record a meaningful verified update, deduplicated by event ID")
    notify.add_argument("id", help="existing task ID")
    notify.add_argument("--event-id", required=True, help="stable upstream message/event ID")
    notify.add_argument("--title", required=True)
    notify.add_argument("--text", required=True)
    notify.add_argument("--source", required=True, help="evidence URL or authoritative record path")
    alerts = sub.add_parser("alerts", help="list progress updates")
    alerts.add_argument("--all", action="store_true", help="include read updates")
    ack = sub.add_parser("ack", help="mark only the specified updates as read")
    ack.add_argument("ids", nargs="+")
    category = sub.add_parser("category", help="list or manage DIY task categories")
    category.add_argument("op", choices=["list", "add", "remove", "rename"])
    category.add_argument("--name")
    category.add_argument("--from")
    category.add_argument("--to")
    category.add_argument("--reassign", help="move tasks out of a removed category into this one")
    category.add_argument("--json", action="store_true")
    set_categories = sub.add_parser("set-categories", help="replace the full category list (UI uses this)")
    set_categories.add_argument("names", nargs="+")
    sub.add_parser("validate")
    return parser


def main() -> int:
    parser = build_parser()
    args = parser.parse_args()
    args.store = args.store.expanduser().resolve()
    try:
        if args.command == "list":
            list_tasks(args)
            return 0
        if args.command == "timeline":
            show_timeline(args)
            return 0
        if args.command == "alerts":
            data = load_store(args.store)
            alerts = [a for a in data.get("alerts", []) if args.all or not a.get("readAt")]
            print(json.dumps({"revision": data["revision"], "alerts": alerts}, ensure_ascii=False, indent=2))
            return 0
        if args.command == "validate":
            data = load_store(args.store)
            print(json.dumps({"ok": True, "revision": data["revision"],
                              "tasks": len(data["tasks"])}, ensure_ascii=False))
            return 0
        if args.command == "category":
            result = category_op(args)
            if args.op == "list":
                return 0
            print(json.dumps(result, ensure_ascii=False, indent=2))
            return 0
        if args.command == "set-categories":
            result = set_categories(args)
            print(json.dumps(result, ensure_ascii=False, indent=2))
            return 0
        if args.command == "add":
            result = add_task(args)
        elif args.command == "update":
            result = update_task(args)
        elif args.command == "complete":
            result = set_completion(args, True)
        elif args.command == "reopen":
            result = set_completion(args, False)
        elif args.command == "archive":
            result = set_archived(args, True)
        elif args.command == "unarchive":
            result = set_archived(args, False)
        elif args.command == "note":
            result = add_note(args)
        elif args.command == "milestone":
            args.done = True if args.done else False
            result = add_milestone(args)
        elif args.command == "milestone-done":
            result = finish_milestone(args)
        elif args.command in {"notify", "ack"}:
            result = progress_alert(args)
        else:
            parser.error("unknown command")
        print(json.dumps(result, ensure_ascii=False, indent=2))
        interview_change = (args.command in {"add", "update", "complete", "reopen", "archive", "unarchive"}
                            and (result.get("task", {}).get("interviews")
                                 or getattr(args, "interviews_json", None) is not None))
        if (args.command in {"notify", "ack"} or interview_change) and not result.get("duplicate") and args.by != "Planknot App":
            refresh_widget(args.store)
        return 0
    except (OSError, ValueError, KeyError, json.JSONDecodeError) as exc:
        print(json.dumps({"ok": False, "error": str(exc)}, ensure_ascii=False),
              file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())

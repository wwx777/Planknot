#!/usr/bin/env python3
"""Zero-token change detector for the shared To Do board.

Looks for Codex sessions under CodexWorkspace and task source records that changed
since the last committed check. Never calls an AI and never writes tasks.json.
  python3 reconcile_check.py            # dry run, prints report, state untouched
  python3 reconcile_check.py --commit   # also advances the last-checked time
Exit code 0 = nothing new, 10 = changes found.
"""
import argparse, json, re, sys, time
from datetime import datetime
from pathlib import Path

HERE = Path(__file__).resolve().parent
WORKSPACE = HERE.parent.parent
BOARD_ROOT = HERE.parent  # 01-Tools-and-Knowledge, base for relative task sources
TASKS = HERE / "store" / "tasks.json"
STATE = HERE / "reconcile" / "state.json"
PENDING = HERE / "reconcile" / "pending.md"
SESSIONS = Path.home() / ".codex" / "sessions"

def load_state():
    try:
        return json.loads(STATE.read_text())
    except Exception:
        return {"last_checked": time.time() - 5 * 3600}

def session_info(path):
    cwd, touched_board = "", False
    try:
        with path.open("r", encoding="utf-8", errors="ignore") as f:
            first = f.readline()
            try:
                cwd = json.loads(first).get("payload", {}).get("cwd", "") or ""
            except Exception:
                pass
        data = path.read_text(encoding="utf-8", errors="ignore")
        touched_board = any(w in data for w in ("todoctl.py update", "todoctl.py complete", "todoctl.py add", "todoctl.py reopen"))
    except Exception:
        pass
    return cwd, touched_board

DATE_RE = re.compile(r"(\d{4}[-/.]\d{1,2}[-/.]\d{1,2}|\d{1,2}月\d{1,2}[日号]?|\d{1,2}[/.]\d{1,2}(?!\d)|下周[一二三四五六日天]?|周[一二三四五六日天]|明天|后天|本周|月底|\b(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)[a-z]*\b|\bDDL\b|deadline)", re.I)
TOPIC_RE = re.compile(r"(简历|CV|lab\s*\d|Lab\s*\d|作业|ppt|PPT|汇报|答辩|口试|面试|实习|申请|投递|套磁|论文|报告|续签|预约|提交|考试|exam|internship)", re.I)

def user_clues(path):
    """Real user messages that mention a date or an ongoing-work topic."""
    out = []
    try:
        with path.open("r", encoding="utf-8", errors="ignore") as f:
            for line in f:
                try:
                    o = json.loads(line)
                except Exception:
                    continue
                pl = o.get("payload", {})
                if pl.get("type") != "message" or pl.get("role") != "user":
                    continue
                for c in pl.get("content", []):
                    t = (c.get("text") or "").strip()
                    if (not t or t.startswith(("<", "[", "{", "# Files mentioned", "# AGENTS.md", "Retained", "Another language model"))
                            or "assistant:" in t or "tool request" in t or len(t) > 600):
                        continue
                    if DATE_RE.search(t) or TOPIC_RE.search(t):
                        out.append(t.replace("\n", " ")[:140])
    except Exception:
        pass
    return out[:4]

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--commit", action="store_true")
    args = ap.parse_args()
    state = load_state()
    since = state["last_checked"]
    now = time.time()

    sessions = []
    if SESSIONS.exists():
        for p in SESSIONS.rglob("rollout-*.jsonl"):
            try:
                if p.stat().st_mtime > since:
                    cwd, touched = session_info(p)
                    if str(WORKSPACE) in cwd:
                        sessions.append((p, cwd, touched))
            except OSError:
                continue

    sources = []
    try:
        tasks = json.loads(TASKS.read_text())["tasks"]
    except Exception as e:
        print(f"cannot read tasks.json: {e}", file=sys.stderr)
        return 1
    for t in tasks:
        src = t.get("source")
        if not src:
            continue
        sp = Path(src) if src.startswith("/") else (BOARD_ROOT / src)
        try:
            if sp.exists() and sp.stat().st_mtime > since:
                board_ts = datetime.fromisoformat(t["updatedAt"].replace("Z", "+00:00")).timestamp()
                sources.append((t, sp, sp.stat().st_mtime > board_ts))
        except Exception:
            continue

    if not sessions and not sources:
        print("no changes since last check")
        if args.commit:
            STATE.parent.mkdir(parents=True, exist_ok=True)
            STATE.write_text(json.dumps({"last_checked": now}))
        return 0

    lines = [f"# 待对账变化 · 生成于 {datetime.now().astimezone().isoformat(timespec='minutes')}",
             f"检查区间起点：{datetime.fromtimestamp(since).astimezone().isoformat(timespec='minutes')}", ""]
    lines.append("## 主记录晚于看板更新的任务（优先对账）")
    stale = [(t, sp) for t, sp, newer in sources if newer]
    lines += [f"- {t['id']} · {t['title']} ← {sp}" for t, sp in stale] or ["- 无"]
    lines += ["", "## 主记录有改动，但看板随后也更新过的任务"]
    fresh = [(t, sp) for t, sp, newer in sources if not newer]
    lines += [f"- {t['id']} · {t['title']}" for t, sp in fresh] or ["- 无"]
    lines += ["", "## 区间内工作区会话"]
    lines += [f"- {p.name} · cwd={cwd} · {'已调用看板 CLI 写入' if touched else '未见看板写入'}"
              for p, cwd, touched in sessions] or ["- 无"]
    lines += ["", "## 疑似未入看板的新事项线索（日期或持续性工作关键词，需人工判断，勿直接当事实）"]
    n = 0
    seen = set()
    for p, cwd, touched in sessions:
        if touched:
            continue
        for c in user_clues(p):
            if c in seen:
                continue
            seen.add(c)
            lines.append(f"- [{Path(cwd).name}] {p.name[8:27]} · 「{c}」")
            n += 1
    if not n:
        lines.append("- 无")
    report = "\n".join(lines) + "\n"
    print(report)
    PENDING.parent.mkdir(parents=True, exist_ok=True)
    PENDING.write_text(report)
    if args.commit:
        STATE.write_text(json.dumps({"last_checked": now}))
    return 10

if __name__ == "__main__":
    sys.exit(main())

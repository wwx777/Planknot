#!/usr/bin/env python3
"""Insert or refresh the shared todo-board rule block in each category AGENTS.md.

Source of truth: agents-rule.md (next to this script). Idempotent; backs up first.
  python3 apply_agents_rule.py 01-Tools-and-Knowledge 03-Daily-Life
"""
import shutil, sys
from datetime import datetime
from pathlib import Path

HERE = Path(__file__).resolve().parent
WORKSPACE = HERE.parent.parent
START, END = "<!-- todo-board:start -->", "<!-- todo-board:end -->"
rule = (HERE / "agents-rule.md").read_text().strip() + "\n"
backup_dir = HERE / "backups-pre-timeline" / "agents-md"
backup_dir.mkdir(parents=True, exist_ok=True)
stamp = datetime.now().strftime("%Y%m%dT%H%M%S")

for name in sys.argv[1:]:
    path = WORKSPACE / name / "AGENTS.md"
    try:
        text = path.read_text()
        shutil.copy2(path, backup_dir / f"{name}-{stamp}.AGENTS.md")
        if START in text and END in text:
            head, rest = text.split(START, 1)
            _, tail = rest.split(END, 1)
            new = head.rstrip() + "\n\n" + rule + tail.lstrip("\n")
        else:
            new = text.rstrip() + "\n\n" + rule
        if new != text:
            path.write_text(new)
        print(f"{name}: ok")
    except PermissionError:
        print(f"{name}: permission denied")

#!/bin/zsh
set -euo pipefail
project_dir="${0:A:h}"
data_root="${TODOLIST_DATA_ROOT:-$HOME/Library/Application Support/Planknot}"
export TODOLIST_DATA_ROOT="$data_root"
PLANKNOT_BUILD_ONLY=1 "$project_dir/desktop-radar/native/构建原生小组件.command"
"$project_dir/setup.command"
app_path="$data_root/desktop-radar/native/Planknot.app"
# Quit the installed host before replacing its bundle.
/usr/bin/osascript <<'APPLESCRIPT'
if application id "com.example.planknot.ToDoList" is running then
  tell application id "com.example.planknot.ToDoList" to quit
end if
APPLESCRIPT
if [[ -d "$app_path" ]]; then
  mv "$app_path" "$app_path.backup-$(date +%Y%m%dT%H%M%S)-$$"
fi
ditto "$project_dir/desktop-radar/native/.derivedData/Build/Products/Release/Planknot.app" "$app_path"
open "$app_path"

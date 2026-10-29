#!/bin/zsh
set -euo pipefail
project_dir="${0:A:h}"
if [[ ! -d /Applications/Xcode.app ]]; then
  echo "请先从 App Store 完成 Xcode 安装。"
  exit 1
fi
export DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer
xcodegen generate --spec "$project_dir/project.yml" --project "$project_dir"

# Generate local sandbox paths without embedding a developer's home in source.
/usr/bin/python3 - "$project_dir" <<'PYCONFIG'
import json, os, plistlib, sys
from pathlib import Path
root = Path(sys.argv[1])
config_path = root.parent / 'config.local.json'
config = json.loads(config_path.read_text()) if config_path.exists() else {}
data_root = Path(os.path.expanduser(os.environ.get('TODOLIST_DATA_ROOT') or config.get('dataRoot') or '~/Library/Application Support/Planknot'))
value = {'com.apple.security.app-sandbox': True,
         'com.apple.security.temporary-exception.files.absolute-path.read-only': [
             str(data_root / 'desktop-radar/store/tasks.json'), str(data_root / 'config.json')]}
(root / 'Widget/ToDoListWidget.entitlements').write_bytes(plistlib.dumps(value))
PYCONFIG

xcodebuild -project "$project_dir/ToDoList.xcodeproj" \
  -scheme ToDoList -configuration Release -destination 'platform=macOS' \
  -derivedDataPath "$project_dir/.derivedData" CODE_SIGN_IDENTITY='-' build
app_path="$project_dir/.derivedData/Build/Products/Release/Planknot.app"
echo "已构建：$app_path"
if [[ "${PLANKNOT_BUILD_ONLY:-0}" != 1 ]]; then
  open "$app_path"
fi

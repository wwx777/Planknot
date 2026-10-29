#!/bin/zsh
set -euo pipefail
project_dir="${0:A:h}"
if [[ ! -d /Applications/Xcode.app ]]; then
  echo "请先从 App Store 完成 Xcode 安装。"
  exit 1
fi
export DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer
/opt/homebrew/bin/xcodegen generate --spec "$project_dir/project.yml" --project "$project_dir"

# 从本地配置生成 entitlements（config.local.json 被 git 忽略，模板用 __DATA_ROOT__ 占位）
config_file="$project_dir/../config.local.json"
data_root="$HOME/Library/Application Support/Planknot"
if [[ -f "$config_file" ]]; then
  resolved=$(/usr/bin/python3 -c "import json;print(json.load(open('$config_file')).get('dataRoot',''))" 2>/dev/null)
  [[ -n "$resolved" ]] && data_root="$resolved"
fi
sed "s|__DATA_ROOT__|$data_root|" "$project_dir/Widget/ToDoListWidget.entitlements.template" \
  > "$project_dir/Widget/ToDoListWidget.entitlements"

xcodebuild -project "$project_dir/ToDoList.xcodeproj" \
  -scheme ToDoList -configuration Debug -destination 'platform=macOS' \
  -derivedDataPath "$project_dir/.derivedData" CODE_SIGN_IDENTITY='-' build
app_path="$project_dir/.derivedData/Build/Products/Debug/Planknot.app"
echo "已构建：$app_path"
open "$app_path"

#!/bin/zsh
set -euo pipefail

# Planknot 首次运行准备（使用者双击运行，无需 Xcode）。
# 把看板资源部署到 ~/Library/Application Support/Planknot/ 并初始化空任务库。
# 幂等：可重复运行，不会覆盖已有的任务数据或分类。

project_dir="${0:A:h}"
data_root="$HOME/Library/Application Support/Planknot"
radar_src="$project_dir/desktop-radar"
radar_dst="$data_root/desktop-radar"

echo "Planknot 正在准备…"

mkdir -p "$data_root" "$radar_dst" "$radar_dst/native"

# 界面文件
cp "$project_dir/Board.html" "$data_root/Board.html"

# 界面脚本、样式与 Python 读写层
for f in \
  app_support.py calendar-dates.js due-editor.js focus-timer.js i18n.js \
  mail-link.js mail_tracking.py profile.js progress-updates.js project-boards.js \
  settings-calendar.js todoctl.py workspace-theme.css workspace-ui.js \
  config.example.json; do
  if [[ -f "$radar_src/$f" ]]; then
    cp "$radar_src/$f" "$radar_dst/$f"
  fi
done

# 界面与小组件用到的图标
if [[ -d "$radar_src/native/Shared" ]]; then
  rm -rf "$radar_dst/native/Shared"
  cp -R "$radar_src/native/Shared" "$radar_dst/native/Shared"
fi

# 初始化空任务库（仅在不存在时创建，不覆盖已有数据）
store_dir="$radar_dst/store"
mkdir -p "$store_dir"
if [[ ! -f "$store_dir/tasks.json" ]]; then
  cat > "$store_dir/tasks.json" <<'JSON'
{
  "schemaVersion": 1,
  "revision": 0,
  "tasks": [],
  "alerts": []
}
JSON
fi
if [[ ! -f "$store_dir/categories.json" ]]; then
  cat > "$store_dir/categories.json" <<'JSON'
{
  "categories": [
    "课程",
    "生活",
    "申请",
    "科研",
    "工具"
  ]
}
JSON
fi

echo "完成。数据目录：$data_root"
echo "打开 Planknot.app 即可使用；若系统提示无法验证开发者，请右键该 App 选择「打开」。"
echo "可在此修改分类与任务，数据都保存在本机。"

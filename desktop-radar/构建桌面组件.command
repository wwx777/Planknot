#!/bin/zsh
set -euo pipefail
project_dir="${0:A:h}"
app_dir="$project_dir/事项雷达.app"
mkdir -p "$app_dir/Contents/MacOS"
mkdir -p "$project_dir/.build/module-cache"
cp "$project_dir/Info.plist" "$app_dir/Contents/Info.plist"
swiftc -O -sdk /Library/Developer/CommandLineTools/SDKs/MacOSX15.4.sdk -module-cache-path "$project_dir/.build/module-cache" -framework AppKit -framework WebKit "$project_dir/DeskRadar.swift" -o "$app_dir/Contents/MacOS/DeskRadar"
echo "已构建：$app_dir"
open "$app_dir"

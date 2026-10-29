# Planknot · macOS App 与小组件

主应用使用 AppKit / WebKit 加载看板，WidgetKit 扩展展示任务与未读更新。

构建说明、环境配置和分发限制见 [项目 README](../../README.md)。

- Xcode 工程与 scheme 的内部名称仍为 `ToDoList`。
- 用户可见名称和构建产物为 `Planknot` / `Planknot.app`。
- 默认数据目录为 `~/Library/Application Support/Planknot`，可通过配置调整。
- 仓库不含个人任务库、邮箱凭据或本地环境配置。
- 当前源码快照需要准备本地运行目录，尚未制作可供他人直接安装的发行包。

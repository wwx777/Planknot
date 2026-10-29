## Unreleased

- 应用品牌统一为 Planknot（Plan + Knot）。
- 默认头像去除个人缩写，环境配置继续保存在忽略的本地文件中。
- 新增 `setup.command`：一键把看板资源部署到本机数据目录并初始化空任务库。
- 统一 App 读取的界面文件名为 `Board.html`，消除与 `跨分类进度看板.html` 的不一致。

# Changelog

版本号与 `desktop-radar/native/project.yml` 的 `CFBundleShortVersionString` 保持一致；tag 采用 `v<主>.<次>.<补丁>`。

## v1.1.0 — 2026-10-29

首次纳入版本管理。功能快照：

- 任务看板：新增、编辑、完成、归档、分类与状态、进度时间线、关键节点。
- Intern / PhD 专项板块：申请阶段、投递/回复/查收时间、多轮面试（时间、时区、会议链接）。
- 日历月/周/日视图，时区换算；DDL 与面试系统提醒、每日 routine。
- 任务关联专注计时；DDL 桌面小组件。
- 可 DIY 分类；任务级“关联信息”（面试 / 文档 / 网站 / 聊天，按需添加）。
- 中英界面切换；本机数据导出。

## 未完成 / 发布阻塞

- 数据根目录仍为个人绝对路径（App + Widget + entitlements）。
- 分发签名（Developer ID + notarize）未配置。

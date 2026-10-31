# Planknot

**把任务、资料和进展放在同一块看板上。**

Planknot 是一款本地运行的 macOS 待办应用，适合日常任务、项目推进和申请跟踪。
名字来自 **Plan + Knot**：把计划与相关信息系在一起。

> 当前为早期源码版本，欢迎试用和反馈。仓库尚未提供可直接下载安装的 Release；
> 从源码运行需要 Xcode 和 XcodeGen。

## 可以做什么

- **管理任务**：分类、截止时间、完成与归档，分类可以自行增删。
- **项目看板**：把大事项拆成子任务；申请项目支持阶段、多轮面试和会议链接。
- **关联资料**：按需添加文档、网站、聊天和面试信息。
- **安排时间**：月 / 周 / 日历、任务专注计时、日常练习提醒。
- **查看更新**：桌面小组件展示截止事项和未读进展。
- **个人设置**：中英文切换、本机数据导出。

## 安装与启动

### 从源码运行

准备：macOS 14 或以上、完整的 Xcode（安装后打开一次并完成初始化）、
Python 3，以及 [XcodeGen](https://github.com/yonaskolb/XcodeGen)。
使用 Homebrew 安装 XcodeGen：

```bash
brew install xcodegen
```

下载并运行：

```bash
git clone https://github.com/wwx777/Planknot.git
cd Planknot
./develop.command
```

脚本会构建 App、准备本地资源并打开 Planknot。首次使用会创建空任务库；
后续运行保留已有任务和设置。构建失败时，请保留终端里的错误信息，方便反馈。

### 已拿到测试 App

如果维护者单独提供了 `Planknot.app`，还需要同版本源码文件夹：

1. 在源码文件夹中双击 `setup.command`，准备界面资源与任务库。
2. 打开 `Planknot.app`。
3. 在应用设置中开启需要的提醒，并允许 macOS 通知。

`setup.command` 只准备资源，不构建或下载 App。单独复制 App 目前还不足以完成安装。
当前构建未配置 Developer ID 签名与公证；系统可能阻止首次打开。
确认来源后，可按 macOS 的提示在「系统设置 → 隐私与安全性」中允许打开。

## 桌面小组件与提醒

- 在桌面右键 →「编辑小组件」→ 搜索 **Planknot** → 添加。
- 从旧版 To Do List 迁移时，需要移除旧小组件，再添加 Planknot。
- 小组件刷新由 macOS 调度，任务变化不保证立即显示。
- 普通 DDL 默认提前 **1 天和 1 小时**提醒；面试默认提前 **3 天和 30 分钟**提醒。
- 提醒需要明确的时间、时区及系统通知授权；勿扰模式可能影响弹窗展示。

## 数据与隐私

任务文件默认保存在：

```text
~/Library/Application Support/Planknot/desktop-radar/store/
```

界面偏好和专注记录另存于 App 的本地 WebKit 存储。
源码公开不会公开使用者的本机任务。任务库、个人配置、邮箱扩展与凭据被 Git 忽略，
不会随正常源码提交上传。反馈问题时，也请先检查截图和日志是否包含私人信息。

**目前没有跨设备同步。** 迁移或备份时需同时考虑任务目录和 App 的本地偏好。

## 当前限制

- 仅支持 macOS；尚未提供正式安装包、Developer ID 签名和公证。
- Gmail 自动提醒依赖另外配置的本机接收器和 OAuth 授权，**不随本仓库提供**。
  下载源码不会自动接入邮箱，也不会自动用 GPT 解读邮件。
- 与 AI 助手配合更新任务，需要另外接入本机命令行工作流；App 本身不内置模型服务。

## 参与开发

源码修改后重新运行 `./develop.command`，即可构建并更新本机运行资源。
配置、目录说明和验证方法见 [贡献指南](CONTRIBUTING.md)。
版本记录见 [CHANGELOG](CHANGELOG.md)。

发现问题或有建议，欢迎提交 [Issue](https://github.com/wwx777/Planknot/issues)。
请说明 macOS 版本、操作步骤、预期与实际结果；截图请遮住个人信息。

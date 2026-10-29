# Planknot

**Plan + Knot**：把计划、资料和进展系在同一块本地看板上。任务、日历、专注计时与
Intern/PhD 申请跟踪都在一处，数据只存在你自己的 Mac 上。

## 功能

- 任务看板：新增、编辑、完成、归档，按分类与状态分组，带进度时间线和关键节点。
- 专项板块：Intern / PhD 申请各自成板，跟踪阶段、投递与回复时间、多轮面试。
- 日历：月 / 周 / 日视图，自动换算时区；DDL 与面试提前弹窗提醒。
- 专注计时：把任务点进去开始计时，带短休 / 长休。
- 桌面小组件：显示近期截止和未读进展。
- 可 DIY 分类；中英界面切换；本机数据导出。

## 快速上手（macOS 使用者）

前提：一台运行 macOS 14 或以上的 Mac。

1. 把整个文件夹解压到任意位置。
2. 双击 `setup.command`，它会自动把看板资源放到
   `~/Library/Application Support/Planknot/` 并初始化空任务库。
3. 双击 `Planknot.app` 打开。若提示“无法验证开发者”，右键 App 选「打开」，
   再在系统设置里点「仍要打开」即可。

如果只拿到 `Planknot.app` 而没有 `setup.command`，首次运行前先执行一次
`setup.command`，否则界面没有数据源会一片空白。

## 给开发者：构建

依赖：macOS、Xcode、[XcodeGen](https://github.com/yonaskolb/XcodeGen)（`brew install xcodegen`）。

```bash
cd desktop-radar/native
xcodegen generate --spec project.yml --project .
xcodebuild -project ToDoList.xcodeproj -scheme ToDoList \
  -configuration Release -destination 'platform=macOS' \
  -derivedDataPath .derivedData CODE_SIGN_IDENTITY='-' build
```

产物在 `desktop-radar/native/.derivedData/Build/Products/Release/Planknot.app`。
日常开发可在仓库根目录运行 `./develop.command`：构建当前源码、更新本机界面资源并打开
App。已有任务库与个人设置保留；运行资源默认部署到 Application Support，
可用 `TODOLIST_DATA_ROOT` 指定隔离测试目录。代码改动以此仓库为准。

从旧 App 迁移时，先备份完整 `store/`（含分类、提醒设置和历史），确保旧命令、
邮件接收器与新 App 读写同一份任务库。个人偏好和专注记录保存在 WebKit 本地存储中，
也需要迁移。更换 bundle id 后，需重新允许通知并添加新版小组件。

工程与 scheme 的内部名称仍是 `ToDoList`，用户可见名称是 `Planknot`。

## 数据与隐私

任务、分类和未读进展都保存在本机，仓库不含任何个人数据或邮箱凭据。`store/`、
`mail-trigger/`、`config.local.json` 均被 `.gitignore` 排除。

## 已知限制

- 未配置 Developer ID 签名与 notarize，分享给他人的 App 首次打开需要右键绕过
  Gatekeeper。正式分发前应换用自己的 bundle id 并签名。
- 数据是本机文件，不跨设备同步。
- 申请邮件提醒是个人扩展，依赖本机 Gmail 授权，未随本仓库分发。

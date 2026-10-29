# Planknot

**Plan + Knot**：把任务、资料与进展连接起来的本地看板。可与不同 AI 助手配合使用。

macOS 本地待办看板 + 桌面小组件。原生 App（AppKit + WebKit）加载本地 HTML 界面，通过一个小型 Python CLI 读写本地 JSON 任务库；WidgetKit 小组件直接读取同一份任务库，显示近期截止事项。

## 组成

- `Board.html`：看板界面（任务、日历、专注、设置、Intern/PhD 专项板块）。
- `desktop-radar/`：界面脚本与样式（`*.js`、`*.css`）、Python 读写层（`todoctl.py`、`app_support.py`、`mail_tracking.py`）、测试。
- `desktop-radar/native/`：macOS 原生工程（`project.yml` + XcodeGen 生成 `.xcodeproj`），含主 App 与 Widget 扩展。

## 本地构建

依赖：macOS、Xcode、XcodeGen（`brew install xcodegen`）。

```bash
cd desktop-radar/native
xcodegen generate --spec project.yml --project .
xcodebuild -project ToDoList.xcodeproj -scheme ToDoList \
  -configuration Release -destination 'platform=macOS' \
  -derivedDataPath .derivedData CODE_SIGN_IDENTITY='-' build
```

产物在 `desktop-radar/native/.derivedData/Build/Products/Release/Planknot.app`。仓库内的 `.derivedData`、`Backups/`、`ManualBuild/`、`.build/` 不提交。

## 数据目录

任务库与配置默认存放在 `desktop-radar/store/`，本仓库不含任何个人数据（`store/`、`mail-trigger/` 被 `.gitignore` 排除）。

## 本地环境配置

个人路径、bundle id 前缀、后台服务名不写进源码，放在 `desktop-radar/config.local.json`（已 git-ignore）。仓库只提交 `desktop-radar/config.example.json` 作为模板：

```json
{
  "dataRoot": "~/Library/Application Support/Planknot",
  "bundleIdPrefix": "com.example.planknot",
  "serviceLabel": "com.example.planknot.application-mail"
}
```

复制为 `config.local.json` 并改成你自己的值即可。Python 侧读取该文件；原生 App 与小组件在运行时读取 `~/Library/Application Support/Planknot/config.json`（构建脚本会从 `config.local.json` 生成 Widget 的 entitlements）。发布时把 `bundleIdPrefix` 换成你自己的域名。

## 版本

版本号由 `desktop-radar/native/project.yml` 中两个 target 的 `CFBundleShortVersionString` 与 `CFBundleVersion` 维护。发布时同步更新 `CHANGELOG.md` 并打 tag，例如：

```bash
git tag v1.2.0
```

## 发布前待办

- 数据根目录已可配置，但还需把发布版的 bundle id 换成自己的域名，并配置 Developer ID 签名 + notarize，否则他人机器上会提示“无法验证开发者”。

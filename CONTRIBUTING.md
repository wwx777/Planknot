# 参与 Planknot 开发

## 开发环境

- macOS 14+、完整 Xcode、XcodeGen、Python 3。
- Node.js：运行 JavaScript 检查时使用。
- 在仓库根目录执行 `./develop.command`，构建、部署并打开 App。
- App 和 Xcode scheme 的内部名称仍是 `ToDoList`，用户可见名称是 `Planknot`。

## 目录

| 路径 | 用途 |
| --- | --- |
| `Board.html` | 看板页面入口 |
| `desktop-radar/*.js`、`workspace-theme.css` | 界面逻辑与样式 |
| `desktop-radar/todoctl.py` | 任务读写与校验命令 |
| `desktop-radar/app_support.py` | App 运行支持 |
| `desktop-radar/native/App/` | macOS App |
| `desktop-radar/native/Widget/` | WidgetKit 小组件 |
| `desktop-radar/tests/` | 自动检查 |
| `setup.command` | 部署界面资源、初始化任务库 |
| `develop.command` | 构建与本机部署入口 |

## 本地配置

默认数据根目录为 `~/Library/Application Support/Planknot`。
个人配置不要写入源码：`desktop-radar/config.local.json` 已被 Git 忽略，
格式可参考 `desktop-radar/config.example.json`。
原生运行层读取数据根目录下的 `config.json`；它与仓库内的配置文件是不同的文件。

只验证资源部署时，可使用隔离目录，避免影响日常任务：

```bash
TODOLIST_DATA_ROOT="$(mktemp -d -t planknot-check)" ./setup.command
```

`TODOLIST_DATA_ROOT` 可用于开发 App 的自定义数据目录。
Widget 是独立进程；使用自定义目录时还需匹配其构建时沙箱授权及运行配置，
不能仅凭 App 启动成功判断 Widget 能读到同一份数据。

## 提交前验证

根据改动范围运行相关检查。Python 检查：

```bash
python3 -m unittest discover -s desktop-radar/tests -p 'test_*.py'
```

JavaScript 检查（需要 Node.js）：

```bash
for test_file in desktop-radar/tests/test_*.cjs; do
  node "$test_file" || break
done
```

涉及原生代码时运行 `./develop.command` 并实际检查 App；涉及小组件和系统通知时，
还需分别验证桌面显示和通知权限，单元检查不能代替系统验收。

## 提交与版本

- 一次提交说明一项清楚的改动，附上复现或验证方法。
- 不提交任务库、私人截图、邮箱凭据、个人路径或生成的本地沙箱授权。
- 发布时同步维护 `CHANGELOG.md` 和 `desktop-radar/native/project.yml` 中
  App / Widget 的版本号，tag 使用 `v<主>.<次>.<补丁>`。
- 正式发行还需准备安装包、签名与公证，并在一台干净的 Mac 上验收。

import SwiftUI
import WebKit
import WidgetKit
import UserNotifications
import UniformTypeIdentifiers

@main
struct ToDoListApp: App {
    @State private var windowID = UUID()
    @State private var showUpdates = false
    @State private var openTask = ""
    @State private var showFocus = false

    var body: some Scene {
        WindowGroup("Planknot", id: "board") {
            BoardWebView(showUpdates: showUpdates, openTask: openTask, showFocus: showFocus)
                .ignoresSafeArea()
                .background(WindowBackground())
                .id(windowID)
                .frame(minWidth: 860, minHeight: 640)
                .onOpenURL { url in
                    WidgetCenter.shared.reloadTimelines(ofKind: AppConfig.widgetKind)
                    NotificationCenter.default.post(name: .init("TodoRefreshRuntime"), object: nil)
                    if url.host != "refresh" {
                        openTask = URLComponents(url: url, resolvingAgainstBaseURL: false)?.queryItems?.first(where: { $0.name == "id" })?.value ?? ""
                        showUpdates = url.host == "updates"
                        showFocus = url.host == "focus"
                        windowID = UUID()
                    }
                }
                .onAppear {
                    if let iconURL = Bundle.main.url(forResource: "ToDoFinal", withExtension: "icns"),
                       let icon = NSImage(contentsOf: iconURL) {
                        NSApplication.shared.applicationIconImage = icon
                    }
                    UNUserNotificationCenter.current().delegate = InterviewNotifications.shared
                    WidgetCenter.shared.reloadTimelines(ofKind: AppConfig.widgetKind)
                }
        }
        .defaultSize(width: 1120, height: 760)
        .windowStyle(.hiddenTitleBar)
    }
}

private final class MovableBackgroundView: NSView {
    override func viewDidMoveToWindow() {
        super.viewDidMoveToWindow()
        guard let window = window else { return }
        window.titleVisibility = .hidden
        window.titlebarAppearsTransparent = true
        window.styleMask.insert(.fullSizeContentView)
        window.backgroundColor = NSColor(calibratedRed: 0.96, green: 0.957, blue: 0.941, alpha: 1)
        window.isMovableByWindowBackground = true
    }
}

private struct WindowBackground: NSViewRepresentable {
    func makeNSView(context: Context) -> NSView { MovableBackgroundView() }
    func updateNSView(_ nsView: NSView, context: Context) {}
}

struct BoardWebView: NSViewRepresentable {
    var showUpdates = false
    var openTask = ""
    var showFocus = false
    func makeNSView(context: Context) -> WKWebView {
        let taskJSON = String(data: (try? JSONSerialization.data(withJSONObject: [openTask])) ?? Data("[\"\"]".utf8), encoding: .utf8) ?? "[\"\"]"
        let configuration = WKWebViewConfiguration()
        configuration.userContentController.add(context.coordinator, name: "todoStore")
        configuration.userContentController.addUserScript(WKUserScript(
            source: "document.addEventListener('DOMContentLoaded', () => { document.getElementById('collapse')?.remove(); \(showUpdates ? "window.todoOpenUpdates?.();" : "") window.todoInitialTask = \(taskJSON)[0]; window.todoOpenInitialTask?.(); \(showFocus ? "setPage(\"focus\");" : "") });",
            injectionTime: .atDocumentStart,
            forMainFrameOnly: true
        ))
        let view = WKWebView(frame: .zero, configuration: configuration)
        view.navigationDelegate = context.coordinator
        context.coordinator.attach(view)
        let path = URL(fileURLWithPath: AppConfig.boardHTMLPath)
        view.loadFileURL(path, allowingReadAccessTo: path.deletingLastPathComponent())
        return view
    }

    func updateNSView(_ nsView: WKWebView, context: Context) {}
    func makeCoordinator() -> Coordinator { Coordinator() }

    final class Coordinator: NSObject, WKNavigationDelegate, WKScriptMessageHandler {
        private let storePath = AppConfig.storePath
        private weak var currentWebView: WKWebView?
        private var refreshObserver: NSObjectProtocol?
        private var lastRuntimeRead = Date.distantPast
        private let cliPath = AppConfig.cliPath

        func userContentController(_ userContentController: WKUserContentController,
                                   didReceive message: WKScriptMessage) {
            guard message.frameInfo.isMainFrame,
                  message.frameInfo.request.url?.isFileURL == true,
                  message.frameInfo.request.url?.path == AppConfig.boardHTMLPath,
                  message.name == "todoStore",
                  let body = message.body as? [String: Any],
                  let action = body["action"] as? String,
                  let webView = message.webView else { return }
            do {
                switch action {
                case "load":
                    refreshRuntime(webView)
                case "focusTimer":
                    guard let endsAt = body["endsAt"] as? Double, endsAt.isFinite,
                          endsAt == 0 || (endsAt > Date().timeIntervalSince1970 && endsAt <= Date().timeIntervalSince1970 + 10801),
                          let label = body["label"] as? String, label.count <= 30 else { throw StoreError.invalidMessage }
                    let taskTitle = String((body["taskTitle"] as? String ?? "").prefix(160))
                    AppServices.shared.focusTimer(endsAt: endsAt, label: label, taskTitle: taskTitle) { message in
                        DispatchQueue.main.async {
                            let json = (try? JSONSerialization.data(withJSONObject: [message])).flatMap { String(data: $0, encoding: .utf8) } ?? "[\"通知状态待核实\"]"
                            webView.evaluateJavaScript("window.todoFocusNotificationResult?.(\(json)[0]);", completionHandler: nil)
                        }
                    }
                    return
                case "searchMail", "bindMail":
                    guard let taskID = body["taskId"] as? String, !taskID.isEmpty, !taskID.hasPrefix("-") else { throw StoreError.invalidMessage }
                    var command = [action == "searchMail" ? "search-mail" : "bind-mail", "--task-id", taskID]
                    if action == "searchMail" {
                        guard let query = body["query"] as? String, (2...300).contains(query.count) else { throw StoreError.invalidMessage }
                        command.append("--query=" + query)
                    } else {
                        guard let threadID = body["threadId"] as? String, threadID.range(of: "^[a-fA-F0-9]{8,32}$", options: .regularExpression) != nil,
                              let expected = body["expectedThread"] as? String else { throw StoreError.invalidMessage }
                        command += ["--thread-id", threadID, "--expected-thread=" + expected]
                    }
                    refreshRuntime(webView, force: true, command: command)
                    return
                case "loadSettings":
                    refreshRuntime(webView, force: true)
                    return
                case "saveReminderSettings":
                    guard let enabled = body["enabled"] as? Bool, let offsets = body["offsets"] as? [Int],
                          offsets == [4320, 30] else { throw StoreError.invalidMessage }
                    if enabled {
                        UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound]) { granted, _ in
                            DispatchQueue.main.async {
                                if granted { self.refreshRuntime(webView, force: true, command: ["save", "--enabled", "true", "--offsets", "4320,30"]) }
                                else { self.sendRuntimeError("macOS 尚未允许通知。请在系统通知设置中允许 Planknot，然后再开启提醒。", to: webView) }
                            }
                        }
                    } else {
                        refreshRuntime(webView, force: true, command: ["save", "--enabled", "false", "--offsets", "4320,30"])
                    }
                    return
                case "saveTaskReminderSettings":
                    guard let deadlines = body["deadlines"] as? Bool,
                          let routine = body["routine"] as? Bool else { throw StoreError.invalidMessage }
                    let command = ["save", "--deadlines-enabled", String(deadlines), "--routine-enabled", String(routine)]
                    if deadlines || routine {
                        UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound]) { granted, _ in
                            DispatchQueue.main.async {
                                if granted { self.refreshRuntime(webView, force: true, command: command) }
                                else { self.sendRuntimeError("macOS 尚未允许通知，请在系统设置中允许 Planknot。", to: webView) }
                            }
                        }
                    } else { refreshRuntime(webView, force: true, command: command) }
                    return
                case "setCategories":
                    guard let names = body["categories"] as? [String],
                          !names.isEmpty, names.count <= 60,
                          names.allSatisfy({ $0.count <= 24 }) else { throw StoreError.invalidMessage }
                    try runCLI(["set-categories"] + names)
                case "reauthorizeMail":
                    AppServices.shared.authorize { error in
                        DispatchQueue.main.async {
                            if let error = error { self.sendRuntimeError(error, to: webView) }
                            else { self.refreshRuntime(webView, force: true) }
                        }
                    }
                    refreshRuntime(webView, force: true)
                    return
                case "openNotificationSettings":
                    NSWorkspace.shared.open(URL(string: "x-apple.systempreferences:com.apple.Notifications-Settings.extension")!)
                    return
                case "openDataFolder":
                    NSWorkspace.shared.selectFile(storePath, inFileViewerRootedAtPath: "")
                    return
                case "exportBackup":
                    let panel = NSSavePanel()
                    panel.allowedContentTypes = [.json]
                    panel.nameFieldStringValue = "Planknot-" + ISO8601DateFormatter().string(from: Date()).prefix(10) + ".json"
                    panel.begin { result in
                        if result == .OK, let url = panel.url {
                            do { try Data(contentsOf: URL(fileURLWithPath: self.storePath)).write(to: url, options: .atomic) }
                            catch { self.sendRuntimeError("备份导出失败，请检查目标文件夹权限。", to: webView) }
                        }
                    }
                    return
                case "copyPrompt":
                    guard let text = body["text"] as? String else { throw StoreError.invalidMessage }
                    NSPasteboard.general.clearContents()
                    NSPasteboard.general.setString(text, forType: .string)
                    webView.evaluateJavaScript("window.todoCopied?.();")
                    return
                case "ackUpdates":
                    guard let ids = body["ids"] as? [String], !ids.isEmpty,
                          ids.allSatisfy({ !$0.isEmpty && !$0.hasPrefix("-") }) else {
                        throw StoreError.invalidMessage
                    }
                    try runCLI(["ack"] + ids)
                    WidgetCenter.shared.reloadTimelines(ofKind: AppConfig.widgetKind)
                case "setCompleted":
                    guard let id = body["id"] as? String,
                          let completed = body["completed"] as? Bool else {
                        throw StoreError.invalidMessage
                    }
                    try runCLI([completed ? "complete" : "reopen", id])
                case "add":
                    guard let task = body["task"] as? [String: Any],
                          let title = task["title"] as? String,
                          !title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
                        throw StoreError.invalidMessage
                    }
                    var arguments = ["add", "--title", title]
                    append("--category", value: task["category"], to: &arguments)
                    append("--lane", value: task["lane"], to: &arguments)
                    append("--detail", value: task["detail"], to: &arguments)
                    append("--due", value: task["due"], to: &arguments)
                    append("--source", value: task["source"], to: &arguments)
                    appendProjectFields(task, to: &arguments)
                    try runCLI(arguments)
                case "update":
                    guard let id = body["id"] as? String,
                          let task = body["task"] as? [String: Any] else {
                        throw StoreError.invalidMessage
                    }
                    var arguments = ["update", id]
                    append("--title", value: task["title"], to: &arguments)
                    append("--category", value: task["category"], to: &arguments)
                    append("--lane", value: task["lane"], to: &arguments)
                    append("--detail", value: task["detail"], to: &arguments)
                    append("--due", value: task["due"], to: &arguments)
                    append("--source", value: task["source"], to: &arguments)
                    appendProjectFields(task, to: &arguments)
                    try runCLI(arguments)
                case "setArchived":
                    guard let id = body["id"] as? String,
                          let archived = body["archived"] as? Bool else {
                        throw StoreError.invalidMessage
                    }
                    try runCLI([archived ? "archive" : "unarchive", id])
                case "addTimeline":
                    guard let id = body["id"] as? String,
                          let title = body["title"] as? String,
                          !title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
                        throw StoreError.invalidMessage
                    }
                    if body["milestone"] as? Bool == true {
                        var arguments = ["milestone", id, "--title", title]
                        append("--date", value: body["date"], to: &arguments)
                        try runCLI(arguments)
                    } else {
                        try runCLI(["note", id, "--text", title])
                    }
                case "milestoneDone":
                    guard let id = body["id"] as? String,
                          let title = body["title"] as? String else {
                        throw StoreError.invalidMessage
                    }
                    try runCLI(["milestone-done", id, "--title", title])
                default:
                    throw StoreError.invalidMessage
                }
                sendStore(to: webView)
                if action != "load" { refreshRuntime(webView, force: true) }
            } catch {
                sendError(error.localizedDescription, to: webView)
            }
        }

        func attach(_ webView: WKWebView) {
            currentWebView = webView
            refreshObserver = NotificationCenter.default.addObserver(forName: .init("TodoRefreshRuntime"), object: nil, queue: .main) { [weak self] _ in
                guard let self = self, let view = self.currentWebView else { return }
                self.sendStore(to: view)
                self.refreshRuntime(view, force: true)
            }
        }

        deinit { if let observer = refreshObserver { NotificationCenter.default.removeObserver(observer) } }

        private func refreshRuntime(_ view: WKWebView, force: Bool = false, command: [String] = ["status"]) {
            guard force || Date().timeIntervalSince(lastRuntimeRead) >= 30 else { return }
            lastRuntimeRead = Date()
            AppServices.shared.runtime(command) { result in
                DispatchQueue.main.async {
                    switch result {
                    case .success(let data):
                        if let encoded = String(data: data, encoding: .utf8) { view.evaluateJavaScript("window.todoRuntimeReceive?.(\(encoded));") }
                    case .failure(_): self.sendRuntimeError("无法读取本机连接与提醒状态，请稍后刷新。", to: view)
                    }
                }
            }
        }

        private func sendRuntimeError(_ message: String, to view: WKWebView) {
            let encoded = (try? JSONSerialization.data(withJSONObject: [message])).flatMap { String(data: $0, encoding: .utf8) } ?? "[]"
            view.evaluateJavaScript("window.todoRuntimeError?.(\(encoded)[0]);")
        }

        private func append(_ flag: String, value: Any?, to arguments: inout [String]) {
            guard let text = value as? String else { return }
            arguments.append(contentsOf: [flag, text])
        }

        private func appendProjectFields(_ task: [String: Any], to arguments: inout [String]) {
            for (key, flag) in [
                ("kind", "--kind"), ("project", "--project"), ("stage", "--stage"),
                ("contact", "--contact"), ("submittedAt", "--submitted-at"),
                ("reply", "--reply"), ("replyCheckedAt", "--reply-checked-at"),
                ("followUp", "--follow-up"), ("endedAt", "--ended-at"),
                ("endReason", "--end-reason"), ("interviewsJson", "--interviews-json"),
                ("linksJson", "--links-json")
            ] {
                append(flag, value: task[key], to: &arguments)
            }
        }

        private func runCLI(_ command: [String]) throws {
            let process = Process()
            process.executableURL = URL(fileURLWithPath: "/usr/bin/python3")
            process.arguments = [cliPath, "--store", storePath, "--by", "Planknot App"] + command
            let output = Pipe()
            process.standardOutput = output
            process.standardError = output
            try process.run()
            let data = output.fileHandleForReading.readDataToEndOfFile()
            process.waitUntilExit()
            guard process.terminationStatus == 0 else {
                let message = String(data: data, encoding: .utf8) ?? "任务库写入失败"
                throw StoreError.commandFailed(message)
            }
        }

        private func sendStore(to webView: WKWebView) {
            do {
                let process = Process()
                process.executableURL = URL(fileURLWithPath: "/usr/bin/python3")
                process.arguments = [cliPath, "--store", storePath, "--by", "Planknot App", "list", "--json"]
                let output = Pipe()
                process.standardOutput = output
                process.standardError = FileHandle.nullDevice
                try process.run()
                let data = output.fileHandleForReading.readDataToEndOfFile()
                process.waitUntilExit()
                guard process.terminationStatus == 0,
                      let json = String(data: data, encoding: .utf8) else {
                    throw StoreError.invalidStore
                }
                webView.evaluateJavaScript("window.todoStoreReceive(\(json));")
            } catch {
                sendError(error.localizedDescription, to: webView)
            }
        }

        private func sendError(_ message: String, to webView: WKWebView) {
            let data = try? JSONSerialization.data(withJSONObject: [message])
            let encoded = data.flatMap { String(data: $0, encoding: .utf8) } ?? "[\"任务库错误\"]"
            webView.evaluateJavaScript("window.todoStoreError(\(encoded)[0]);")
        }

        func webView(_ webView: WKWebView, decidePolicyFor action: WKNavigationAction,
                     decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
            if action.navigationType == .linkActivated, let url = action.request.url {
                NSWorkspace.shared.open(url)
                decisionHandler(.cancel)
            } else {
                decisionHandler(.allow)
            }
        }
    }
}

private enum StoreError: LocalizedError {
    case invalidMessage
    case invalidStore
    case commandFailed(String)

    var errorDescription: String? {
        switch self {
        case .invalidMessage: return "任务更新参数无效"
        case .invalidStore: return "任务库 JSON 无效"
        case .commandFailed(let message): return message
        }
    }
}


// All planning operations run on one queue so edits cannot race a prior schedule.
private final class AppServices {
    static let shared = AppServices()
    private let root = AppConfig.radarRoot
    private let queue = DispatchQueue(label: AppConfig.queueLabel)
    private var authorizationProcess: Process?
    private var lastPlan: Data?

    func focusTimer(endsAt: Double, label: String, taskTitle: String, completion: @escaping (String) -> Void) {
        queue.async {
            let center = UNUserNotificationCenter.current()
            let identifier = "focus.current"
            center.removePendingNotificationRequests(withIdentifiers: [identifier])
            guard endsAt > Date().timeIntervalSince1970 else { completion(""); return }
            let wait = DispatchSemaphore(value: 0)
            var allowed = false
            center.getNotificationSettings { settings in
                allowed = settings.authorizationStatus == .authorized || settings.authorizationStatus == .provisional
                wait.signal()
            }
            guard wait.wait(timeout: .now() + 5) == .success, allowed else {
                completion("计时继续；系统通知未允许，请在设置页打开系统通知设置。"); return
            }
            let content = UNMutableNotificationContent()
            content.title = label == "专注" ? "本轮专注完成" : "休息结束"
            content.body = taskTitle + (label == "专注" ? " · 辛苦了，起身活动一下吧。" : " · 准备好后，开始下一轮专注。")
            content.sound = .default
            content.userInfo = ["focus": true]
            let trigger = UNTimeIntervalNotificationTrigger(timeInterval: max(1, endsAt - Date().timeIntervalSince1970), repeats: false)
            let added = DispatchSemaphore(value: 0)
            var failed = false
            center.add(UNNotificationRequest(identifier: identifier, content: content, trigger: trigger)) { error in
                failed = error != nil; added.signal()
            }
            if added.wait(timeout: .now() + 5) != .success || failed { completion("计时继续；系统提醒未能排定，请暂停后继续重试。") }
            else { completion("到点会通过系统通知提醒，切换页面或关闭 App 也会继续计时。") }
        }
    }

    func runtime(_ command: [String], completion: @escaping (Result<Data, Error>) -> Void) {
        queue.async {
            do {
                let process = Process(), output = Pipe()
                let mailPython = self.root + "/mail-trigger/.venv/bin/python"
                process.executableURL = URL(fileURLWithPath: FileManager.default.isExecutableFile(atPath: mailPython) ? mailPython : "/usr/bin/python3")
                process.arguments = [self.root + "/app_support.py"] + command
                process.standardOutput = output
                process.standardError = FileHandle.nullDevice
                try process.run()
                let data = output.fileHandleForReading.readDataToEndOfFile()
                process.waitUntilExit()
                guard process.terminationStatus == 0, var value = try JSONSerialization.jsonObject(with: data) as? [String: Any] else { throw StoreError.invalidStore }
                self.reconcileNotifications(&value)
                completion(.success(try JSONSerialization.data(withJSONObject: value)))
            } catch { completion(.failure(error)) }
        }
    }

    private func reconcileNotifications(_ value: inout [String: Any]) {
        let center = UNUserNotificationCenter.current()
        let settingsWait = DispatchSemaphore(value: 0)
        var permission: UNAuthorizationStatus = .notDetermined
        center.getNotificationSettings { settings in permission = settings.authorizationStatus; settingsWait.signal() }
        guard settingsWait.wait(timeout: .now() + 5) == .success else { value["notificationPermission"] = "unknown"; return }
        let names: [UNAuthorizationStatus: String] = [.authorized: "authorized", .denied: "denied", .notDetermined: "notDetermined", .provisional: "provisional"]
        value["notificationPermission"] = names[permission] ?? "unknown"
        let prefs = value["preferences"] as? [String: Any] ?? [:]
        let allowed = permission == .authorized || permission == .provisional
        let interviews = prefs["interviewReminders"] as? Bool == true ? (value["reminders"] as? [[String: Any]] ?? []) : []
        let deadlines = value["deadlinePlan"] as? [[String: Any]] ?? []
        let routines = value["routinePlan"] as? [[String: Any]] ?? []
        let timed = (interviews + deadlines).sorted { ($0["fireAt"] as? Double ?? 0) < ($1["fireAt"] as? Double ?? 0) }
        let plan = allowed ? routines + Array(timed.prefix(max(0, 60 - routines.count))) : []
        value["reminderOverflow"] = max(0, timed.count + routines.count - 60)
        let signature = try? JSONSerialization.data(withJSONObject: plan, options: .sortedKeys)
        let wait = DispatchSemaphore(value: 0)
        var pending: [UNNotificationRequest] = []
        center.getPendingNotificationRequests { pending = $0; wait.signal() }
        guard wait.wait(timeout: .now() + 5) == .success else { return }
        let own = pending.filter { Self.ownsReminder($0.identifier) }
        let desiredIDs = Set(plan.compactMap { $0["id"] as? String })
        if signature != lastPlan || Set(own.map { $0.identifier }) != desiredIDs {
            center.removePendingNotificationRequests(withIdentifiers: own.map { $0.identifier })
            let group = DispatchGroup()
            let errors = NSLock()
            var failed = false
            for item in plan {
                guard let id = item["id"] as? String else { continue }
                let content = UNMutableNotificationContent()
                content.title = item["title"] as? String ?? "面试提醒"
                content.body = item["body"] as? String ?? ""
                content.sound = .default
                content.userInfo = ["taskId": item["taskId"] as? String ?? ""]
                let trigger: UNNotificationTrigger
                if id.hasPrefix("routine."), let hour = item["hour"] as? Int, let minute = item["minute"] as? Int,
                   let zoneName = item["timezone"] as? String, let zone = TimeZone(identifier: zoneName) {
                    var components = DateComponents()
                    components.calendar = Calendar(identifier: .gregorian)
                    components.timeZone = zone
                    components.hour = hour
                    components.minute = minute
                    trigger = UNCalendarNotificationTrigger(dateMatching: components, repeats: true)
                } else if let time = item["fireAt"] as? Double, time > Date().timeIntervalSince1970 {
                    trigger = UNTimeIntervalNotificationTrigger(timeInterval: max(1, time - Date().timeIntervalSince1970), repeats: false)
                } else { continue }
                group.enter()
                center.add(UNNotificationRequest(identifier: id, content: content, trigger: trigger)) { error in
                    if error != nil { errors.lock(); failed = true; errors.unlock() }
                    group.leave()
                }
            }
            let completed = group.wait(timeout: .now() + 5) == .success
            if completed && !failed { lastPlan = signature }
            else { value["notificationWarning"] = "部分提醒未能排入系统，请刷新重试。" }
        }
        let finalWait = DispatchSemaphore(value: 0)
        var final: [UNNotificationRequest] = []
        center.getPendingNotificationRequests { final = $0.filter { Self.ownsReminder($0.identifier) }; finalWait.signal() }
        _ = finalWait.wait(timeout: .now() + 5)
        value["scheduledCount"] = final.filter { $0.identifier.hasPrefix("interview.") }.count
        value["deadlineScheduledCount"] = final.filter { $0.identifier.hasPrefix("deadline.") }.count
        value["routineScheduledCount"] = final.filter { $0.identifier.hasPrefix("routine.") }.count
        value["scheduledReminders"] = final.map { request -> [String: Any] in
            var row: [String: Any] = ["id": request.identifier, "title": request.content.title, "repeats": request.trigger?.repeats ?? false]
            if let next = (request.trigger as? UNCalendarNotificationTrigger)?.nextTriggerDate() { row["nextAt"] = ISO8601DateFormatter().string(from: next) }
            return row
        }
    }

    private static func ownsReminder(_ id: String) -> Bool {
        ["interview.", "deadline.", "routine."].contains { id.hasPrefix($0) }
    }

    func authorize(completion: @escaping (String?) -> Void) {
        guard authorizationProcess?.isRunning != true else { completion("授权已在浏览器中进行，请完成该页面。"); return }
        let process = Process()
        process.executableURL = URL(fileURLWithPath: root + "/mail-trigger/.venv/bin/python")
        process.arguments = [root + "/mail-trigger/receiver.py", "authorize", "--open-browser"]
        process.standardOutput = FileHandle.nullDevice
        process.standardError = FileHandle.nullDevice
        process.terminationHandler = { completed in
            if completed.terminationStatus == 0 {
                let restart = Process()
                restart.executableURL = URL(fileURLWithPath: "/bin/launchctl")
                restart.arguments = ["kickstart", "-k", "gui/\(getuid())/\(AppConfig.serviceLabel)"]
                do { try restart.run(); restart.waitUntilExit() } catch { completion("授权成功，但后台未能重启，请刷新状态后检查。"); return }
                completion(nil)
            } else { completion("授权未完成或已取消，旧授权保留。请刷新查看状态后重试。"); }
        }
        do { try process.run(); authorizationProcess = process }
        catch { completion("无法启动浏览器授权，请检查本机接收器文件。"); }
    }
}

private final class InterviewNotifications: NSObject, UNUserNotificationCenterDelegate {
    static let shared = InterviewNotifications()
    func userNotificationCenter(_ center: UNUserNotificationCenter, willPresent notification: UNNotification, withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void) {
        completionHandler([.banner, .sound])
    }
    func userNotificationCenter(_ center: UNUserNotificationCenter, didReceive response: UNNotificationResponse, withCompletionHandler completionHandler: @escaping () -> Void) {
        if response.notification.request.content.userInfo["focus"] as? Bool == true {
            DispatchQueue.main.async { NSWorkspace.shared.open(URL(string: "todolist://focus")!) }
        } else if let id = response.notification.request.content.userInfo["taskId"] as? String {
            var url = URLComponents(string: "todolist://task")!
            url.queryItems = [URLQueryItem(name: "id", value: id)]
            DispatchQueue.main.async { if let target = url.url { NSWorkspace.shared.open(target) } }
        }
        completionHandler()
    }
}

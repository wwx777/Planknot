import AppKit
import WebKit

final class DeskRadarApp: NSObject, NSApplicationDelegate, WKScriptMessageHandler, WKNavigationDelegate {
    private var window: NSWindow!
    private var webView: WKWebView!
    private var statusItem: NSStatusItem!
    private let desktopLevel = NSWindow.Level(rawValue: Int(CGWindowLevelForKey(.desktopIconWindow)) + 1)

    func applicationDidFinishLaunching(_ notification: Notification) {
        let config = WKWebViewConfiguration()
        config.userContentController.add(self, name: "deskRadar")
        config.userContentController.addUserScript(
            WKUserScript(source: "window.__DESK_RADAR_NATIVE__ = true;", injectionTime: .atDocumentStart, forMainFrameOnly: true)
        )

        webView = WKWebView(frame: .zero, configuration: config)
        webView.navigationDelegate = self

        window = NSWindow(
            contentRect: NSRect(x: 0, y: 0, width: 356, height: 440),
            styleMask: [.borderless],
            backing: .buffered,
            defer: false
        )
        window.title = "Planknot"
        window.isReleasedWhenClosed = false
        window.level = desktopLevel
        window.collectionBehavior = [.canJoinAllSpaces, .fullScreenAuxiliary]
        window.backgroundColor = .white
        window.hasShadow = true
        window.contentView = webView
        placeMiniWindow()
        window.makeKeyAndOrderFront(nil)

        statusItem = NSStatusBar.system.statusItem(withLength: NSStatusItem.squareLength)
        statusItem.button?.title = "◉"
        let menu = NSMenu()
        menu.addItem(NSMenuItem(title: "显示Planknot", action: #selector(showWidget), keyEquivalent: ""))
        menu.addItem(NSMenuItem.separator())
        menu.addItem(NSMenuItem(title: "退出Planknot", action: #selector(quitApp), keyEquivalent: "q"))
        menu.items.first?.target = self
        menu.items.last?.target = self
        statusItem.menu = menu

        let workspace = Bundle.main.bundleURL.deletingLastPathComponent().deletingLastPathComponent()
        let page = workspace.appendingPathComponent("跨分类进度看板.html")
        webView.loadFileURL(page, allowingReadAccessTo: workspace)
    }

    private func placeMiniWindow() {
        let screen = NSScreen.main?.visibleFrame ?? NSRect(x: 0, y: 0, width: 1440, height: 900)
        window.setFrame(NSRect(x: screen.maxX - 386, y: screen.maxY - 470, width: 356, height: 440), display: true)
    }

    @objc private func showWidget() {
        window.orderFrontRegardless()
    }

    @objc private func quitApp() {
        NSApp.terminate(nil)
    }

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard let body = message.body as? [String: Any], let action = body["action"] as? String else { return }
        let screen = window.screen?.visibleFrame ?? NSScreen.main?.visibleFrame ?? NSRect(x: 0, y: 0, width: 1440, height: 900)
        if action == "expand" {
            let width = min(1180, screen.width - 50)
            let height = min(790, screen.height - 50)
            window.styleMask = [.titled, .closable, .miniaturizable, .resizable, .fullSizeContentView]
            window.titleVisibility = .hidden
            window.titlebarAppearsTransparent = true
            window.level = .normal
            window.setFrame(NSRect(x: screen.midX - width / 2, y: screen.midY - height / 2, width: width, height: height), display: true, animate: true)
            window.makeKeyAndOrderFront(nil)
            NSApp.activate(ignoringOtherApps: true)
        } else if action == "collapse" {
            window.styleMask = [.borderless]
            window.level = desktopLevel
            placeMiniWindow()
            window.orderFrontRegardless()
        }
    }

    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        guard navigationAction.navigationType == .linkActivated, let url = navigationAction.request.url else {
            decisionHandler(.allow)
            return
        }
        NSWorkspace.shared.open(url)
        decisionHandler(.cancel)
    }

    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool { true }
}

let app = NSApplication.shared
let delegate = DeskRadarApp()
app.delegate = delegate
app.setActivationPolicy(.accessory)
app.run()

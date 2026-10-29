import Foundation

/// Local environment values. The source tree only ships config.example.json;
/// config.local.json is git-ignored. At runtime the app reads Application Support
/// config.json (or environment variables) so no personal paths live in code.
enum AppConfig {
    private static let configURL = FileManager.default
        .urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
        .appendingPathComponent("Planknot")
        .appendingPathComponent("config.json")

    private static let values: [String: String] = {
        guard let data = try? Data(contentsOf: configURL),
              let obj = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
            return [:]
        }
        return obj.reduce(into: [:]) { result, item in
            result[item.key] = String(describing: item.value)
        }
    }()

    private static func string(_ key: String, env: String?, fallback: String) -> String {
        if let env,
           let value = ProcessInfo.processInfo.environment[env],
           !value.isEmpty { return value }
        if let value = values[key], !value.isEmpty { return value }
        return fallback
    }

    static var dataRoot: String {
        let raw = string("dataRoot", env: "TODOLIST_DATA_ROOT",
                         fallback: "~/Library/Application Support/Planknot")
        return (raw as NSString).expandingTildeInPath
    }

    static var bundleIdPrefix: String {
        string("bundleIdPrefix", env: "TODOLIST_BUNDLE_PREFIX", fallback: "com.example.planknot")
    }

    static var serviceLabel: String {
        string("serviceLabel", env: "TODOLIST_SERVICE_LABEL",
               fallback: "com.example.planknot.application-mail")
    }

    static var boardHTMLPath: String { dataRoot + "/跨分类进度看板.html" }
    static var storePath: String { dataRoot + "/desktop-radar/store/tasks.json" }
    static var cliPath: String { dataRoot + "/desktop-radar/todoctl.py" }
    static var radarRoot: String { dataRoot + "/desktop-radar" }
    static var widgetKind: String { bundleIdPrefix + ".ToDoList.board" }
    static var queueLabel: String { bundleIdPrefix + ".ToDoList.services" }
}

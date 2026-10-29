import SwiftUI
import WidgetKit

private enum Palette {
    static let blue = Color(red: 0.22, green: 0.40, blue: 0.35)
    static let blueSoft = Color(red: 0.91, green: 0.95, blue: 1.00)
    static let yellow = Color(red: 1.00, green: 0.75, blue: 0.20)
    static let urgent = Color(red: 0.93, green: 0.31, blue: 0.28)
    static let ink = Color(red: 0.12, green: 0.15, blue: 0.20)
    static let muted = Color(red: 0.45, green: 0.49, blue: 0.56)
    static let paper = Color(red: 0.96, green: 0.957, blue: 0.941)
}

struct BoardEntry: TimelineEntry {
    let date: Date
    let tasks: [StoredTask]
    let revision: Int
    let openCount: Int
    var updates: [StoredUpdate] = []
    var unreadCount: Int = 0
}

struct BoardProvider: TimelineProvider {
    private let storeURL = URL(fileURLWithPath: AppConfig.storePath)

    func placeholder(in context: Context) -> BoardEntry { fallbackEntry() }
    func getSnapshot(in context: Context, completion: @escaping (BoardEntry) -> Void) {
        completion(loadEntry())
    }
    func getTimeline(in context: Context, completion: @escaping (Timeline<BoardEntry>) -> Void) {
        let entry = loadEntry()
        completion(Timeline(entries: [entry], policy: .after(Date().addingTimeInterval(300))))
    }

    private func loadEntry() -> BoardEntry {
        guard let data = try? Data(contentsOf: storeURL),
              let store = try? JSONDecoder().decode(TaskStore.self, from: data) else {
            return fallbackEntry()
        }
        let open = store.tasks.filter { !$0.completed && $0.archived != true }
        let ranked = WidgetPriority.ranked(open, now: .now)
        return BoardEntry(date: .now, tasks: Array(ranked.prefix(3)),
                          revision: store.revision, openCount: open.count,
                          updates: Array((store.alerts ?? []).filter { $0.readAt == nil || $0.readAt == "" }.reversed().prefix(2)),
                          unreadCount: (store.alerts ?? []).filter { $0.readAt == nil || $0.readAt == "" }.count)
    }

    private func fallbackEntry() -> BoardEntry {
        BoardEntry(date: .now, tasks: [], revision: 0, openCount: 0)
    }
}

struct TaskStore: Decodable {
    let revision: Int
    let tasks: [StoredTask]
    let alerts: [StoredUpdate]?
}

struct StoredUpdate: Decodable, Identifiable {
    let id: String
    let taskId: String
    let taskTitle: String?
    let title: String
    let text: String
    let readAt: String?
}

struct StoredTask: Decodable, Identifiable {
    let id: String
    let title: String
    let due: String
    let risk: String
    let lane: String
    let completed: Bool
    var archived: Bool? = nil
    var kind: String? = nil
}

// Foundation-only selection logic is also exercised by the isolated Swift checks.
struct WidgetDeadline {
    let date: Date
    let hasTime: Bool
    let isGoal: Bool
}

enum WidgetPriority {
    static let zone = TimeZone(identifier: "Europe/Paris")!
    static func deadline(_ text: String) -> WidgetDeadline? {
        // Only parse an explicit leading date, never an expiry hidden in prose.
        let pattern = #"^\s*(\d{4})-(\d{2})-(\d{2})(?:[ T]+(\d{2}):(\d{2}))?"#
        guard let regex = try? NSRegularExpression(pattern: pattern),
              let match = regex.firstMatch(in: text, range: NSRange(text.startIndex..., in: text)) else { return nil }
        func number(_ index: Int) -> Int? {
            guard let range = Range(match.range(at: index), in: text) else { return nil }
            return Int(text[range])
        }
        guard let y = number(1), let m = number(2), let d = number(3) else { return nil }
        let hasTime = number(4) != nil
        // A named source timezone is required for clock times; unknown times are not guessed.
        let zonePattern = #"[A-Za-z_]+/[A-Za-z_]+(?:/[A-Za-z_]+)?"#
        let named = text.range(of: zonePattern, options: .regularExpression).flatMap { TimeZone(identifier: String(text[$0])) }
        let uncertain = text.contains("时区未知") || text.contains("时区未明示") || text.contains("时区未注明")
        if hasTime && (named == nil || uncertain) { return nil }
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = named ?? zone
        let hour = number(4) ?? 23, minute = number(5) ?? 59
        guard hour < 24, minute < 60,
              let date = calendar.date(from: DateComponents(year: y, month: m, day: d, hour: hour, minute: minute)),
              calendar.component(.year, from: date) == y,
              calendar.component(.month, from: date) == m,
              calendar.component(.day, from: date) == d else { return nil }
        return WidgetDeadline(date: date, hasTime: hasTime,
                              isGoal: text.contains("非官方") || text.contains("用户目标"))
    }

    static func ranked(_ tasks: [StoredTask], now: Date) -> [StoredTask] {
        func key(_ task: StoredTask) -> (Int, Date, Int, String) {
            let deadline = deadline(task.due)
            let urgent = task.risk == "urgent"
            let group: Int
            if urgent { group = 0 }
            else if let deadline, !deadline.isGoal, deadline.date >= now { group = 1 }
            else if let deadline, !deadline.isGoal { group = 2 }
            else if let deadline, deadline.isGoal, deadline.date >= now { group = 3 }
            else if deadline != nil { group = 4 }
            else { group = task.risk == "watch" ? 5 : 6 }
            return (group, deadline?.date ?? .distantFuture, task.risk == "watch" ? 0 : 1, task.id)
        }
        return tasks.filter { !$0.completed && $0.archived != true && $0.kind != "board" }
            .sorted { key($0) < key($1) }
    }

    static func label(_ task: StoredTask, now: Date) -> String {
        guard let deadline = deadline(task.due) else { return task.due }
        var calendar = Calendar(identifier: .gregorian); calendar.timeZone = zone
        let days = calendar.dateComponents([.day], from: calendar.startOfDay(for: now), to: calendar.startOfDay(for: deadline.date)).day ?? 0
        let relative: String
        if deadline.date < now { relative = deadline.isGoal ? "原目标日期已过" : "日期已过 · 待处理" }
        else if days == 0 { relative = "今天" }
        else if days == 1 { relative = "明天" }
        else { relative = "\(days) 天后" }
        let formatter = DateFormatter(); formatter.timeZone = zone
        formatter.dateFormat = deadline.hasTime ? "MM-dd HH:mm" : "MM-dd"
        return relative + " · " + formatter.string(from: deadline.date) + (deadline.isGoal ? " · 目标" : "")
    }
}

struct BoardWidgetView: View {
    @Environment(\.widgetFamily) private var family
    let entry: BoardEntry

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            header
            Spacer(minLength: 10)
            if family == .systemSmall {
                if let first = entry.tasks.first {
                    task(first)
                } else {
                    Text("暂无待处理事项").font(.system(size: 12)).foregroundStyle(Palette.muted)
                }
                Spacer(minLength: 8)
                footer
            } else {
                ForEach(Array(entry.tasks.prefix(3).enumerated()), id: \.element.id) { index, item in
                    if index > 0 { Divider().opacity(0.55).padding(.vertical, 8) }
                    task(item)
                }
                Spacer(minLength: 12)
                footer
            }
        }
        .padding(16)
        .containerBackground(entry.unreadCount > 0 ? Color(red: 1, green: 0.94, blue: 0.91) : Palette.paper, for: .widget)
        .widgetURL(URL(string: "todolist://board"))
    }

    private var header: some View {
        HStack(alignment: .top) {
            VStack(alignment: .leading, spacing: 3) {
                Text("近期截止")
                    .font(.system(size: 18, weight: .bold, design: .rounded))
                    .foregroundStyle(entry.unreadCount > 0 ? Palette.urgent : Palette.ink)
                Text(entry.unreadCount > 0 ? "● \(entry.unreadCount) 条新进展 · 点击看板查看" : "按日期排序 · 巴黎时间")
                    .font(.system(size: 11, weight: .medium))
                    .foregroundStyle(Palette.muted)
            }
            Spacer()
            Image("ToDoLogoTickStyleNoBorderPreview")
                .resizable()
                .scaledToFit()
                .frame(width: 34, height: 34)
        }
    }

    private func task(_ item: StoredTask) -> some View {
        HStack(alignment: .top, spacing: 9) {
            Circle()
                .stroke(item.risk == "urgent" ? Palette.urgent : Palette.blue, lineWidth: 1.6)
                .frame(width: 16, height: 16)
                .padding(.top, 1)
            VStack(alignment: .leading, spacing: 3) {
                Text(item.title)
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(Palette.ink)
                    .lineLimit(1)
                Text(WidgetPriority.label(item, now: entry.date))
                    .font(.system(size: 10))
                    .foregroundStyle(Palette.muted)
                    .lineLimit(1)
            }
            Spacer(minLength: 0)
        }
    }

    private var footer: some View {
        HStack {
            HStack(spacing: 5) {
                Circle().fill(Palette.yellow).frame(width: 6, height: 6)
                Text(entry.revision > 0 ? "共享修订 · \(entry.revision)" : "等待共享任务库")
            }
                .font(.system(size: 10))
                .foregroundStyle(Palette.muted)
            Spacer()
            Image(systemName: "arrow.up.right")
                .font(.system(size: 10, weight: .bold))
                .foregroundStyle(Palette.blue)
        }
    }
}

@main
struct ToDoListWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: AppConfig.widgetKind, provider: BoardProvider()) { entry in
            BoardWidgetView(entry: entry)
        }
        .configurationDisplayName("Planknot")
        .description("在桌面查看跨分类事项，点击打开详细看板。")
        .supportedFamilies([.systemSmall, .systemMedium])
    }
}

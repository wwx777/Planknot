"""Exercise the exact Foundation-only widget selection code with isolated tasks."""
from pathlib import Path
import subprocess
import tempfile
import unittest

class WidgetPriorityTests(unittest.TestCase):
    def test_deadlines_and_unread_independent_selection(self):
        root=Path(__file__).resolve().parents[1]
        source=(root/'native/Widget/ToDoListWidget.swift').read_text()
        model=source[source.index('struct StoredTask:'):source.index('struct BoardWidgetView:')]
        checks=r'''
let now = ISO8601DateFormatter().date(from:"2026-10-27T10:00:00Z")!
func task(_ id: String, _ due: String, risk: String = "", completed: Bool = false, kind: String? = nil) -> StoredTask {
    StoredTask(id:id,title:id,due:due,risk:risk,lane:"待核实",completed:completed,kind:kind)
}
let tasks = [task("uncertain", "未设置", risk:"watch"),
 task("oldGoal", "2026-10-22 · Europe/Paris（非官方提交 DDL）",risk:"watch"),
 task("board", "2026-10-28 · Europe/Paris",kind:"board"),
 task("done", "2026-10-27 · Europe/Paris",completed:true),
 task("later", "2026-12-16 · Europe/Paris"),
 task("registration", "2026-11-01 23:59 CET · Europe/Paris（注册截止）")]
let ranked = WidgetPriority.ranked(tasks,now:now)
assert(ranked.first!.id == "registration", "Nearest deadline must outrank undated verification and old goals")
assert(!ranked.contains(where:{$0.id=="board" || $0.id=="done"}))
assert(WidgetPriority.ranked(tasks+[task("manual","未设置",risk:"urgent")],now:now).first!.id == "manual")
assert(WidgetPriority.deadline("2026-02-30 · Europe/Paris") == nil)
assert(WidgetPriority.deadline("30 天内；证明有效至 2027-01-10") == nil)
assert(WidgetPriority.deadline("2026-10 月底；精确日期未知") == nil)
assert(WidgetPriority.deadline("2026-11-01 23:59（时区未知）") == nil)
assert(WidgetPriority.label(tasks.last!,now:now).contains("5 天后"))
assert(WidgetPriority.label(tasks[1],now:now).contains("原目标日期已过"))
let actual = try! JSONDecoder().decode([StoredTask].self,from:Data(contentsOf:URL(fileURLWithPath:CommandLine.arguments[1])))
print("Widget top three: " + WidgetPriority.ranked(actual,now:now).prefix(3).map(\.id).joined(separator:", "))
'''
        import json
        folder=Path(tempfile.mkdtemp(prefix='widget-ranking-check-'))
        script=folder/'checks.swift';script.write_text('import Foundation\n'+model+'\n'+checks)
        fixture=folder/'tasks.json';fixture.write_text(json.dumps([]))
        result=subprocess.run(['swift','-module-cache-path',str(folder/'cache'),str(script),str(fixture)],capture_output=True,text=True,timeout=90)
        self.assertEqual(result.returncode,0,result.stderr)
        print(result.stdout.strip())

if __name__=='__main__':unittest.main()

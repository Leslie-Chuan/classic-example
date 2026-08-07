import { getAllDays, getCalendarData, getStats } from "@/lib/content";
import ProgressCalendar from "@/components/ProgressCalendar";
import SkillMatrix from "@/components/SkillMatrix";
import DayCard from "@/components/DayCard";

export default function Home() {
  const stats = getStats();
  const calendarData = getCalendarData();
  const allDays = getAllDays();
  const recentDays = allDays.slice(-8).reverse();

  return (
    <div className="space-y-10">
      {/* Hero Stats */}
      <section>
        <h1 className="text-2xl font-bold mb-1">学习仪表盘</h1>
        <p className="text-zinc-500 text-sm mb-6">Day {stats.currentDay} / {stats.totalDays} — 坚持就是胜利</p>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="已完成天数" value={stats.completedDays} suffix="天" />
          <StatCard label="总进度" value={stats.progressPercent} suffix="%" />
          <StatCard label="当前 Day" value={stats.currentDay} />
          <StatCard label="连续打卡" value={stats.streakDays} suffix="天" highlight />
        </div>
      </section>

      {/* Progress Bar */}
      <section>
        <div className="flex items-center justify-between text-sm mb-2">
          <span className="text-zinc-400">总体进度</span>
          <span className="text-emerald-400 font-mono">{stats.completedDays}/{stats.totalDays}</span>
        </div>
        <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-emerald-600 to-emerald-400 rounded-full transition-all"
            style={{ width: `${stats.progressPercent}%` }}
          />
        </div>
      </section>

      {/* Calendar */}
      <section className="p-6 rounded-2xl bg-zinc-900 border border-zinc-800">
        <h2 className="text-lg font-semibold mb-4">打卡日历</h2>
        <ProgressCalendar calendarData={calendarData} />
      </section>

      {/* Two Column: Skills + Recent */}
      <div className="grid md:grid-cols-5 gap-8">
        {/* Skills */}
        <section className="md:col-span-3">
          <h2 className="text-lg font-semibold mb-4">技能成长</h2>
          <SkillMatrix />
        </section>

        {/* Recent Days */}
        <section className="md:col-span-2">
          <h2 className="text-lg font-semibold mb-4">最近学习</h2>
          <div className="space-y-3">
            {recentDays.map((day) => (
              <DayCard key={day.dayNum} day={day} />
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  suffix,
  highlight,
}: {
  label: string;
  value: number;
  suffix?: string;
  highlight?: boolean;
}) {
  return (
    <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800">
      <p className="text-xs text-zinc-500 mb-1">{label}</p>
      <p className={`text-2xl font-bold font-mono ${highlight ? "text-emerald-400" : "text-zinc-100"}`}>
        {value}
        {suffix && <span className="text-sm text-zinc-500 ml-1">{suffix}</span>}
      </p>
    </div>
  );
}

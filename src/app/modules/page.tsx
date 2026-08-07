import Link from "next/link";
import { MODULES } from "@/lib/constants";
import { getAllDays } from "@/lib/content";
import DayCard from "@/components/DayCard";

export default function ModulesPage() {
  const allDays = getAllDays();

  return (
    <div className="space-y-10">
      <header>
        <h1 className="text-2xl font-bold mb-1">学习模块</h1>
        <p className="text-zinc-500 text-sm">5 个模块 · 24 周 · 176 天</p>
      </header>

      {MODULES.map((mod) => {
        const moduleDays = allDays.filter((d) => d.module === mod.name);
        return (
          <section key={mod.id} className="p-6 rounded-2xl bg-zinc-900 border border-zinc-800">
            <div className="flex items-start justify-between mb-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-mono text-emerald-400">模块 {mod.id}</span>
                  <span className="text-xs text-zinc-600">{mod.weeks}</span>
                </div>
                <h2 className="text-lg font-semibold">{mod.name}</h2>
                <p className="text-xs text-zinc-500 mt-1">{mod.dateRange}</p>
              </div>
              <span className="text-sm text-zinc-500">
                {moduleDays.length} 篇
              </span>
            </div>

            <div className="flex flex-wrap gap-2 mb-5">
              {mod.topics.map((topic) => (
                <span key={topic} className="text-xs bg-zinc-800 text-zinc-400 px-2.5 py-1 rounded-md">
                  {topic}
                </span>
              ))}
            </div>

            {moduleDays.length > 0 && (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {moduleDays.map((day) => (
                  <DayCard key={day.dayNum} day={day} />
                ))}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}

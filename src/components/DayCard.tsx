import Link from "next/link";
import { DayContent } from "@/lib/content";

interface Props {
  day: DayContent;
}

export default function DayCard({ day }: Props) {
  return (
    <Link href={`/day/${day.dayNum}`} className="block group">
      <div className="p-4 rounded-xl bg-zinc-800/50 border border-zinc-700/50 hover:border-emerald-500/30 hover:bg-zinc-800 transition-all">
        <div className="flex items-start justify-between mb-2">
          <span className="text-xs font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded">
            Day {day.dayNum}
          </span>
          <span className="text-xs text-zinc-500">{day.date}</span>
        </div>
        <h3 className="text-sm font-medium text-zinc-200 group-hover:text-white line-clamp-2 mb-2">
          {day.title}
        </h3>
        <span className="text-xs text-zinc-500">{day.module}</span>
      </div>
    </Link>
  );
}

import Link from "next/link";
import { notFound } from "next/navigation";
import { getDayByNumber, getAllDays } from "@/lib/content";
import { renderMarkdown } from "@/lib/markdown";
import DayDemo from "@/components/DayDemo";

export async function generateStaticParams() {
  const days = getAllDays();
  return days.map((d) => ({ dayNum: String(d.dayNum) }));
}

export default async function DayPage({ params }: { params: Promise<{ dayNum: string }> }) {
  const { dayNum } = await params;
  const num = parseInt(dayNum, 10);
  const day = getDayByNumber(num);

  if (!day) notFound();

  const html = await renderMarkdown(day.content);

  return (
    <article className="max-w-3xl mx-auto">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-zinc-500 mb-6">
        <Link href="/" className="hover:text-emerald-400 transition-colors">仪表盘</Link>
        <span>/</span>
        <span className="text-zinc-400">Day {day.dayNum}</span>
      </div>

      {/* Header */}
      <header className="mb-8">
        <div className="flex items-center gap-3 mb-3">
          <span className="text-xs font-mono text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-md">
            Day {day.dayNum}
          </span>
          <span className="text-xs text-zinc-500">{day.date}</span>
          <span className="text-xs text-zinc-600">·</span>
          <span className="text-xs text-zinc-500">{day.module}</span>
        </div>
        <h1 className="text-2xl font-bold">{day.title}</h1>
      </header>

      {/* Content */}
      <div className="prose" dangerouslySetInnerHTML={{ __html: html }} />

      {/* Interactive Demo (if available for this day) */}
      <DayDemo dayNum={num} />

      {/* Navigation */}
      <div className="flex items-center justify-between mt-12 pt-6 border-t border-zinc-800">
        {num > 1 && (
          <Link
            href={`/day/${num - 1}`}
            className="text-sm text-zinc-400 hover:text-emerald-400 transition-colors"
          >
            ← Day {num - 1}
          </Link>
        )}
        <div className="flex-1" />
        <Link
          href={`/day/${num + 1}`}
          className="text-sm text-zinc-400 hover:text-emerald-400 transition-colors"
        >
          Day {num + 1} →
        </Link>
      </div>
    </article>
  );
}

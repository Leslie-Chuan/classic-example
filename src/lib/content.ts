import fs from "fs";
import path from "path";
import matter from "gray-matter";
import { LEARN_START_DATE, TOTAL_DAYS, MODULES } from "./constants";
import { differenceInDays, parseISO, format } from "date-fns";

const CONTENT_DIR = path.join(process.cwd(), "content/daily");

export interface DayContent {
  dayNum: number;
  date: string;
  title: string;
  module: string;
  content: string;
  rawContent: string;
}

export function getDayNumber(dateStr: string): number {
  const start = parseISO(LEARN_START_DATE);
  const current = parseISO(dateStr);
  return differenceInDays(current, start) + 1;
}

export function getDateFromDay(dayNum: number): string {
  const start = parseISO(LEARN_START_DATE);
  const date = new Date(start);
  date.setDate(date.getDate() + dayNum - 1);
  return format(date, "yyyy-MM-dd");
}

export function getModuleForDay(dayNum: number): string {
  if (dayNum <= 56) return MODULES[0].name;
  if (dayNum <= 84) return MODULES[1].name;
  if (dayNum <= 113) return MODULES[2].name;
  if (dayNum <= 141) return MODULES[3].name;
  return MODULES[4].name;
}

export function getAllDays(): DayContent[] {
  if (!fs.existsSync(CONTENT_DIR)) return [];
  const files = fs.readdirSync(CONTENT_DIR).filter((f) => f.endsWith(".md"));
  const days: DayContent[] = [];

  for (const file of files) {
    const dateStr = file.replace(".md", "");
    const dayNum = getDayNumber(dateStr);
    const filePath = path.join(CONTENT_DIR, file);
    const raw = fs.readFileSync(filePath, "utf-8");
    const { content } = matter(raw);
    const titleMatch = content.match(/^#\s+(.+)$/m);
    const title = titleMatch ? titleMatch[1] : `Day ${dayNum}`;

    days.push({
      dayNum,
      date: dateStr,
      title,
      module: getModuleForDay(dayNum),
      content,
      rawContent: raw,
    });
  }

  return days.sort((a, b) => a.dayNum - b.dayNum);
}

export function getDayByNumber(dayNum: number): DayContent | null {
  const dateStr = getDateFromDay(dayNum);
  const filePath = path.join(CONTENT_DIR, `${dateStr}.md`);
  if (!fs.existsSync(filePath)) return null;

  const raw = fs.readFileSync(filePath, "utf-8");
  const { content } = matter(raw);
  const titleMatch = content.match(/^#\s+(.+)$/m);
  const title = titleMatch ? titleMatch[1] : `Day ${dayNum}`;

  return {
    dayNum,
    date: dateStr,
    title,
    module: getModuleForDay(dayNum),
    content,
    rawContent: raw,
  };
}

export function getCalendarData(): Record<string, number> {
  const days = getAllDays();
  const data: Record<string, number> = {};
  for (const day of days) {
    data[day.date] = 1;
  }
  return data;
}

export function getStats() {
  const days = getAllDays();
  const completedDays = days.length;
  const today = new Date();
  const currentDay = getDayNumber(format(today, "yyyy-MM-dd"));
  const progressPercent = Math.round((completedDays / TOTAL_DAYS) * 100);

  return {
    completedDays,
    totalDays: TOTAL_DAYS,
    currentDay,
    progressPercent,
    streakDays: calculateStreak(days.map((d) => d.date)),
  };
}

function calculateStreak(dates: string[]): number {
  if (dates.length === 0) return 0;
  const sorted = [...dates].sort().reverse();
  const today = format(new Date(), "yyyy-MM-dd");
  let streak = 0;
  let checkDate = today;

  for (let i = 0; i < 365; i++) {
    if (sorted.includes(checkDate)) {
      streak++;
    } else if (i > 0) {
      break;
    }
    const d = parseISO(checkDate);
    d.setDate(d.getDate() - 1);
    checkDate = format(d, "yyyy-MM-dd");
  }
  return streak;
}

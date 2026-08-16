// Buckets manual HealthEntry logs (water/mood/weight) into one value per day
// so they can flow through the SAME chart/stat pipeline as the mock cache
// metrics — the detail screen (S15) doesn't need to know which kind of
// metric it's rendering.
import type { HealthEntry } from "@/src/types/models";

export interface DailyPoint {
  date: string; // YYYY-MM-DD
  value: number;
  hasData: boolean;
}

function dayKey(iso: string): string {
  return iso.slice(0, 10);
}

export type Aggregate = "sum" | "avg" | "last";

/** Last `days` days ending today, oldest -> newest. Missing days = 0/no-data. */
export function bucketEntriesByDay(
  entries: HealthEntry[],
  days: number,
  aggregate: Aggregate = "avg",
): DailyPoint[] {
  const byDay = new Map<string, number[]>();
  for (const e of entries) {
    const key = dayKey(e.logged_at);
    const arr = byDay.get(key) ?? [];
    arr.push(e.value);
    byDay.set(key, arr);
  }
  const out: DailyPoint[] = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    const values = byDay.get(key);
    let value = 0;
    if (values && values.length) {
      if (aggregate === "sum") value = values.reduce((s, v) => s + v, 0);
      else if (aggregate === "last") value = values[values.length - 1];
      else value = values.reduce((s, v) => s + v, 0) / values.length;
    }
    out.push({ date: key, value, hasData: !!(values && values.length) });
  }
  return out;
}

export interface SeriesStats { avg: number; best: number; worst: number; trendPct: number }

export function computeStats(
  values: number[],
  goodDirection: "up" | "down" | "neutral" = "up",
): SeriesStats {
  const present = values.filter((v) => v > 0);
  if (present.length === 0) return { avg: 0, best: 0, worst: 0, trendPct: 0 };
  const avg = present.reduce((s, v) => s + v, 0) / present.length;
  const best = goodDirection === "down" ? Math.min(...present) : Math.max(...present);
  const worst = goodDirection === "down" ? Math.max(...present) : Math.min(...present);
  const last = present[present.length - 1];
  const priorWindow = present.slice(0, -1).slice(-7);
  const priorAvg = priorWindow.length ? priorWindow.reduce((s, v) => s + v, 0) / priorWindow.length : avg;
  const trendPct = priorAvg === 0 ? 0 : Math.round(((last - priorAvg) / priorAvg) * 100);
  return { avg, best, worst, trendPct };
}

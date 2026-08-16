// Health metric registry + MOCK integration-derived data (Design System E.3
// "metric card", E.6 charts). Cache metrics (sleep/steps/heart_rate/
// active_energy/workout) are HealthCacheSample-shaped and LOCAL-ONLY by
// design (S34) — generated on-device here until a real HealthKit/Health
// Connect source is connected, at which point this module is swapped for a
// real one with ZERO UI changes (same shapes/functions).
//
// This is the SINGLE SOURCE for the mock snapshot so the Today health card
// and the Health tab summary can never show different numbers for the same
// metric — both call getMockHealthSnapshot() from here.
import type { HealthCacheSample, ManualHealthType } from "@/src/types/models";

export type CacheMetricKey = "sleep" | "steps" | "heart_rate" | "active_energy" | "workout";
export type MetricKey = CacheMetricKey | ManualHealthType;

export interface MetricMeta {
  key: MetricKey;
  label: string;
  unit: string;
  /** Color/semantic direction for trend deltas — "neutral" metrics (HR,
   * weight) never tint red/green since down isn't automatically bad. */
  goodDirection: "up" | "down" | "neutral";
}

export const CACHE_METRICS: CacheMetricKey[] = [
  "sleep", "steps", "heart_rate", "active_energy", "workout",
];

export const CACHE_META: Record<CacheMetricKey, MetricMeta> = {
  sleep: { key: "sleep", label: "Sleep", unit: "h", goodDirection: "up" },
  steps: { key: "steps", label: "Steps", unit: "steps", goodDirection: "up" },
  heart_rate: { key: "heart_rate", label: "Resting HR", unit: "bpm", goodDirection: "neutral" },
  active_energy: { key: "active_energy", label: "Active energy", unit: "kcal", goodDirection: "up" },
  workout: { key: "workout", label: "Workouts", unit: "min", goodDirection: "up" },
};

export const MANUAL_META: Record<ManualHealthType, MetricMeta> = {
  water: { key: "water", label: "Water", unit: "ml", goodDirection: "up" },
  mood: { key: "mood", label: "Mood", unit: "/5", goodDirection: "up" },
  weight: { key: "weight", label: "Weight", unit: "kg", goodDirection: "neutral" },
};

export function metaFor(key: MetricKey): MetricMeta {
  return (CACHE_META as Record<string, MetricMeta>)[key]
    ?? (MANUAL_META as Record<string, MetricMeta>)[key];
}

export function isCacheMetric(key: MetricKey): key is CacheMetricKey {
  return key in CACHE_META;
}

// ---- Mock cache-metric generation ------------------------------------------

// Deterministic-ish PRNG so numbers don't jump on every render/remount —
// looks like real data, not random noise.
function seededRandom(seed: number) {
  let s = seed % 233280;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

const BASE_VALUE: Record<CacheMetricKey, number> = {
  sleep: 6.6, steps: 6200, heart_rate: 58, active_energy: 340, workout: 28,
};
const VARIANCE: Record<CacheMetricKey, number> = {
  sleep: 1.1, steps: 2600, heart_rate: 4, active_energy: 110, workout: 22,
};

function isoAt(daysAgo: number, hour: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
}

function roundFor(metric: CacheMetricKey, value: number): number {
  return metric === "steps" || metric === "workout" ? Math.round(value) : Math.round(value * 10) / 10;
}

/** One sample per day for `days` days, oldest -> newest (today last). */
export function getMetricSeries(metric: CacheMetricKey, days: number): HealthCacheSample[] {
  const rand = seededRandom(metric.length * 97 + days * 13);
  const out: HealthCacheSample[] = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    const wobble = (rand() - 0.5) * 2 * VARIANCE[metric];
    const drift = Math.sin((days - i) / 6) * VARIANCE[metric] * 0.3;
    const value = Math.max(0, roundFor(metric, BASE_VALUE[metric] + wobble + drift));
    out.push({
      id: `mock-${metric}-${i}`,
      user_id: "demo-user",
      metric,
      value,
      unit: CACHE_META[metric].unit,
      start_at: isoAt(i, metric === "sleep" ? 23 : 7),
      end_at: isoAt(i, metric === "sleep" ? 7 : 20),
      source: "apple_health",
      readiness_input: metric === "sleep" || metric === "heart_rate" || metric === "workout",
    });
  }
  return out;
}

export function trendPct(series: { value: number }[]): number {
  if (series.length < 2) return 0;
  const last = series[series.length - 1].value;
  const priorWindow = series.slice(0, -1).slice(-7);
  const avg = priorWindow.reduce((s, x) => s + x.value, 0) / (priorWindow.length || 1);
  if (avg === 0) return 0;
  return Math.round(((last - avg) / avg) * 100);
}

export interface HealthSnapshot {
  sleep: HealthCacheSample;
  steps: HealthCacheSample;
  activeEnergy: HealthCacheSample;
  trends: { sleep: number; steps: number; activeEnergy: number };
}

/** Canonical "today" snapshot — Today's HealthCard AND the Health tab
 * summary both read this exact function, so the numbers can never drift. */
export function getMockHealthSnapshot(): HealthSnapshot {
  const sleepSeries = getMetricSeries("sleep", 8);
  const stepsSeries = getMetricSeries("steps", 8);
  const energySeries = getMetricSeries("active_energy", 8);
  return {
    sleep: sleepSeries[sleepSeries.length - 1],
    steps: stepsSeries[stepsSeries.length - 1],
    activeEnergy: energySeries[energySeries.length - 1],
    trends: {
      sleep: trendPct(sleepSeries),
      steps: trendPct(stepsSeries),
      activeEnergy: trendPct(energySeries),
    },
  };
}

// ---- Formatting -------------------------------------------------------------

export function formatMetricValue(metric: MetricKey, value: number): string {
  if (metric === "sleep") {
    const h = Math.floor(value);
    const m = Math.round((value - h) * 60);
    return `${h}h ${m}m`;
  }
  if (metric === "steps") return Math.round(value).toLocaleString();
  if (metric === "water") return value >= 1000 ? `${(value / 1000).toFixed(2)} L` : `${Math.round(value)} ml`;
  if (metric === "mood") return value.toFixed(1);
  if (metric === "heart_rate" || metric === "workout") return `${Math.round(value)}`;
  return value.toFixed(1);
}

// ---- Readiness (S17) — simple, transparent, wellbeing-framed only ----------

export interface ReadinessFactor {
  key: string;
  label: string;
  value: string;
  weight: "up" | "down" | "flat";
}

export interface Readiness {
  score: number; // 0-100
  label: string;
  factors: ReadinessFactor[];
}

export function getMockReadiness(): Readiness {
  const sleepSeries = getMetricSeries("sleep", 1);
  const sleep = sleepSeries[0].value;
  const hrSeries = getMetricSeries("heart_rate", 8);
  const hrLast = hrSeries[hrSeries.length - 1].value;
  const hrAvg = hrSeries.slice(0, 7).reduce((s, x) => s + x.value, 0) / 7;
  const workoutSeries = getMetricSeries("workout", 1);
  const strainMin = workoutSeries[0].value;

  const sleepScore = Math.min(100, (sleep / 8) * 100);
  const hrScore = Math.max(0, 100 - Math.abs(hrLast - hrAvg) * 6);
  const strainScore = Math.max(0, 100 - Math.max(0, strainMin - 30) * 1.5);
  const score = Math.round(sleepScore * 0.55 + hrScore * 0.3 + strainScore * 0.15);

  const label = score >= 75 ? "Good recovery" : score >= 50 ? "Okay recovery" : "Low recovery — take it easier";
  const hrDelta = hrLast - hrAvg;

  return {
    score,
    label,
    factors: [
      {
        key: "sleep", label: "Sleep duration", value: formatMetricValue("sleep", sleep),
        weight: sleep >= 7 ? "up" : "down",
      },
      {
        key: "hr", label: "Resting heart rate", value: `${Math.round(hrLast)} bpm`,
        weight: Math.abs(hrDelta) < 2 ? "flat" : hrDelta > 0 ? "down" : "up",
      },
      {
        key: "strain", label: "Yesterday's activity", value: `${Math.round(strainMin)} min`,
        weight: strainMin > 45 ? "down" : "flat",
      },
    ],
  };
}

// ---- Icon spec (rendered via shared <MetricIcon/> — keeps icon-set choice
// out of this data module) ---------------------------------------------------

export type IconSpec = { set: "feather"; name: string } | { set: "mci"; name: string };

export function metricIconSpec(key: MetricKey): IconSpec {
  switch (key) {
    case "sleep": return { set: "feather", name: "moon" };
    case "steps": return { set: "mci", name: "walk" };
    case "heart_rate": return { set: "feather", name: "heart" };
    case "active_energy": return { set: "feather", name: "zap" };
    case "workout": return { set: "feather", name: "activity" };
    case "weight": return { set: "mci", name: "scale-bathroom" };
    case "water": return { set: "feather", name: "droplet" };
    case "mood": return { set: "feather", name: "smile" };
    default: return { set: "feather", name: "activity" };
  }
}

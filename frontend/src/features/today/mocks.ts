// ⚠️ MOCK DATA — clearly-marked placeholders flowing through the REAL model
// shapes (HealthCacheSample, SocialStat-like). When the actual integrations
// connect (HealthKit/Health Connect, Instagram Graph API), these functions
// are replaced by real sources and the UI needs zero changes.
//
// Health snapshot: re-exported from src/features/health/metrics.ts, which is
// the SINGLE SOURCE for mock cache-metric data — this card and the Health
// tab summary both read the same function, so their numbers can never drift.
//
// Note: the AI Suggestion card is NO LONGER mocked here — it's wired to the
// real ChatGPT-backed GET /ai/suggestions endpoint (see src/features/ai/api.ts).
export type { HealthSnapshot } from "@/src/features/health/metrics";
export { getMockHealthSnapshot } from "@/src/features/health/metrics";

// SocialStat shape (Technical Foundation §A.3) — MOCK until Instagram
// Graph API integration (P1) is connected.
export interface SocialSnapshot {
  captured_on: string;
  followers: number;
  followers_delta: number;
  reach: number;
  engagement_rate: number;
}

export function getMockSocialSnapshot(): SocialSnapshot {
  return {
    captured_on: new Date().toISOString().slice(0, 10),
    followers: 12480,
    followers_delta: 36,
    reach: 8900,
    engagement_rate: 4.7,
  };
}

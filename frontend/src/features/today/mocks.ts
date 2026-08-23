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

export type { SocialSnapshot } from "@/src/features/social/mockSocialData";
export { getMockSocialSnapshot } from "@/src/features/social/mockSocialData";

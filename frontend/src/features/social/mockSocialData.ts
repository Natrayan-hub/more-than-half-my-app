// Social Stats (IA S31, condensed) — MOCK Instagram data flowing through
// realistic shapes. Real Instagram Graph API integration is P1 (OAuth flow
// can be added later, per spec) — connect/disconnect status is REAL though,
// backed by the same Integration record used in Settings > Integrations.
//
// SocialSnapshot (followers/reach/engagement_rate) is the SINGLE SOURCE also
// read by Today's SocialCard, so the two surfaces can never disagree.

function seededRandom(seed: number) {
  let s = seed % 233280;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

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

export interface TopPost {
  emoji: string;
  caption: string;
  likes: number;
  comments: number;
  posted_on: string;
}

export interface SocialStatsDetail extends SocialSnapshot {
  following: number;
  posts: number;
  avg_likes: number;
  avg_comments: number;
  top_post: TopPost;
}

export function getMockSocialStats(): SocialStatsDetail {
  const base = getMockSocialSnapshot();
  return {
    ...base,
    following: 412,
    posts: 186,
    avg_likes: 342,
    avg_comments: 28,
    top_post: {
      emoji: "🏃",
      caption: "Sunday morning run — 10k done!",
      likes: 1240,
      comments: 96,
      posted_on: new Date(Date.now() - 5 * 86400000).toISOString(),
    },
  };
}

export type SeriesPoint = { date: string; value: number };

function buildSeries(seed: number, days: number, base: number, growthPerDay: number, variance: number, round = true): SeriesPoint[] {
  const rand = seededRandom(seed + days);
  const out: SeriesPoint[] = [];
  let value = base - growthPerDay * days;
  for (let i = days - 1; i >= 0; i -= 1) {
    value += growthPerDay + (rand() - 0.5) * variance;
    const d = new Date();
    d.setDate(d.getDate() - i);
    const clamped = Math.max(0, value);
    out.push({ date: d.toISOString().slice(0, 10), value: round ? Math.round(clamped) : Math.round(clamped * 10) / 10 });
  }
  return out;
}

export function getFollowerGrowthSeries(days: number): SeriesPoint[] {
  return buildSeries(11, days, 12480, 4.2, 18);
}

export function getEngagementSeries(days: number): SeriesPoint[] {
  return buildSeries(29, days, 4.7, 0.01, 0.6, false);
}

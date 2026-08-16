// AI feature API — thin typed wrappers over the shared client for the
// suggestion lifecycle (API design B.10 #1-3). Generation itself is entirely
// server-side (see backend/core/suggestion_engine.py); this module never
// talks to an LLM directly.
import { api, ApiError } from "@/src/api/client";
import type { Suggestion } from "@/src/types/models";

/** Returns the current pending suggestion, or null if there isn't one —
 * including when the user has AI features turned off (403 SCOPE_DENIED is
 * treated as "nothing to show", not an error, since it's an intentional
 * user choice, not a failure). */
export async function fetchPendingSuggestion(): Promise<Suggestion | null> {
  try {
    const res = await api.get<{ items: Suggestion[] }>("/ai/suggestions", { status: "pending" });
    return res.items[0] ?? null;
  } catch (e) {
    if (e instanceof ApiError && e.code === "SCOPE_DENIED") return null;
    throw e;
  }
}

export interface AcceptSuggestionResult {
  status: string;
  changed: Record<string, unknown>;
}

export async function acceptSuggestion(id: string): Promise<AcceptSuggestionResult> {
  return api.post<AcceptSuggestionResult>(`/ai/suggestions/${id}/accept`);
}

export async function dismissSuggestion(id: string, neverAgain = false): Promise<void> {
  await api.post(`/ai/suggestions/${id}/dismiss`, { never_again: neverAgain });
}

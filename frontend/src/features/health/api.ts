// Health feature API — thin typed wrappers over the shared client for the
// manual HealthEntry CRUD (API design B.4 #1-3). Cache/integration metrics
// have no backend calls (LOCAL-ONLY by design, S34) — see metrics.ts mocks.
import { api } from "@/src/api/client";
import type { HealthEntry, ManualHealthType } from "@/src/types/models";

export interface EntryFilter {
  type: ManualHealthType;
  fromIso?: string;
  toIso?: string;
  limit?: number;
}

export async function fetchHealthEntries({ type, fromIso, toIso, limit = 200 }: EntryFilter): Promise<HealthEntry[]> {
  const res = await api.get<{ items: HealthEntry[] }>("/health/entries", {
    type, from_: fromIso, to: toIso, limit,
  });
  return res.items;
}

export async function logHealthEntry(
  type: ManualHealthType,
  value: number,
  note?: string,
): Promise<HealthEntry> {
  return api.post<HealthEntry>("/health/entries", { type, value, note });
}

export async function updateHealthEntry(
  id: string,
  updates: { value?: number; note?: string },
): Promise<HealthEntry> {
  return api.patch<HealthEntry>(`/health/entries/${id}`, updates);
}

export async function deleteHealthEntry(id: string): Promise<void> {
  return api.del<void>(`/health/entries/${id}`);
}

function startOfDayIso(daysAgo = 0): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

export function rangeDays(range: "7d" | "30d" | "90d"): number {
  return range === "7d" ? 7 : range === "30d" ? 30 : 90;
}

export function fromIsoForRange(range: "7d" | "30d" | "90d"): string {
  return startOfDayIso(rangeDays(range) - 1);
}

// Gym feature API — thin typed wrappers over the shared client for the
// manual GymSet CRUD + exercise-name autocomplete + weekly summary.
import { api } from "@/src/api/client";
import type { GymSet, WeightUnit } from "@/src/types/models";

export interface GymSetFilter {
  fromIso?: string;
  toIso?: string;
  limit?: number;
}

export async function fetchGymSets({ fromIso, toIso, limit = 200 }: GymSetFilter = {}): Promise<GymSet[]> {
  const res = await api.get<{ items: GymSet[] }>("/gym/sets", { from_: fromIso, to: toIso, limit });
  return res.items;
}

export interface LogGymSetInput {
  exercise_name: string;
  weight: number;
  weight_unit: WeightUnit;
  reps: number;
  note?: string;
}

export async function logGymSet(input: LogGymSetInput): Promise<GymSet> {
  return api.post<GymSet>("/gym/sets", input);
}

export async function updateGymSet(
  id: string,
  updates: Partial<LogGymSetInput>,
): Promise<GymSet> {
  return api.patch<GymSet>(`/gym/sets/${id}`, updates);
}

export async function deleteGymSet(id: string): Promise<void> {
  return api.del<void>(`/gym/sets/${id}`);
}

export async function fetchExerciseNames(): Promise<string[]> {
  const res = await api.get<{ items: string[] }>("/gym/exercises");
  return res.items;
}

export interface GymSummary {
  sets_this_week: number;
  sessions_this_week: number;
}

export async function fetchGymSummary(): Promise<GymSummary> {
  return api.get<GymSummary>("/gym/summary");
}

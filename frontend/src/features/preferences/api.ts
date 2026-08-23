// Preferences (Settings singleton, S25/S28/S32/S34) — real GET/PUT against
// the existing Preference model. One document per user; PUT replaces the
// whole object, so callers always spread the current value before patching
// a nested slice (data_controls, notif_prefs, backup_prefs, ...).
import { api } from "@/src/api/client";
import type { Preference } from "@/src/types/models";

export async function fetchPreferences(): Promise<Preference> {
  return api.get<Preference>("/me/preferences");
}

export async function savePreferences(pref: Preference): Promise<Preference> {
  return api.put<Preference>("/me/preferences", pref);
}

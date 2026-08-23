// Profile editing (S25 slice) — display name via existing PATCH /me/profile,
// avatar via multipart upload to the new Emergent Object Storage-backed
// /me/avatar endpoint (see backend/core/storage.py + routes/users.py).
import { Platform } from "react-native";

import { api, ACCESS_TOKEN_KEY } from "@/src/api/client";
import { storage } from "@/src/utils/storage";
import type { Profile } from "@/src/types/models";

const BASE_URL = `${process.env.EXPO_PUBLIC_BACKEND_URL}/api`;

export async function updateDisplayName(displayName: string): Promise<Profile> {
  return api.patch<Profile>("/me/profile", { display_name: displayName });
}

export async function uploadAvatar(uri: string, name: string, mimeType: string): Promise<Profile> {
  const token = await storage.secureGet<string>(ACCESS_TOKEN_KEY, "");
  const form = new FormData();
  if (Platform.OS === "web") {
    const blob = await (await fetch(uri)).blob();
    form.append("file", blob, name);
  } else {
    // Native FormData shape — do not set Content-Type manually, the
    // runtime adds the multipart boundary itself.
    form.append("file", { uri, name, type: mimeType } as unknown as Blob);
  }

  const res = await fetch(`${BASE_URL}/me/avatar`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    body: form,
  });

  if (!res.ok) {
    let message = `Upload failed (${res.status})`;
    try {
      const payload = await res.json();
      message = payload?.error?.message ?? message;
    } catch {
      // non-JSON error body — keep default
    }
    throw new Error(message);
  }
  return res.json();
}

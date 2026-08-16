// Auth API calls (playbook-aligned): register / login / logout / me.
// Token persistence is handled here; AuthProvider owns the state machine.
import { api, clearTokens, REFRESH_TOKEN_KEY, saveTokens } from "@/src/api/client";
import { storage } from "@/src/utils/storage";
import type { Profile, User } from "@/src/types/models";

interface AuthResponse {
  access_token: string;
  refresh_token: string;
  user: User;
}

export interface Me {
  user: User;
  profile: Profile;
}

export async function registerAccount(email: string, password: string): Promise<User> {
  const res = await api.post<AuthResponse>("/auth/register", { email, password }, false);
  await saveTokens(res.access_token, res.refresh_token);
  return res.user;
}

export async function loginAccount(email: string, password: string): Promise<User> {
  const res = await api.post<AuthResponse>("/auth/login", { email, password }, false);
  await saveTokens(res.access_token, res.refresh_token);
  return res.user;
}

export interface GoogleSessionResponse {
  access_token: string;
  refresh_token: string;
  user: User;
  is_new_user: boolean;
}

export async function exchangeGoogleSession(sessionId: string): Promise<GoogleSessionResponse> {
  const res = await api.post<GoogleSessionResponse>(
    "/auth/session",
    { session_id: sessionId },
    false,
  );
  await saveTokens(res.access_token, res.refresh_token);
  return res;
}

export async function logoutAccount(): Promise<void> {
  const refresh = await storage.secureGet<string>(REFRESH_TOKEN_KEY, "");
  if (refresh) {
    // Best-effort server-side revocation; local clear always happens.
    api.post("/auth/logout", { refresh_token: refresh }, false).catch(() => {});
  }
  await clearTokens();
}

export async function fetchMe(): Promise<Me> {
  return api.get<Me>("/me");
}

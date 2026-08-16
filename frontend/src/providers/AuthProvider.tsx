// Real auth state: bootstraps the session from secure storage, exposes
// sign-up/sign-in/sign-out, the user's profile, and the onboarding-complete
// flag that drives new-vs-returning routing in the root layout.
import React, {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
} from "react";

import { ApiError, REFRESH_TOKEN_KEY, setOnUnauthorized } from "@/src/api/client";
import {
  exchangeGoogleSession, fetchMe, loginAccount, logoutAccount, Me, registerAccount,
} from "@/src/api/auth";
import { checkIncomingSessionId, clearWebSessionParam } from "@/src/features/auth/google";
import { storage } from "@/src/utils/storage";
import type { Profile, User } from "@/src/types/models";

export type AuthStatus = "loading" | "unauthenticated" | "authenticated";

const ONBOARDING_KEY = "lifeos.onboarding.complete";
const ME_CACHE_KEY = "lifeos.cache.me";

interface AuthContextValue {
  status: AuthStatus;
  user: User | null;
  profile: Profile | null;
  onboardingComplete: boolean;
  signUp: (email: string, password: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  continueWithGoogle: (sessionId: string) => Promise<boolean>; // resolves isNewUser
  signOut: () => Promise<void>;
  completeOnboarding: () => Promise<void>;
  setProfile: (profile: Profile) => void;
  refreshMe: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfileState] = useState<Profile | null>(null);
  const [onboardingComplete, setOnboardingComplete] = useState(false);

  const applyMe = useCallback((me: Me) => {
    setUser(me.user);
    setProfileState(me.profile);
    storage.setItem(ME_CACHE_KEY, JSON.stringify(me));
  }, []);

  // Guards against exchanging the same Emergent session_id twice — a hot
  // deep-link and a hot-mount check can both surface the same value.
  const processedSessionIds = useRef<Set<string>>(new Set());

  const applyGoogleSession = useCallback(async (sessionId: string): Promise<boolean> => {
    if (processedSessionIds.current.has(sessionId)) return !onboardingComplete;
    processedSessionIds.current.add(sessionId);

    const result = await exchangeGoogleSession(sessionId); // saves tokens
    const me = await fetchMe();
    applyMe(me);
    if (!result.is_new_user) {
      // Returning account → straight to the app (same as password sign-in).
      await storage.setItem(ONBOARDING_KEY, true);
      setOnboardingComplete(true);
    }
    setStatus("authenticated");
    clearWebSessionParam(); // no-op on native
    return result.is_new_user;
  }, [applyMe, onboardingComplete]);

  // Bootstrap: an incoming Google redirect (session_id in the URL/deep link)
  // takes priority over any stored session — it's the freshest signal and
  // the session_id is one-time-use, so it must be handled before anything
  // else races to read it. Otherwise, returning users with a valid (or
  // refreshable) session skip onboarding; everyone else lands on Welcome.
  useEffect(() => {
    (async () => {
      try {
        const incomingSessionId = await checkIncomingSessionId();
        if (incomingSessionId) {
          await applyGoogleSession(incomingSessionId);
          return;
        }
      } catch {
        // Invalid/expired session_id — fall through to normal bootstrap.
      }

      const [refreshToken, onboarded] = await Promise.all([
        storage.secureGet<string>(REFRESH_TOKEN_KEY, ""),
        storage.getItem<boolean>(ONBOARDING_KEY, false),
      ]);
      setOnboardingComplete(!!onboarded);
      if (!refreshToken) {
        setStatus("unauthenticated");
        return;
      }
      try {
        const me = await fetchMe(); // client auto-rotates expired access tokens
        applyMe(me);
        setStatus("authenticated");
      } catch (e) {
        if (e instanceof ApiError && e.code === "NETWORK_ERROR") {
          // Offline with a stored session: stay signed in on cached identity.
          const cached = await storage.getItem<string>(ME_CACHE_KEY, "");
          if (cached) {
            try {
              applyMe(JSON.parse(cached) as Me);
            } catch { /* corrupt cache — identity loads on reconnect */ }
          }
          setStatus("authenticated");
        } else {
          setStatus("unauthenticated");
        }
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once on mount only
  }, []);

  const signOut = useCallback(async () => {
    await logoutAccount();
    await storage.removeItem(ONBOARDING_KEY);
    await storage.removeItem(ME_CACHE_KEY);
    setUser(null);
    setProfileState(null);
    setOnboardingComplete(false);
    setStatus("unauthenticated");
  }, []);

  // Unrecoverable 401 anywhere in the app → clean sign-out.
  useEffect(() => {
    setOnUnauthorized(() => {
      signOut();
    });
    return () => setOnUnauthorized(null);
  }, [signOut]);

  const signUp = useCallback(
    async (email: string, password: string) => {
      await registerAccount(email, password);
      const me = await fetchMe();
      applyMe(me);
      setStatus("authenticated");
      // onboardingComplete stays false → flow continues to privacy step.
    },
    [applyMe],
  );

  const signIn = useCallback(
    async (email: string, password: string) => {
      await loginAccount(email, password);
      const me = await fetchMe();
      applyMe(me);
      // Returning account → straight to the app.
      await storage.setItem(ONBOARDING_KEY, true);
      setOnboardingComplete(true);
      setStatus("authenticated");
    },
    [applyMe],
  );

  const completeOnboarding = useCallback(async () => {
    await storage.setItem(ONBOARDING_KEY, true);
    setOnboardingComplete(true);
  }, []);

  const refreshMe = useCallback(async () => {
    const me = await fetchMe();
    applyMe(me);
  }, [applyMe]);

  const setProfile = useCallback((next: Profile) => {
    setProfileState(next);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      status, user, profile, onboardingComplete,
      signUp, signIn, continueWithGoogle: applyGoogleSession, signOut,
      completeOnboarding, setProfile, refreshMe,
    }),
    [status, user, profile, onboardingComplete,
     signUp, signIn, applyGoogleSession, signOut, completeOnboarding, setProfile, refreshMe],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

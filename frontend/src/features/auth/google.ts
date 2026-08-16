// Emergent-managed Google sign-in: platform-specific redirect + session_id
// extraction. The backend exchanges session_id exactly once (X-Session-ID)
// and mints this app's own JWT pair — see routes/auth.py `POST /auth/session`.
// This module never calls Emergent's API directly — only the backend does.
import { Platform } from "react-native";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";

// Must run at module scope (not inside a component) so Android can complete
// the auth session correctly even across a fresh JS context.
WebBrowser.maybeCompleteAuthSession();

const AUTH_BASE_URL = "https://auth.emergentagent.com/";
// Emergent returns session_id in the URL hash on native deep links
// (myapp://#session_id=...) — Linking.parse().queryParams cannot see the
// hash fragment, so we always match the raw URL string instead.
const SESSION_ID_RE = /[?#&]session_id=([^&#]+)/;

export function extractSessionId(url: string | null | undefined): string | null {
  if (!url) return null;
  const match = url.match(SESSION_ID_RE);
  return match ? decodeURIComponent(match[1]) : null;
}

function getRedirectUrl(): string {
  if (Platform.OS === "web") {
    // Must point to a route that exists in the router — root always resolves.
    return `${window.location.origin}/`;
  }
  return Linking.createURL("");
}

/**
 * Kicks off the Google sign-in flow.
 * - Web: navigates away immediately; returns null (session_id is picked up
 *   on the next mount via `checkIncomingSessionId`).
 * - Mobile: opens the OS auth browser and resolves with the extracted
 *   session_id, or null if the user cancelled.
 */
export async function startGoogleAuth(): Promise<string | null> {
  const redirectUrl = getRedirectUrl();
  const authUrl = `${AUTH_BASE_URL}?redirect=${encodeURIComponent(redirectUrl)}`;

  if (Platform.OS === "web") {
    window.location.href = authUrl;
    return null;
  }

  // Registered BEFORE opening the session: on Android, openAuthSessionAsync
  // frequently resolves with `dismiss`/no url even on success, so the hot
  // deep-link listener is a co-equal source, not a fallback-only path.
  let listenerUrl: string | null = null;
  const subscription = Linking.addEventListener("url", (event) => {
    listenerUrl = event.url;
  });

  try {
    const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUrl);
    let candidate: string | null = null;
    if (result.type === "success") {
      candidate = result.url;
    }
    if (!candidate) candidate = listenerUrl;
    if (!candidate) candidate = await Linking.getInitialURL();
    return extractSessionId(candidate);
  } finally {
    subscription.remove();
  }
}

/**
 * Checks whether the app was just opened via the auth redirect:
 * - Web: session_id in the current URL (hash or query) after Emergent
 *   redirects back to `{origin}/`.
 * - Mobile: cold start via deep link (app was killed, OS relaunched it).
 */
export async function checkIncomingSessionId(): Promise<string | null> {
  if (Platform.OS === "web") {
    if (typeof window === "undefined") return null;
    return extractSessionId(window.location.href);
  }
  const initialUrl = await Linking.getInitialURL();
  return extractSessionId(initialUrl);
}

// Removes only the session_id param from the URL bar (web), preserving every
// other query/hash param. Call ONLY after the backend exchange succeeds.
export function clearWebSessionParam(): void {
  if (Platform.OS !== "web" || typeof window === "undefined") return;
  try {
    const url = new URL(window.location.href);
    url.searchParams.delete("session_id");
    let hash = url.hash;
    if (hash.includes("session_id=")) {
      const cleaned = hash
        .slice(1)
        .split("&")
        .filter((part) => part && !part.startsWith("session_id="))
        .join("&");
      hash = cleaned ? `#${cleaned}` : "";
    }
    const next = `${url.pathname}${url.search}${hash}`;
    window.history.replaceState(window.history.state, "", next);
  } catch {
    // Non-fatal — leaving the param in the URL bar is cosmetic only.
  }
}

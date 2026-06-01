import { useEffect, useState } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

type AuthReadyState = {
  session: Session | null;
  user: User | null;
  isReady: boolean;
};

const AUTH_READY_TIMEOUT_MS = 3500;

let authState: AuthReadyState = { session: null, user: null, isReady: false };
let authInitialized = false;
const authListeners = new Set<() => void>();
let lastRefreshAttemptAt = 0;

const emitAuthState = (next: AuthReadyState) => {
  authState = next;
  authListeners.forEach((listener) => listener());
};

const getSessionWithTimeout = () =>
  Promise.race([
    supabase.auth.getSession(),
    new Promise<"timeout">((resolve) => {
      window.setTimeout(() => resolve("timeout"), AUTH_READY_TIMEOUT_MS);
    }),
  ]);

const initializeAuthState = () => {
  if (authInitialized) return;
  authInitialized = true;

  const readyFallback = window.setTimeout(() => {
    if (!authState.isReady) {
      emitAuthState({ ...authState, isReady: true });
    }
  }, AUTH_READY_TIMEOUT_MS + 500);

  const {
    data: { subscription },
  } = supabase.auth.onAuthStateChange((_event, nextSession) => {
    window.clearTimeout(readyFallback);
    emitAuthState({
      session: nextSession,
      user: nextSession?.user ?? null,
      isReady: true,
    });
  });

  void getSessionWithTimeout()
    .then((result) => {
      window.clearTimeout(readyFallback);
      if (result === "timeout") {
        emitAuthState({ ...authState, isReady: true });
        return;
      }

      const currentSession = result.data.session;
      emitAuthState({
        session: currentSession,
        user: currentSession?.user ?? null,
        isReady: true,
      });
    })
    .catch(() => {
      window.clearTimeout(readyFallback);
      emitAuthState({ session: null, user: null, isReady: true });
    });

  window.addEventListener("beforeunload", () => subscription.unsubscribe(), { once: true });

  // Mobile/PWA: when device wakes up from sleep, force a session refresh
  // so the user isn't kicked back to /auth on iOS/Android home-screen apps.
  const handleResume = () => {
    if (document.visibilityState !== "visible") return;
    void supabase.auth
      .getSession()
      .then(({ data: { session: s } }) => {
        if (s) {
          const nowSeconds = Math.floor(Date.now() / 1000);
          const expiresInSeconds = typeof s.expires_at === "number" ? s.expires_at - nowSeconds : 0;
          const nowMs = Date.now();

          // Proactively refresh only when the token is close to expiry. Refreshing
          // on every focus/pageshow can create concurrent refreshes that revoke
          // each other's token and make login look unstable on web/mobile.
          if (expiresInSeconds < 300 && nowMs - lastRefreshAttemptAt > 60_000) {
            lastRefreshAttemptAt = nowMs;
            void supabase.auth.refreshSession().catch(() => undefined);
          }
          emitAuthState({ session: s, user: s.user, isReady: true });
        }
      })
      .catch(() => undefined);
  };
  document.addEventListener("visibilitychange", handleResume);
  window.addEventListener("focus", handleResume);
  window.addEventListener("pageshow", handleResume);
};

export function useAuthReady() {
  const [state, setState] = useState<AuthReadyState>(authState);

  useEffect(() => {
    initializeAuthState();
    const listener = () => setState(authState);
    authListeners.add(listener);
    listener();

    return () => {
      authListeners.delete(listener);
    };
  }, []);

  return state;
}

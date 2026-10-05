import { useEffect, useState } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

type AuthReadyState = {
  session: Session | null;
  user: User | null;
  isReady: boolean;
};

const AUTH_READY_TIMEOUT_MS = 4000;

let authState: AuthReadyState = { session: null, user: null, isReady: false };
let authInitialized = false;
const authListeners = new Set<() => void>();
let lastRefreshAttemptAt = 0;

const emitAuthState = (next: AuthReadyState) => {
  authState = next;
  authListeners.forEach((listener) => listener());
};

/** Checks if localStorage contains any Supabase auth token key. */
const hasStoredAuthToken = (): boolean => {
  if (typeof window === "undefined") return false;
  try {
    const keys = Object.keys(localStorage);
    return keys.some(
      (k) =>
        k.includes("auth-token") ||
        k.includes("supabase.auth.token") ||
        k.includes("ecomfy-auth-token")
    );
  } catch {
    return false;
  }
};

const initializeAuthState = () => {
  if (authInitialized) return;
  authInitialized = true;

  // Supabase Auth Listener (handles INITIAL_SESSION, SIGNED_IN, TOKEN_REFRESHED, etc.)
  const {
    data: { subscription },
  } = supabase.auth.onAuthStateChange((_event, nextSession) => {
    emitAuthState({
      session: nextSession,
      user: nextSession?.user ?? null,
      isReady: true,
    });
  });

  // Direct initial session retrieval
  void supabase.auth
    .getSession()
    .then(({ data: { session: currentSession } }) => {
      if (currentSession) {
        emitAuthState({
          session: currentSession,
          user: currentSession.user,
          isReady: true,
        });
      } else if (!hasStoredAuthToken()) {
        // Truly no stored session found
        emitAuthState({
          session: null,
          user: null,
          isReady: true,
        });
      } else {
        // A token exists in local storage but getSession returned null (e.g., token needs refresh)
        void supabase.auth
          .refreshSession()
          .then(({ data: { session: refreshedSession } }) => {
            emitAuthState({
              session: refreshedSession,
              user: refreshedSession?.user ?? null,
              isReady: true,
            });
          })
          .catch(() => {
            emitAuthState({ session: null, user: null, isReady: true });
          });
      }
    })
    .catch(() => {
      if (!hasStoredAuthToken()) {
        emitAuthState({ session: null, user: null, isReady: true });
      }
    });

  // Fallback timeout ONLY if there is no token stored in localStorage
  window.setTimeout(() => {
    if (!authState.isReady && !hasStoredAuthToken()) {
      emitAuthState({ ...authState, isReady: true });
    }
  }, AUTH_READY_TIMEOUT_MS);

  window.addEventListener("beforeunload", () => subscription.unsubscribe(), { once: true });

  // Mobile/PWA: when device wakes up from sleep or user returns to PWA, force session refresh
  const handleResume = () => {
    if (document.visibilityState !== "visible") return;
    void supabase.auth
      .getSession()
      .then(({ data: { session: s } }) => {
        if (s) {
          const nowSeconds = Math.floor(Date.now() / 1000);
          const expiresInSeconds = typeof s.expires_at === "number" ? s.expires_at - nowSeconds : 0;
          const nowMs = Date.now();

          if (expiresInSeconds < 300 && nowMs - lastRefreshAttemptAt > 30_000) {
            lastRefreshAttemptAt = nowMs;
            void supabase.auth.refreshSession().catch(() => undefined);
          }
          emitAuthState({ session: s, user: s.user, isReady: true });
        } else if (hasStoredAuthToken()) {
          void supabase.auth.refreshSession().then(({ data: { session: refreshed } }) => {
            if (refreshed) {
              emitAuthState({ session: refreshed, user: refreshed.user, isReady: true });
            }
          }).catch(() => undefined);
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

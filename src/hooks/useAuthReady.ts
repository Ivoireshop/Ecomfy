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

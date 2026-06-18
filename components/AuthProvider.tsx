"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  getValidatedSession,
  signIn as authSignIn,
  signOut as authSignOut,
  type User,
} from "@/lib/auth";

interface AuthContextValue {
  user: User | null;
  /** True until the persisted session has been read on the client. */
  loading: boolean;
  signIn: (email: string, password: string) => User;
  signOut: () => void;
  /** Re-read the validated session (after a settings change, etc.). */
  refresh: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Restore the session once we're on the client (localStorage isn't available
  // during server rendering). We re-validate against the account store so a
  // role that changed since sign-in — or a stale session from an older build —
  // is corrected rather than trusted.
  useEffect(() => {
    setUser(getValidatedSession());
    setLoading(false);
  }, []);

  const signIn = useCallback((email: string, password: string) => {
    const next = authSignIn(email, password);
    setUser(next);
    return next;
  }, []);

  const signOut = useCallback(() => {
    authSignOut();
    setUser(null);
  }, []);

  const refresh = useCallback(() => {
    setUser(getValidatedSession());
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signOut, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an <AuthProvider>.");
  }
  return ctx;
}

"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { useRouter, usePathname } from "next/navigation";
import { setSessionExpiredHandler } from "@/lib/api";

export const SESSION_EXPIRED_PARAM = "session_expired";

interface User {
  id: string;
  email?: string;
}

interface SessionContextValue {
  user: User | null;
  loading: boolean;
  clearSession: () => void;
  setSession: (user: User) => void;
}

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  const clearSession = useCallback(() => {
    setUser(null);
    setLoading(false);
  }, []);

  const handleSessionExpired = useCallback(() => {
    clearSession();
    if (!pathname.startsWith("/login")) {
      router.push(
        `/login?${SESSION_EXPIRED_PARAM}=1&returnTo=${encodeURIComponent(pathname || "/")}`,
      );
    }
  }, [clearSession, router, pathname]);

  useEffect(() => {
    setSessionExpiredHandler(handleSessionExpired);
    return () => setSessionExpiredHandler(null);
  }, [handleSessionExpired]);

  const setSession = useCallback((newUser: User) => {
    setUser(newUser);
    setLoading(false);
  }, []);

  return (
    <SessionContext.Provider value={{ user, loading, clearSession, setSession }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) {
    throw new Error("useSession must be used within a SessionProvider");
  }
  return ctx;
}

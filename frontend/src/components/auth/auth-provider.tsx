"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { authApi, orgsApi } from "@/lib/api";
import { clearSession, getCurrentClaims, saveSession } from "@/lib/session";
import type { JwtPayload, OrgCreateRequest, SelfSignupRole } from "@/lib/types";

interface AuthContextValue {
  claims: JwtPayload | null;
  /** True until the first client-side read of localStorage completes —
   * lets pages avoid a flash of "logged out" content during hydration. */
  initializing: boolean;
  login: (input: { email: string; password: string; org_slug: string }) => Promise<void>;
  signup: (input: {
    name: string;
    email: string;
    password: string;
    org_slug: string;
    role: SelfSignupRole;
    staff_code?: string | null;
  }) => Promise<void>;
  createOrg: (input: OrgCreateRequest) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [claims, setClaims] = useState<JwtPayload | null>(null);
  const [initializing, setInitializing] = useState(true);
  const router = useRouter();

  useEffect(() => {
    setClaims(getCurrentClaims());
    setInitializing(false);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      claims,
      initializing,
      async login(input) {
        const tokens = await authApi.login(input);
        saveSession({ accessToken: tokens.access_token, refreshToken: tokens.refresh_token, orgSlug: input.org_slug });
        setClaims(getCurrentClaims());
      },
      async signup(input) {
        const tokens = await authApi.signup(input);
        saveSession({ accessToken: tokens.access_token, refreshToken: tokens.refresh_token, orgSlug: input.org_slug });
        setClaims(getCurrentClaims());
      },
      async createOrg(input) {
        const tokens = await orgsApi.create(input);
        saveSession({
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token,
          orgSlug: input.org_slug,
        });
        setClaims(getCurrentClaims());
      },
      logout() {
        clearSession();
        setClaims(null);
        router.push("/login");
      },
    }),
    [claims, initializing, router]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}

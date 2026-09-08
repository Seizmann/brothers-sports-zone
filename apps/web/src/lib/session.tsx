import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./supabase";
import { signOut as authSignOut } from "./auth";

export interface UserProfile {
  id: string;
  name: string;
  phone: string;
  created_at: string;
}

interface SessionContextValue {
  loading: boolean;
  /** True while a session exists but profile/admin details are still loading. */
  detailsLoading: boolean;
  session: Session | null;
  profile: UserProfile | null;
  isAdmin: boolean;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
}

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const userId = session?.user?.id ?? null;

  useEffect(() => {
    let cancelled = false;
    setProfile(null);
    setIsAdmin(false);
    if (!userId) return;
    setDetailsLoading(true);
    (async () => {
      const [{ data: prof }, { data: adm }] = await Promise.all([
        supabase.from("users").select("id, name, phone, created_at").eq("id", userId).maybeSingle(),
        supabase.from("admin_users").select("id").eq("id", userId).eq("is_active", true).maybeSingle(),
      ]);
      if (cancelled) return;
      setProfile((prof as UserProfile | null) ?? null);
      setIsAdmin(!!adm);
      setDetailsLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const refresh = useCallback(async () => {
    if (!userId) return;
    const { data: prof } = await supabase
      .from("users")
      .select("id, name, phone, created_at")
      .eq("id", userId)
      .maybeSingle();
    setProfile((prof as UserProfile | null) ?? null);
  }, [userId]);

  const signOut = useCallback(async () => {
    await authSignOut();
    setProfile(null);
    setIsAdmin(false);
  }, []);

  return (
    <SessionContext.Provider value={{ loading, detailsLoading, session, profile, isAdmin, refresh, signOut }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used inside SessionProvider");
  return ctx;
}

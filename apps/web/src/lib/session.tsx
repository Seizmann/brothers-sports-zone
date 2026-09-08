import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
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
  const checkedUidRef = useRef<string | null>(null);

  /** Every session update must also flag details as loading in the same
   *  React batch — otherwise a render can see "session set, details stale"
   *  and route guards would bounce an admin to login (the reload race). */
  const applySession = useCallback((next: Session | null) => {
    const uid = next?.user?.id ?? null;
    setSession(next);
    if (uid && checkedUidRef.current !== uid) {
      setDetailsLoading(true);
    } else if (!uid) {
      setDetailsLoading(false);
    }
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => applySession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => applySession(next));
    supabase.auth.getSession().finally(() => setLoading(false));
    return () => sub.subscription.unsubscribe();
  }, [applySession]);

  const userId = session?.user?.id ?? null;

  useEffect(() => {
    let cancelled = false;
    if (!userId) {
      setProfile(null);
      setIsAdmin(false);
      return;
    }
    if (checkedUidRef.current === userId) return;
    checkedUidRef.current = userId;
    setDetailsLoading(true);
    // A transient network failure here must not look like "not an admin" —
    // retry before concluding, otherwise a reload can bounce admins to login.
    const attempt = async (triesLeft: number): Promise<void> => {
      const [{ data: prof, error: profErr }, { data: adm, error: admErr }] = await Promise.all([
        supabase.from("users").select("id, name, phone, created_at").eq("id", userId).maybeSingle(),
        supabase.from("admin_users").select("id").eq("id", userId).eq("is_active", true).maybeSingle(),
      ]);
      if (cancelled) return;
      if ((profErr || admErr) && triesLeft > 0) {
        checkedUidRef.current = null;
        await new Promise((r) => setTimeout(r, 1200));
        return attempt(triesLeft - 1);
      }
      setProfile((prof as UserProfile | null) ?? null);
      setIsAdmin(!admErr && !!adm);
      setDetailsLoading(false);
    };
    void attempt(2);
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
    checkedUidRef.current = null;
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

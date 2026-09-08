import { useEffect, useState } from "react";
import { supabase } from "../../../../lib/supabase";
import { useSession } from "../../../../lib/session";
import type { AdminUser } from "@brothers-sports-zone/shared-types";
import { formatDhakaDate } from "../../../../lib/format";

export default function AdminsPage() {
  const { session } = useSession();
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  async function load() {
    const { data, error: e } = await supabase.from("admin_users").select("*").order("created_at");
    if (e) setError(e.message);
    else setAdmins((data ?? []) as AdminUser[]);
    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, []);

  async function create() {
    setError(null);
    setNotice(null);
    setBusy(true);
    const { data, error: e } = await supabase.rpc("admin_create_admin", {
      p_email: email.trim(),
      p_password: password,
    });
    setBusy(false);
    if (e) {
      setError(e.message);
      return;
    }
    setNotice(`Admin account created for ${email.trim()}. They can sign in at /management/login.`);
    setEmail("");
    setPassword("");
    await load();
  }

  async function setActive(admin: AdminUser, active: boolean) {
    setError(null);
    const { error: e } = await supabase.from("admin_users").update({ is_active: active }).eq("id", admin.id);
    if (e) setError(e.message);
    await load();
  }

  return (
    <div>
      <p className="eyebrow mb-4 text-white/60">Management</p>
      <h1 className="display-xl">Admin accounts</h1>
      <p className="caption mt-3 max-w-xl text-white/60">
        All admins are super_admins with equal full access. Deactivated accounts cannot sign in.
      </p>

      {error && <p className="mt-6 text-white">{error}</p>}
      {notice && <p className="caption mt-6 text-white/70">{notice}</p>}
      {loading && <p className="micro-cap mt-10 text-white/50">Loading</p>}

      {!loading && (
        <>
          <div className="mt-10 flex flex-wrap items-end gap-4 rounded-sm border border-hairline-on-dark p-5">
            <label className="block">
              <span className="micro-cap block text-white/50">Email</span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="new.admin@brotherssportszone.com"
                className="text-input !min-h-[40px] !w-72 !py-1"
              />
            </label>
            <label className="block">
              <span className="micro-cap block text-white/50">Password (min 8 chars)</span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="text-input !min-h-[40px] !w-56 !py-1"
              />
            </label>
            <button
              type="button"
              onClick={() => void create()}
              disabled={busy || !email.trim() || password.length < 8}
              className="ghost-button button-cap !min-h-[40px] !py-2 disabled:opacity-40"
            >
              {busy ? "Creating" : "Create admin"}
            </button>
          </div>

          <ul className="mt-10 flex flex-col">
            {admins.map((a) => {
              const isSelf = a.id === session?.user?.id;
              return (
                <li key={a.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-hairline-on-dark py-3">
                  <span className="button-cap">
                    {a.email}
                    {isSelf && <span className="micro-cap text-white/40"> (you)</span>}
                  </span>
                  <span className="caption text-white/50">since {formatDhakaDate(a.created_at.slice(0, 10))}</span>
                  <span className="micro-cap">{a.is_active ? "Active" : "Deactivated"}</span>
                  <span>
                    {a.is_active && !isSelf && (
                      <button
                        type="button"
                        onClick={() => void setActive(a, false)}
                        className="micro-cap text-white/60 underline"
                      >
                        Deactivate
                      </button>
                    )}
                    {!a.is_active && (
                      <button
                        type="button"
                        onClick={() => void setActive(a, true)}
                        className="micro-cap text-white/60 underline"
                      >
                        Reactivate
                      </button>
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}

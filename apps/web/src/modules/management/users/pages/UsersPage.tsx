import { useEffect, useState } from "react";
import { supabase } from "../../../../lib/supabase";
import type { UserProfile } from "@brothers-sports-zone/shared-types";
import { formatDhakaDate } from "../../../../lib/format";
import { statusLabel } from "../../bookings/lib/adminBookingsData";
import type { Booking } from "@brothers-sports-zone/shared-types";

export default function UsersPage() {
  const [search, setSearch] = useState("");
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [selected, setSelected] = useState<UserProfile | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [newPin, setNewPin] = useState("");
  const [confirmReset, setConfirmReset] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from("users")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50)
      .then(({ data, error: e }) => {
        if (e) setError(e.message);
        else setUsers((data ?? []) as UserProfile[]);
        setLoading(false);
      });
  }, []);

  const filtered = users.filter((u) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return u.phone.includes(q) || u.name.toLowerCase().includes(q);
  });

  async function openUser(user: UserProfile) {
    setSelected(user);
    setBookings([]);
    setNotice(null);
    setError(null);
    const { data, error: e } = await supabase
      .from("bookings")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    if (e) setError(e.message);
    else setBookings((data ?? []) as Booking[]);
  }

  async function resetPin() {
    if (!selected) return;
    setError(null);
    setBusy(true);
    const { error: e } = await supabase.rpc("admin_reset_user_pin", {
      p_user_id: selected.id,
      p_new_pin: newPin,
    });
    setBusy(false);
    if (e) {
      setError(e.message);
      return;
    }
    setNotice(`PIN reset for ${selected.name} (${selected.phone}). Share the new PIN in person or by phone.`);
    setNewPin("");
    setConfirmReset(false);
  }

  return (
    <div>
      <p className="eyebrow mb-4 text-white/60">Management</p>
      <h1 className="display-xl">Users</h1>
      <p className="caption mt-3 max-w-xl text-white/60">
        Search by phone or name. PIN resets are triggered by user request — there is no self-service reset.
      </p>

      {error && <p className="mt-6 text-white">{error}</p>}
      {notice && <p className="caption mt-6 text-white/70">{notice}</p>}

      <div className="mt-8">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search phone or name"
          className="text-input !min-h-[40px] !w-72 !py-1"
        />
      </div>

      {loading && <p className="micro-cap mt-10 text-white/50">Loading</p>}

      {!loading && (
        <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-2">
          <ul className="flex flex-col">
            {filtered.length === 0 && <p className="caption text-white/50">No users match.</p>}
            {filtered.map((u) => (
              <li key={u.id}>
                <button
                  type="button"
                  onClick={() => void openUser(u)}
                  className={`flex w-full items-center justify-between gap-3 border-b border-hairline-on-dark py-3 text-left ${
                    selected?.id === u.id ? "text-white" : "text-white/70 hover:text-white"
                  }`}
                >
                  <span className="button-cap">{u.name}</span>
                  <span className="caption">{u.phone}</span>
                </button>
              </li>
            ))}
          </ul>

          {selected && (
            <aside className="rounded-sm border border-hairline-on-dark p-5">
              <h2 className="button-cap">{selected.name}</h2>
              <p className="caption mt-1 text-white/50">
                {selected.phone} · joined {formatDhakaDate(selected.created_at.slice(0, 10))}
              </p>

              <h3 className="button-cap mt-8 text-white/60">Reset PIN</h3>
              {confirmReset ? (
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={4}
                    value={newPin}
                    onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ""))}
                    placeholder="New 4-digit PIN"
                    className="text-input !min-h-[40px] !w-40 !py-1"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => void resetPin()}
                    disabled={busy || newPin.length !== 4}
                    className="micro-cap underline disabled:opacity-40"
                  >
                    {busy ? "Resetting" : "Confirm reset"}
                  </button>
                  <button type="button" onClick={() => setConfirmReset(false)} className="micro-cap text-white/50 underline">
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmReset(true)}
                  className="micro-cap mt-3 block text-white/70 underline"
                >
                  Set a new PIN for this user
                </button>
              )}

              <h3 className="button-cap mt-8 text-white/60">Booking history</h3>
              {bookings.length === 0 ? (
                <p className="caption mt-3 text-white/50">No bookings.</p>
              ) : (
                <ul className="mt-3 flex flex-col">
                  {bookings.map((b) => (
                    <li key={b.id} className="flex items-center justify-between gap-3 border-b border-hairline-on-dark py-2">
                      <span className="button-cap">{b.booking_code}</span>
                      <span className="micro-cap text-white/60">{statusLabel(b.status)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </aside>
          )}
        </div>
      )}
    </div>
  );
}

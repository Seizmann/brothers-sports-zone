import { useEffect, useState } from "react";
import { supabase } from "../../../../lib/supabase";
import type { Blackout, Slot } from "@brothers-sports-zone/shared-types";
import { dhakaToday, formatDhakaDate } from "../../../../lib/format";

interface BlackoutRow extends Blackout {
  slots: { label: string } | null;
}

export default function BlackoutsPage() {
  const [rows, setRows] = useState<BlackoutRow[]>([]);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [date, setDate] = useState(dhakaToday());
  const [slotId, setSlotId] = useState<string>("all");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  async function load() {
    const [{ data: bl, error: e1 }, { data: sl, error: e2 }] = await Promise.all([
      supabase.from("blackouts").select("*, slots(label)").gte("date", dhakaToday()).order("date"),
      supabase.from("slots").select("*").order("slot_number"),
    ]);
    if (e1 || e2) {
      setError((e1 ?? e2)?.message ?? "Could not load blackouts.");
    } else {
      setRows((bl ?? []) as BlackoutRow[]);
      setSlots((sl ?? []) as Slot[]);
    }
    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, []);

  async function add() {
    setError(null);
    setBusy(true);
    const { error: e } = await supabase.from("blackouts").insert({
      date,
      slot_id: slotId === "all" ? null : Number(slotId),
      reason: reason.trim() || null,
    });
    setBusy(false);
    if (e) {
      setError(e.message.includes("duplicate") ? "This slot is already blacked out for that date." : e.message);
      return;
    }
    setReason("");
    await load();
  }

  async function remove(id: string) {
    setError(null);
    const { error: e } = await supabase.from("blackouts").delete().eq("id", id);
    if (e) setError(e.message);
    await load();
  }

  return (
    <div>
      <p className="eyebrow mb-4 text-white/60">Management</p>
      <h1 className="display-xl">Blackouts</h1>
      <p className="caption mt-3 max-w-xl text-white/60">
        Closed slots show as unavailable immediately. Black out a whole day or individual slots.
      </p>

      {error && <p className="mt-6 text-white">{error}</p>}
      {loading && <p className="micro-cap mt-10 text-white/50">Loading</p>}

      {!loading && (
        <>
          <div className="mt-10 flex flex-wrap items-end gap-4 rounded-sm border border-hairline-on-dark p-5">
            <label className="block">
              <span className="micro-cap block text-white/50">Date</span>
              <input
                type="date"
                min={dhakaToday()}
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="text-input !min-h-[40px] !py-1 [color-scheme:dark]"
              />
            </label>
            <label className="block">
              <span className="micro-cap block text-white/50">Scope</span>
              <select
                value={slotId}
                onChange={(e) => setSlotId(e.target.value)}
                className="text-input !min-h-[40px] !w-48 !py-1 [color-scheme:dark]"
              >
                <option value="all">Entire day</option>
                {slots.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="micro-cap block text-white/50">Reason (internal note)</span>
              <input
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Maintenance"
                className="text-input !min-h-[40px] !w-56 !py-1"
              />
            </label>
            <button
              type="button"
              onClick={() => void add()}
              disabled={busy}
              className="ghost-button button-cap !min-h-[40px] !py-2 disabled:opacity-40"
            >
              {busy ? "Adding" : "Add blackout"}
            </button>
          </div>

          <div className="mt-10">
            <h2 className="button-cap mb-4 text-white/60">Upcoming blackouts</h2>
            {rows.length === 0 ? (
              <p className="caption text-white/50">None scheduled.</p>
            ) : (
              <ul className="flex flex-col">
                {rows.map((r) => (
                  <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-hairline-on-dark py-3">
                    <span className="button-cap">{formatDhakaDate(r.date)}</span>
                    <span className="caption text-white/70">{r.slots?.label ?? "Entire day"}</span>
                    <span className="caption text-white/50">{r.reason ?? "—"}</span>
                    <button type="button" onClick={() => void remove(r.id)} className="micro-cap text-white/60 underline">
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}

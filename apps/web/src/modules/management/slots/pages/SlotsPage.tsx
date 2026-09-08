import { useEffect, useState } from "react";
import { supabase } from "../../../../lib/supabase";
import type { Slot } from "@brothers-sports-zone/shared-types";
import { bdt, formatSlotRange } from "../../../../lib/format";

export default function SlotsPage() {
  const [slots, setSlots] = useState<Slot[]>([]);
  const [drafts, setDrafts] = useState<Record<number, string>>({});
  const [savingId, setSavingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from("slots")
      .select("*")
      .order("slot_number")
      .then(({ data, error: e }) => {
        if (e) setError(e.message);
        else {
          setSlots((data ?? []) as Slot[]);
          setDrafts(Object.fromEntries((data ?? []).map((s) => [s.id, String(s.price)])));
        }
        setLoading(false);
      });
  }, []);

  async function save(slot: Slot) {
    const value = Number(drafts[slot.id]);
    if (Number.isNaN(value) || value < 0) {
      setError("Price must be a non-negative number.");
      return;
    }
    setSavingId(slot.slot_number);
    setError(null);
    setSavedId(null);
    const { error: e } = await supabase.from("slots").update({ price: value }).eq("id", slot.id);
    setSavingId(null);
    if (e) {
      setError(e.message);
      return;
    }
    setSlots((prev) => prev.map((s) => (s.id === slot.id ? { ...s, price: value } : s)));
    setSavedId(slot.slot_number);
  }

  return (
    <div>
      <p className="eyebrow mb-4 text-white/60">Management</p>
      <h1 className="display-xl">Slot pricing</h1>
      <p className="caption mt-3 max-w-xl text-white/60">
        Prices apply to all future bookings of each slot. Existing bookings keep the price they were made at.
      </p>

      {error && <p className="mt-6 text-white">{error}</p>}
      {loading && <p className="micro-cap mt-10 text-white/50">Loading</p>}

      {!loading && (
        <div className="mt-10 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {slots.map((slot) => (
            <div key={slot.id} className="rounded-sm border border-hairline-on-dark p-4">
              <p className="button-cap">{formatSlotRange(slot.label)}</p>
              <p className="micro-cap mt-1 text-white/50">{slot.period}</p>
              <div className="mt-4 flex items-center gap-2">
                <input
                  type="number"
                  min={0}
                  step="10"
                  value={drafts[slot.id] ?? ""}
                  onChange={(e) => setDrafts({ ...drafts, [slot.id]: e.target.value })}
                  className="text-input !min-h-[40px] !py-1"
                  aria-label={`Price for ${formatSlotRange(slot.label)}`}
                />
                <button
                  type="button"
                  onClick={() => void save(slot)}
                  disabled={savingId === slot.slot_number || drafts[slot.id] === String(slot.price)}
                  className="micro-cap shrink-0 underline disabled:opacity-30"
                >
                  {savingId === slot.slot_number ? "Saving" : "Save"}
                </button>
              </div>
              <p className="micro-cap mt-2 text-white/40">
                {savedId === slot.slot_number ? "Saved" : `current ${bdt(slot.price)}`}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

import { useEffect, useState } from "react";
import { supabase } from "../../../../lib/supabase";
import type { Settings } from "@brothers-sports-zone/shared-types";
import { isValidPhone, normalizePhone } from "../../../../lib/format";

/** Site-wide commerce settings (singleton row): manual payment numbers the
 *  checkout shows, and the fixed advance amount the booking RPC charges. */
export default function SettingsPage() {
  const [bkash, setBkash] = useState("");
  const [nagad, setNagad] = useState("");
  const [advance, setAdvance] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    void (async () => {
      const { data, error: e } = await supabase.from("settings").select("*").eq("id", 1).single();
      if (e) setError(e.message);
      else {
        const row = data as Settings;
        setBkash(row.bkash_number ?? "");
        setNagad(row.nagad_number ?? "");
        setAdvance(String(Number(row.advance_amount_fixed)));
      }
      setLoading(false);
    })();
  }, []);

  function checkPhone(label: string, raw: string): string | null {
    const value = normalizePhone(raw);
    if (!value) return null; // empty clears the number; checkout hides the method
    if (!isValidPhone(value)) return `${label} must be an 11-digit Bangladeshi number (01XXXXXXXXX).`;
    return null;
  }

  async function save() {
    setError(null);
    setSaved(false);
    const phoneError = checkPhone("bKash number", bkash) ?? checkPhone("Nagad number", nagad);
    if (phoneError) return setError(phoneError);
    const numericAdvance = Number(advance);
    if (!advance.trim() || Number.isNaN(numericAdvance) || numericAdvance < 0) {
      return setError("Advance amount must be a non-negative number.");
    }
    setBusy(true);
    const { error: e } = await supabase
      .from("settings")
      .update({
        bkash_number: bkash.trim() ? normalizePhone(bkash) : null,
        nagad_number: nagad.trim() ? normalizePhone(nagad) : null,
        advance_amount_fixed: numericAdvance,
      })
      .eq("id", 1);
    setBusy(false);
    if (e) return setError(e.message);
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div>
      <p className="eyebrow mb-4 text-white/60">Management</p>
      <h1 className="display-xl">Settings</h1>

      {error && <p className="mt-6 text-white">{error}</p>}
      {loading && <p className="micro-cap mt-10 text-white/50">Loading</p>}

      {!loading && (
        <>
          <div className="mt-10 flex max-w-xl flex-col gap-5 rounded-sm border border-hairline-on-dark p-5">
            <label className="block">
              <span className="micro-cap block text-white/50">bKash number (Send Money)</span>
              <input
                type="tel"
                value={bkash}
                onChange={(e) => setBkash(e.target.value)}
                placeholder="01XXXXXXXXX"
                className="text-input !min-h-[40px] !py-1"
                aria-label="bKash number"
              />
            </label>
            <label className="block">
              <span className="micro-cap block text-white/50">Nagad number (Send Money)</span>
              <input
                type="tel"
                value={nagad}
                onChange={(e) => setNagad(e.target.value)}
                placeholder="01XXXXXXXXX"
                className="text-input !min-h-[40px] !py-1"
                aria-label="Nagad number"
              />
            </label>
            <p className="micro-cap text-white/50">
              Users send the advance to these numbers during checkout. Leave one empty to hide that payment method.
            </p>
            <label className="block">
              <span className="micro-cap block text-white/50">Advance amount (BDT)</span>
              <input
                type="number"
                min={0}
                value={advance}
                onChange={(e) => setAdvance(e.target.value)}
                className="text-input !min-h-[40px] !w-32 !py-1"
                aria-label="Advance amount in BDT"
              />
            </label>
            <p className="micro-cap text-white/50">
              Fixed amount paid online before arrival. If the booking total is smaller, the whole total is paid online.
            </p>
            <button
              type="button"
              onClick={() => void save()}
              disabled={busy}
              className="ghost-button button-cap !min-h-[40px] !w-fit !px-6 !py-2 disabled:opacity-40"
            >
              {busy ? "Saving" : saved ? "Saved" : "Save settings"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
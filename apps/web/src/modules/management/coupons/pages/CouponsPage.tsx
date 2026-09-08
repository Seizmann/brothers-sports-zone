import { useEffect, useState } from "react";
import { supabase } from "../../../../lib/supabase";
import type { Coupon, CouponType } from "@brothers-sports-zone/shared-types";
import { bdt } from "../../../../lib/format";

export default function CouponsPage() {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [code, setCode] = useState("");
  const [type, setType] = useState<CouponType>("percentage");
  const [value, setValue] = useState("");
  const [validFrom, setValidFrom] = useState("");
  const [validUntil, setValidUntil] = useState("");
  const [usageLimit, setUsageLimit] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  async function load() {
    const { data, error: e } = await supabase.from("coupons").select("*").order("created_at", { ascending: false });
    if (e) setError(e.message);
    else setCoupons((data ?? []) as Coupon[]);
    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, []);

  async function create() {
    setError(null);
    const numericValue = Number(value);
    if (!code.trim()) return setError("Enter a coupon code.");
    if (Number.isNaN(numericValue) || numericValue <= 0) return setError("Value must be a positive number.");
    if (type === "percentage" && numericValue > 100) return setError("Percentage cannot exceed 100.");
    setBusy(true);
    const { error: e } = await supabase.from("coupons").insert({
      code: code.trim().toUpperCase(),
      type,
      value: numericValue,
      valid_from: validFrom || null,
      valid_until: validUntil || null,
      usage_limit: usageLimit ? Number(usageLimit) : null,
    });
    setBusy(false);
    if (e) {
      setError(e.message.includes("duplicate") ? "A coupon with this code already exists." : e.message);
      return;
    }
    setCode("");
    setValue("");
    setValidFrom("");
    setValidUntil("");
    setUsageLimit("");
    await load();
  }

  async function toggleActive(coupon: Coupon) {
    const { error: e } = await supabase.from("coupons").update({ is_active: !coupon.is_active }).eq("id", coupon.id);
    if (e) setError(e.message);
    await load();
  }

  async function remove(coupon: Coupon) {
    const { error: e } = await supabase.from("coupons").delete().eq("id", coupon.id);
    if (e) setError(e.message);
    await load();
  }

  return (
    <div>
      <p className="eyebrow mb-4 text-white/60">Management</p>
      <h1 className="display-xl">Coupons</h1>

      {error && <p className="mt-6 text-white">{error}</p>}
      {loading && <p className="micro-cap mt-10 text-white/50">Loading</p>}

      {!loading && (
        <>
          <div className="mt-10 flex flex-wrap items-end gap-4 rounded-sm border border-hairline-on-dark p-5">
            <label className="block">
              <span className="micro-cap block text-white/50">Code</span>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="EID10"
                className="text-input !min-h-[40px] !w-32 !py-1"
              />
            </label>
            <label className="block">
              <span className="micro-cap block text-white/50">Type</span>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as CouponType)}
                className="text-input !min-h-[40px] !w-36 !py-1 [color-scheme:dark]"
              >
                <option value="percentage">Percentage %</option>
                <option value="flat">Flat BDT</option>
              </select>
            </label>
            <label className="block">
              <span className="micro-cap block text-white/50">{type === "percentage" ? "Percent off" : "BDT off"}</span>
              <input
                type="number"
                min={0}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                className="text-input !min-h-[40px] !w-28 !py-1"
              />
            </label>
            <label className="block">
              <span className="micro-cap block text-white/50">Valid from</span>
              <input
                type="date"
                value={validFrom}
                onChange={(e) => setValidFrom(e.target.value)}
                className="text-input !min-h-[40px] !py-1 [color-scheme:dark]"
              />
            </label>
            <label className="block">
              <span className="micro-cap block text-white/50">Valid until</span>
              <input
                type="date"
                value={validUntil}
                onChange={(e) => setValidUntil(e.target.value)}
                className="text-input !min-h-[40px] !py-1 [color-scheme:dark]"
              />
            </label>
            <label className="block">
              <span className="micro-cap block text-white/50">Usage limit</span>
              <input
                type="number"
                min={1}
                value={usageLimit}
                onChange={(e) => setUsageLimit(e.target.value)}
                placeholder="∞"
                className="text-input !min-h-[40px] !w-24 !py-1"
              />
            </label>
            <button
              type="button"
              onClick={() => void create()}
              disabled={busy}
              className="ghost-button button-cap !min-h-[40px] !py-2 disabled:opacity-40"
            >
              {busy ? "Creating" : "Create coupon"}
            </button>
          </div>

          <div className="mt-10">
            <h2 className="button-cap mb-4 text-white/60">All coupons</h2>
            {coupons.length === 0 ? (
              <p className="caption text-white/50">No coupons yet.</p>
            ) : (
              <ul className="flex flex-col">
                {coupons.map((c) => (
                  <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-hairline-on-dark py-3">
                    <span className="button-cap">{c.code}</span>
                    <span className="caption text-white/70">
                      {c.type === "percentage" ? `${Number(c.value)}% off` : `${bdt(c.value)} off`}
                    </span>
                    <span className="caption text-white/50">
                      {c.valid_from ?? "—"} → {c.valid_until ?? "—"}
                    </span>
                    <span className="caption text-white/50">
                      used {c.usage_count}
                      {c.usage_limit !== null ? `/${c.usage_limit}` : ""}
                    </span>
                    <span className="micro-cap">{c.is_active ? "Active" : "Inactive"}</span>
                    <span className="flex gap-3">
                      <button type="button" onClick={() => void toggleActive(c)} className="micro-cap text-white/60 underline">
                        {c.is_active ? "Deactivate" : "Activate"}
                      </button>
                      <button type="button" onClick={() => void remove(c)} className="micro-cap text-white/60 underline">
                        Delete
                      </button>
                    </span>
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

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../../../lib/supabase";
import type { Booking, BookingItem } from "@brothers-sports-zone/shared-types";
import { bdt, dhakaDateShifted, dhakaToday, formatDhakaDate, formatSlotRange } from "../../../../lib/format";
import { paymentMethodLabel } from "../../../../lib/baniqPay";

interface ItemWithSlot extends BookingItem {
  slots: { label: string; period: string } | null;
}

const RANGES = [
  { label: "Last 7 days", days: 7 },
  { label: "Last 30 days", days: 30 },
  { label: "Last 90 days", days: 90 },
];

function exportCsv(filename: string, rows: string[][]) {
  const csv = rows.map((r) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function AnalyticsPage() {
  const [rangeDays, setRangeDays] = useState(30);
  const [fromDate, setFromDate] = useState(dhakaDateShifted(-29));
  const [toDate, setToDate] = useState(dhakaToday());
  const [items, setItems] = useState<ItemWithSlot[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);
      const [{ data: bl, error: e1 }, { data: bi, error: e2 }] = await Promise.all([
        supabase.from("bookings").select("*").gte("created_at", `${fromDate}T00:00:00+06:00`),
        supabase
          .from("booking_items")
          .select("*, slots(label, period)")
          .gte("date", fromDate)
          .lte("date", toDate),
      ]);
      if (e1 || e2) {
        setError((e1 ?? e2)?.message ?? "Could not load analytics.");
      } else {
        setBookings((bl ?? []) as Booking[]);
        setItems((bi ?? []) as ItemWithSlot[]);
      }
      setLoading(false);
    })();
  }, [fromDate, toDate]);

  const stats = useMemo(() => {
    const active = ["pending_payment", "payment_submitted", "confirmed"];
    const activeBookings = bookings.filter((b) => active.includes(b.status));
    const activeItemIds = new Set(activeBookings.map((b) => b.id));
    const activeItems = items.filter((i) => activeItemIds.has(i.booking_id));
    const confirmed = bookings.filter((b) => b.status === "confirmed");

    const gross = activeBookings.reduce((sum, b) => sum + Number(b.total_amount), 0);
    const advanceCollected = activeBookings.reduce((sum, b) => sum + Number(b.advance_amount), 0);
    const expectedCash = activeBookings.reduce((sum, b) => sum + Number(b.cash_due), 0);
    const discounts = activeBookings.reduce((sum, b) => sum + Number(b.discount_amount), 0);

    const byDay = new Map<string, number>();
    for (const item of activeItems) {
      byDay.set(item.date, (byDay.get(item.date) ?? 0) + Number(item.price));
    }
    const daySeries = [...byDay.entries()].sort(([a], [b]) => a.localeCompare(b));
    const maxDay = Math.max(1, ...daySeries.map(([, v]) => v));

    const bySlot = new Map<string, number>();
    for (const item of activeItems) {
      const label = item.slots ? formatSlotRange(item.slots.label) : `#${item.slot_id}`;
      bySlot.set(label, (bySlot.get(label) ?? 0) + Number(item.price));
    }
    const slotSeries = [...bySlot.entries()].sort(([, a], [, b]) => b - a);
    const maxSlot = Math.max(1, ...slotSeries.map(([, v]) => v));

    const byMethod: Record<string, number> = { bkash: 0, nagad: 0, cash: 0, baniq_pay: 0 };
    for (const b of activeBookings) {
      if (b.payment_method) byMethod[b.payment_method] += Number(b.total_amount);
    }

    const bySlotCount = new Map<string, number>();
    for (const item of activeItems) {
      const label = item.slots ? formatSlotRange(item.slots.label) : `#${item.slot_id}`;
      bySlotCount.set(label, (bySlotCount.get(label) ?? 0) + 1);
    }
    const busiest = [...bySlotCount.entries()].sort(([, a], [, b]) => b - a).slice(0, 5);

    const cancellations = bookings.filter((b) => b.status === "cancelled").length;
    const rejections = bookings.filter((b) => b.status === "rejected").length;

    return {
      gross, advanceCollected, expectedCash, discounts, daySeries, maxDay, slotSeries, maxSlot,
      byMethod, busiest, cancellations, rejections, confirmed: confirmed.length, count: activeBookings.length,
    };
  }, [bookings, items]);

  function csv() {
    const rows: string[][] = [
      ["BSZ analytics report"],
      ["Range", fromDate, "to", toDate],
      [],
      ["Metric", "Value (BDT)"],
      ["Active bookings", String(stats.count)],
      ["Gross (active bookings)", String(stats.gross)],
      ["Discounts given", String(stats.discounts)],
      ["Advance collected online", String(stats.advanceCollected)],
      ["Expected cash on arrival", String(stats.expectedCash)],
      ["Confirmed", String(stats.confirmed)],
      ["Cancellations", String(stats.cancellations)],
      ["Rejections", String(stats.rejections)],
      [],
      ["Revenue by slot"],
      ...stats.slotSeries.map(([label, v]) => [label, String(v)]),
      [],
      ["Revenue by day"],
      ...stats.daySeries.map(([d, v]) => [d, String(v)]),
    ];
    exportCsv(`bsz-analytics-${fromDate}-to-${toDate}.csv`, rows);
  }

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow mb-4 text-white/60">Management</p>
          <h1 className="display-xl">Analytics</h1>
        </div>
        <button type="button" onClick={csv} className="ghost-button button-cap !min-h-[40px] !py-2">
          Export CSV
        </button>
      </div>

      <div className="mt-8 flex flex-wrap items-end gap-4">
        {RANGES.map((r) => (
          <button
            key={r.days}
            type="button"
            onClick={() => {
              setRangeDays(r.days);
              setFromDate(dhakaDateShifted(-(r.days - 1)));
              setToDate(dhakaToday());
            }}
            aria-pressed={rangeDays === r.days}
            className={`min-h-[40px] rounded-full border px-5 button-cap ${
              rangeDays === r.days ? "border-white bg-white text-black" : "border-hairline-on-dark text-white/70"
            }`}
          >
            {r.label}
          </button>
        ))}
        <label className="block">
          <span className="micro-cap block text-white/50">From</span>
          <input
            type="date"
            value={fromDate}
            onChange={(e) => {
              setRangeDays(0);
              setFromDate(e.target.value);
            }}
            className="text-input !min-h-[40px] !py-1 [color-scheme:dark]"
          />
        </label>
        <label className="block">
          <span className="micro-cap block text-white/50">To</span>
          <input
            type="date"
            value={toDate}
            onChange={(e) => {
              setRangeDays(0);
              setToDate(e.target.value);
            }}
            className="text-input !min-h-[40px] !py-1 [color-scheme:dark]"
          />
        </label>
      </div>

      {error && <p className="mt-6 text-white">{error}</p>}
      {loading && <p className="micro-cap mt-10 text-white/50">Loading</p>}

      {!loading && (
        <>
          <div className="mt-10 grid grid-cols-2 gap-4 xl:grid-cols-4">
            {[
              ["Active bookings", String(stats.count)],
              ["Gross", bdt(stats.gross)],
              ["Advance collected", bdt(stats.advanceCollected)],
              ["Expected cash", bdt(stats.expectedCash)],
            ].map(([label, value]) => (
              <div key={label} className="rounded-sm border border-hairline-on-dark p-5">
                <p className="micro-cap text-white/50">{label}</p>
                <p className="display-lg mt-3 !text-2xl">{value}</p>
              </div>
            ))}
          </div>
          <p className="caption mt-4 text-white/50">
            {stats.confirmed} confirmed · {stats.cancellations} cancellations · {stats.rejections} rejections ·
            discounts given {bdt(stats.discounts)}
          </p>

          {/* Revenue by day — hand-rolled bar chart in pure black/white */}
          <section className="mt-14">
            <h2 className="button-cap mb-6 text-white/60">Revenue by day</h2>
            {stats.daySeries.length === 0 ? (
              <p className="caption text-white/50">No data in this range.</p>
            ) : (
              <div className="flex h-48 items-end gap-1 border-b border-hairline-on-dark">
                {stats.daySeries.map(([day, value]) => (
                  <div key={day} className="group relative flex flex-1 flex-col items-center justify-end">
                    <span className="caption absolute -top-6 hidden bg-white px-1 text-black group-hover:block">
                      {bdt(value)}
                    </span>
                    <div
                      className="w-full bg-white"
                      style={{ height: `${Math.max(2, (value / stats.maxDay) * 100)}%` }}
                      title={`${day}: ${bdt(value)}`}
                    />
                  </div>
                ))}
              </div>
            )}
            {stats.daySeries.length > 0 && (
              <div className="mt-2 flex justify-between">
                <span className="micro-cap text-white/40">{formatDhakaDate(stats.daySeries[0][0])}</span>
                <span className="micro-cap text-white/40">
                  {formatDhakaDate(stats.daySeries[stats.daySeries.length - 1][0])}
                </span>
              </div>
            )}
          </section>

          {/* Slot revenue + method split + busiest */}
          <section className="mt-14 grid grid-cols-1 gap-12 lg:grid-cols-2">
            <div>
              <h2 className="button-cap mb-6 text-white/60">Revenue by slot</h2>
              {stats.slotSeries.length === 0 ? (
                <p className="caption text-white/50">No data.</p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {stats.slotSeries.map(([label, value]) => (
                    <li key={label} className="flex items-center gap-3">
                      <span className="caption w-28 shrink-0 text-white/70">{label}</span>
                      <span className="h-4 bg-white" style={{ width: `${(value / stats.maxSlot) * 70}%` }} />
                      <span className="caption text-white/50">{bdt(value)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <h2 className="button-cap mb-6 text-white/60">Revenue by payment method</h2>
              <ul className="flex flex-col gap-3">
                {(["bkash", "nagad", "cash", "baniq_pay"] as const).map((m) => {
                  const share = Math.round((stats.byMethod[m] / (stats.gross || 1)) * 100);
                  return (
                    <li key={m} className="flex items-center justify-between gap-3">
                      <span className="button-cap">{paymentMethodLabel(m)}</span>
                      <span className="h-4 flex-1 border border-hairline-on-dark">
                        <span className="block h-full bg-white" style={{ width: `${share}%` }} />
                      </span>
                      <span className="caption w-32 text-right text-white/60">{bdt(stats.byMethod[m])}</span>
                    </li>
                  );
                })}
              </ul>
              <h2 className="button-cap mb-6 mt-12 text-white/60">Busiest slots</h2>
              {stats.busiest.length === 0 ? (
                <p className="caption text-white/50">No data.</p>
              ) : (
                <ul className="flex flex-col">
                  {stats.busiest.map(([label, count]) => (
                    <li key={label} className="flex items-center justify-between border-b border-hairline-on-dark py-2">
                      <span className="caption text-white/70">{label}</span>
                      <span className="caption">{count}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        </>
      )}
    </div>
  );
}

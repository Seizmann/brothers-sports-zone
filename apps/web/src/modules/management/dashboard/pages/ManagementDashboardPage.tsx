import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../../../../lib/supabase";
import type { Booking } from "@brothers-sports-zone/shared-types";
import { bdt, dhakaToday, formatDhakaDate } from "../../../../lib/format";

interface BookingWithItems extends Booking {
  booking_items: Array<{ date: string; price: number }>;
}

async function fetchAllBookings(): Promise<BookingWithItems[]> {
  const { data, error } = await supabase
    .from("bookings")
    .select("*, booking_items(date, price)")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as BookingWithItems[];
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-sm border border-hairline-on-dark p-6">
      <p className="micro-cap text-white/50">{label}</p>
      <p className="display-lg mt-3 !text-3xl">{value}</p>
    </div>
  );
}

export default function ManagementDashboardPage() {
  const [bookings, setBookings] = useState<BookingWithItems[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAllBookings()
      .then(setBookings)
      .catch((e) => setError(e instanceof Error ? e.message : "Could not load data."))
      .finally(() => setLoading(false));
  }, []);

  const today = dhakaToday();

  const stats = useMemo(() => {
    const todaysBookings = bookings.filter((b) => (b.booking_items ?? []).some((i) => i.date === today));
    const pending = bookings.filter((b) => b.status === "payment_submitted");
    const revenueToday = todaysBookings
      .filter((b) => b.status === "confirmed")
      .reduce((sum, b) => sum + Number(b.total_amount), 0);
    const activeSlotsToday = todaysBookings
      .filter((b) => ["pending_payment", "payment_submitted", "confirmed"].includes(b.status))
      .reduce((sum, b) => sum + (b.booking_items?.length ?? 0), 0);
    return { todaysBookings, pending, revenueToday, activeSlotsToday };
  }, [bookings, today]);

  return (
    <div>
      <p className="eyebrow mb-4 text-white/60">Management</p>
      <h1 className="display-xl">Overview</h1>
      <p className="caption mt-3 text-white/60">
        {formatDhakaDate(today)} · all times Asia/Dhaka
      </p>

      {error && <p className="mt-8 text-white">{error}</p>}
      {loading && <p className="micro-cap mt-10 text-white/50">Loading</p>}

      {!loading && (
        <>
          <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Today's bookings" value={stats.todaysBookings.length} />
            <StatCard label="Revenue today (confirmed)" value={bdt(stats.revenueToday)} />
            <StatCard label="Pending payments" value={stats.pending.length} />
            <StatCard label="Active slots today" value={stats.activeSlotsToday} />
          </div>

          <div className="mt-10 flex flex-wrap gap-4">
            <Link to="/management/bookings/new" className="ghost-button button-cap inline-flex items-center justify-center">
              New manual booking
            </Link>
            <Link
              to="/management/bookings?status=payment_submitted"
              className="ghost-button button-cap inline-flex items-center justify-center"
            >
              View payment queue ({stats.pending.length})
            </Link>
          </div>

          <section className="mt-14">
            <h2 className="button-cap mb-5 text-white/60">Latest bookings</h2>
            {bookings.length === 0 ? (
              <p className="caption text-white/50">No bookings yet.</p>
            ) : (
              <ul className="flex flex-col">
                {bookings.slice(0, 8).map((b) => (
                  <li key={b.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-hairline-on-dark py-3">
                    <span className="button-cap">{b.booking_code}</span>
                    <span className="caption capitalize text-white/60">{b.status.replace("_", " ")}</span>
                    <span className="caption text-white/60">{bdt(b.total_amount)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}

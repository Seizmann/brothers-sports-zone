import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useSession } from "../../../lib/session";
import { fetchMyBookings, type BookingWithItems } from "../lib/dashboardData";
import { StatusChip } from "../components/StatusChip";
import { bdt, dhakaToday, formatDhakaDate } from "../../../lib/format";

function summarizeSlots(booking: BookingWithItems): string {
  const items = [...(booking.booking_items ?? [])].sort(
    (a, b) => a.date.localeCompare(b.date) || a.slot_id - b.slot_id,
  );
  if (items.length === 0) return "No slots";
  const byDate = new Map<string, string[]>();
  for (const item of items) {
    byDate.set(item.date, [...(byDate.get(item.date) ?? []), item.slots?.label ?? `#${item.slot_id}`]);
  }
  return [...byDate.entries()]
    .map(([date, labels]) => `${formatDhakaDate(date)} · ${labels.join(", ")}`)
    .join("  |  ");
}

function BookingCard({ booking }: { booking: BookingWithItems }) {
  return (
    <Link
      to={`/dashboard/booking/${booking.id}`}
      className="block rounded-sm border border-hairline-on-dark p-5 transition-colors hover:border-white"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="button-cap">{booking.booking_code}</span>
        <StatusChip status={booking.status} />
      </div>
      <p className="mt-3 text-sm leading-6 text-white/70">{summarizeSlots(booking)}</p>
      <p className="caption mt-3 text-white/50">
        {bdt(booking.total_amount)} · advance {bdt(booking.advance_amount)} · cash due {bdt(booking.cash_due)}
      </p>
      {booking.status === "rejected" && booking.rejection_reason && (
        <p className="caption mt-2 text-white/80">Reason: {booking.rejection_reason}</p>
      )}
    </Link>
  );
}

export default function DashboardPage() {
  const { session } = useSession();
  const [bookings, setBookings] = useState<BookingWithItems[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!session?.user?.id) return;
    fetchMyBookings(session.user.id)
      .then(setBookings)
      .catch((e) => setError(e instanceof Error ? e.message : "Could not load bookings."))
      .finally(() => setLoading(false));
  }, [session?.user?.id]);

  const { upcoming, past } = useMemo(() => {
    const today = dhakaToday();
    const active = ["pending_payment", "payment_submitted", "confirmed"];
    const hasFutureSlot = (b: BookingWithItems) =>
      active.includes(b.status) && (b.booking_items ?? []).some((i) => i.date >= today);
    const upcoming = bookings.filter(hasFutureSlot).sort((a, b) => {
      const aDate = a.booking_items.map((i) => i.date).sort()[0] ?? "9999";
      const bDate = b.booking_items.map((i) => i.date).sort()[0] ?? "9999";
      return aDate.localeCompare(bDate);
    });
    const past = bookings.filter((b) => !hasFutureSlot(b));
    return { upcoming, past };
  }, [bookings]);

  return (
    <main className="mx-auto min-h-screen w-full max-w-5xl px-6 pb-24 pt-28 sm:px-10 sm:pt-36 lg:px-16">
      <p className="eyebrow mb-4 text-white/60">Your bookings</p>
      <h1 className="display-xl">Dashboard</h1>

      {error && <p className="mt-8 text-white">{error}</p>}
      {loading && <p className="micro-cap mt-10 text-white/50">Loading</p>}

      {!loading && (
        <>
          <section className="mt-12">
            <h2 className="button-cap mb-5 text-white/60">Upcoming</h2>
            {upcoming.length === 0 ? (
              <p className="caption text-white/50">
                No upcoming bookings.{" "}
                <Link to="/book" className="underline">
                  Book a slot
                </Link>
                .
              </p>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {upcoming.map((b) => (
                  <BookingCard key={b.id} booking={b} />
                ))}
              </div>
            )}
          </section>

          <section className="mt-14">
            <h2 className="button-cap mb-5 text-white/60">History</h2>
            {past.length === 0 ? (
              <p className="caption text-white/50">No past bookings yet.</p>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {past.map((b) => (
                  <BookingCard key={b.id} booking={b} />
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </main>
  );
}

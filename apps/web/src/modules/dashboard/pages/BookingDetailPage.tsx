import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useSession } from "../../../lib/session";
import { cancelMyBooking, fetchBookingForUser, type BookingWithItems } from "../lib/dashboardData";
import { StatusChip } from "../components/StatusChip";
import { bdt, formatDhakaDate, formatSlotRange } from "../../../lib/format";
import { SITE } from "../../../lib/site";

function Receipt({ booking, userName }: { booking: BookingWithItems; userName: string }) {
  return (
    <div className="receipt mt-10 rounded-sm border border-hairline-on-dark p-6">
      <p className="eyebrow">{SITE.name}</p>
      <p className="caption mt-1 text-white/60">{SITE.address}</p>
      <h2 className="display-lg mt-8">Receipt</h2>
      <dl className="mt-8 grid grid-cols-1 gap-x-10 gap-y-2 sm:grid-cols-2">
        <div className="flex justify-between gap-4 border-b border-hairline-on-dark py-2">
          <dt className="caption text-white/60">Booking ID</dt>
          <dd className="caption font-bold">{booking.booking_code}</dd>
        </div>
        <div className="flex justify-between gap-4 border-b border-hairline-on-dark py-2">
          <dt className="caption text-white/60">Booked on</dt>
          <dd className="caption">{formatDhakaDate(booking.created_at.slice(0, 10))}</dd>
        </div>
        <div className="flex justify-between gap-4 border-b border-hairline-on-dark py-2">
          <dt className="caption text-white/60">Name</dt>
          <dd className="caption">{userName}</dd>
        </div>
        {booking.payment_method && (
          <div className="flex justify-between gap-4 border-b border-hairline-on-dark py-2">
            <dt className="caption text-white/60">Payment</dt>
            <dd className="caption capitalize">
              {booking.payment_method}
              {booking.txn_id ? ` · ${booking.txn_id}` : ""}
            </dd>
          </div>
        )}
      </dl>
      <ul className="mt-6">
        {booking.booking_items.map((item) => (
          <li key={item.slot_id} className="flex justify-between border-b border-hairline-on-dark py-2">
            <span className="caption">
              {formatDhakaDate(item.date)} · {item.slots ? formatSlotRange(item.slots.label) : `Slot #${item.slot_id}`}
            </span>
            <span className="caption">{bdt(item.price)}</span>
          </li>
        ))}
      </ul>
      <div className="mt-4 flex flex-col gap-1">
        {booking.discount_amount > 0 && (
          <div className="flex justify-between">
            <span className="caption text-white/60">Discount</span>
            <span className="caption">−{bdt(booking.discount_amount)}</span>
          </div>
        )}
        <div className="flex justify-between">
          <span className="button-cap">Total</span>
          <span className="button-cap">{bdt(booking.total_amount)}</span>
        </div>
        <div className="flex justify-between">
          <span className="caption text-white/60">Advance paid online</span>
          <span className="caption">{bdt(booking.advance_amount)}</span>
        </div>
        <div className="flex justify-between">
          <span className="caption text-white/60">Cash due on arrival</span>
          <span className="caption">{bdt(booking.cash_due)}</span>
        </div>
      </div>
    </div>
  );
}

export default function BookingDetailPage() {
  const { id } = useParams();
  const { session, profile } = useSession();
  const [booking, setBooking] = useState<BookingWithItems | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!session?.user?.id || !id) return;
    try {
      const data = await fetchBookingForUser(id, session.user.id);
      if (!data) setError("Booking not found.");
      setBooking(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load booking.");
    } finally {
      setLoading(false);
    }
  }, [id, session?.user?.id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onCancel() {
    if (!id) return;
    setBusy(true);
    setError(null);
    try {
      const ok = await cancelMyBooking(id);
      if (!ok) setError("This booking can no longer be cancelled.");
      setConfirmingCancel(false);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not cancel booking.");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <main className="mx-auto min-h-screen w-full max-w-3xl px-6 pt-28 sm:pt-36">
        <p className="micro-cap text-white/50">Loading</p>
      </main>
    );
  }

  if (!booking) {
    return (
      <main className="mx-auto min-h-screen w-full max-w-3xl px-6 pt-28 sm:pt-36">
        <p className="eyebrow mb-4 text-white/60">Booking</p>
        <h1 className="display-xl">Not found</h1>
        <p className="mt-6">
          <Link to="/dashboard" className="ghost-button button-cap inline-flex items-center justify-center">
            Back to dashboard
          </Link>
        </p>
      </main>
    );
  }

  const cancellable = booking.status === "pending_payment" || booking.status === "payment_submitted";
  const receiptReady = booking.status === "confirmed";

  return (
    <main className="mx-auto min-h-screen w-full max-w-3xl px-6 pb-24 pt-28 sm:px-10 sm:pt-36 lg:px-16">
      <div className="print-hide">
        <p className="eyebrow mb-4 text-white/60">Booking</p>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h1 className="display-xl">{booking.booking_code}</h1>
          <StatusChip status={booking.status} />
        </div>

        {booking.status === "rejected" && booking.rejection_reason && (
          <p className="mt-6 rounded-xs border border-white px-4 py-3 text-white">
            Payment rejected — {booking.rejection_reason}
          </p>
        )}
        {booking.status === "cancelled" && (
          <p className="caption mt-6 text-white/60">
            Cancelled by {booking.cancelled_by === "admin" ? "the turf" : "you"}. Advance payments are not refunded on
            user cancellation.
          </p>
        )}
        {booking.status === "cancelled" && booking.refund_status && (
          <p className="caption mt-2 text-white/60">Refund status: {booking.refund_status}</p>
        )}

        {cancellable && (
          <div className="mt-8">
            {confirmingCancel ? (
              <div className="flex flex-wrap items-center gap-3">
                <span className="caption text-white/70">Cancel this booking? The advance is not refunded.</span>
                <button
                  type="button"
                  onClick={() => void onCancel()}
                  disabled={busy}
                  className="ghost-button button-cap inline-flex items-center justify-center"
                >
                  {busy ? "Cancelling" : "Yes, cancel"}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmingCancel(false)}
                  className="micro-cap text-white/60 underline"
                >
                  Keep booking
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmingCancel(true)}
                className="ghost-button button-cap inline-flex items-center justify-center"
              >
                Cancel booking
              </button>
            )}
          </div>
        )}

        {error && <p className="mt-6 text-white">{error}</p>}

        {receiptReady ? (
          <div className="print-hide mt-6 flex flex-wrap gap-4">
            <button
              type="button"
              onClick={() => window.print()}
              className="ghost-button button-cap inline-flex items-center justify-center"
            >
              Print / save PDF
            </button>
          </div>
        ) : (
          <p className="caption mt-6 max-w-xl text-white/60">
            {receiptReady
              ? ""
              : "The digital receipt becomes available once the turf confirms your payment."}
          </p>
        )}
      </div>

      {receiptReady && <Receipt booking={booking} userName={profile?.name ?? "Guest"} />}

      <div className="print-hide mt-10">
        <Link to="/dashboard" className="micro-cap text-white/60 underline">
          Back to dashboard
        </Link>
      </div>
    </main>
  );
}

import { useMemo, useState } from "react";
import type { Booking, PaymentMethod, Settings, Slot, SlotLock } from "@brothers-sports-zone/shared-types";
import { bdt, formatDhakaDate } from "../../../lib/format";
import { submitBooking } from "../lib/bookingData";

interface CheckoutPanelProps {
  items: Array<{ lock: SlotLock; slot: Slot }>;
  settings: Settings;
  defaultPhone: string;
  onSubmitted: (booking: Booking) => void;
}

/** Step 2 — booking summary + coupon + manual bKash/Nagad payment submission.
 *  Rendered on a white form surface; all amounts are preview-only, the server
 *  recomputes them authoritatively inside submit_booking. */
export function CheckoutPanel({ items, settings, defaultPhone, onSubmitted }: CheckoutPanelProps) {
  const [coupon, setCoupon] = useState("");
  const [couponApplied, setCouponApplied] = useState(false);
  const [method, setMethod] = useState<PaymentMethod>("bkash");
  const [txnId, setTxnId] = useState("");
  const [senderPhone, setSenderPhone] = useState(defaultPhone);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const subtotal = items.reduce((sum, item) => sum + Number(item.slot.price), 0);

  // Preview-only; the RPC is the source of truth.
  const advancePreview = useMemo(() => {
    return Math.min(settings.advance_amount_fixed, subtotal);
  }, [subtotal, settings.advance_amount_fixed]);

  const payNumber = method === "bkash" ? settings.bkash_number : settings.nagad_number;

  async function onSubmit() {
    setError(null);
    if (!txnId.trim()) {
      setError("Enter the Transaction ID from your bKash/Nagad payment.");
      return;
    }
    if (!senderPhone.trim()) {
      setError("Enter the phone number you paid from.");
      return;
    }
    setBusy(true);
    try {
      const booking = await submitBooking({
        items: items.map(({ lock }) => ({ slot_id: lock.slot_id, date: lock.date })),
        paymentMethod: method,
        txnId: txnId.trim(),
        txnPhone: senderPhone.trim(),
        couponCode: couponApplied && coupon.trim() ? coupon.trim() : null,
      });
      onSubmitted(booking);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Payment submission failed. Please try again.");
      if (/coupon/i.test(e instanceof Error ? e.message : "")) setCouponApplied(false);
    } finally {
      setBusy(false);
    }
  }

  const payNumberMissing = !payNumber;

  return (
    <section className="rounded-md bg-canvas-light p-6 text-black sm:p-8">
      <p className="eyebrow mb-6 text-ink-mute">Step 2 · Payment</p>
      <h2 className="display-lg mb-8 text-black">Review &amp; pay</h2>

      {/* Summary */}
      <ul className="flex flex-col">
        {[...items]
          .sort((a, b) => a.lock.date.localeCompare(b.lock.date) || a.slot.slot_number - b.slot.slot_number)
          .map(({ lock, slot }) => (
            <li key={lock.id} className="flex items-center justify-between border-b border-hairline-on-light py-3">
              <span className="caption">
                {formatDhakaDate(lock.date)} · {slot.label}
              </span>
              <span className="caption font-bold">{bdt(slot.price)}</span>
            </li>
          ))}
      </ul>
      <div className="mt-4 flex items-center justify-between">
        <span className="button-cap">Total</span>
        <span className="button-cap">{bdt(subtotal)}</span>
      </div>
      <div className="mt-1 flex items-center justify-between">
        <span className="caption text-ink-mute">Pay online now (advance)</span>
        <span className="caption font-bold">{bdt(advancePreview)}</span>
      </div>
      <div className="flex items-center justify-between">
        <span className="caption text-ink-mute">Cash on arrival</span>
        <span className="caption font-bold">{bdt(subtotal - advancePreview)}</span>
      </div>

      {/* Coupon */}
      <div className="mt-8">
        <span className="button-cap mb-2 block">Coupon code</span>
        <div className="flex gap-2">
          <input
            type="text"
            value={coupon}
            onChange={(e) => {
              setCoupon(e.target.value);
              setCouponApplied(false);
            }}
            placeholder="e.g. EID10"
            className="text-input"
            aria-label="Coupon code"
          />
          <button
            type="button"
            onClick={() => setCouponApplied(coupon.trim().length > 0)}
            className="ghost-button-light button-cap shrink-0 !min-h-[48px] !py-2"
          >
            {couponApplied ? "Applied" : "Apply"}
          </button>
        </div>
        <p className="caption mt-2 text-ink-mute">
          {couponApplied
            ? "Code will be validated when you submit payment."
            : "Optional. Percentage or flat-amount discounts."}
        </p>
      </div>

      {/* Payment method */}
      <div className="mt-8">
        <span className="button-cap mb-2 block">Payment method</span>
        <div className="flex gap-2">
          {(["bkash", "nagad"] as PaymentMethod[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMethod(m)}
              aria-pressed={method === m}
              className={`min-h-[48px] flex-1 rounded-xs border px-4 button-cap ${
                method === m ? "border-black bg-black text-white" : "border-hairline-on-light text-black"
              }`}
            >
              {m === "bkash" ? "bKash" : "Nagad"}
            </button>
          ))}
        </div>
      </div>

      {/* Instructions */}
      <div className="mt-8 rounded-sm border border-hairline-on-light p-4">
        <p className="button-cap">Send {bdt(advancePreview)}</p>
        {payNumberMissing ? (
          <p className="caption mt-2 text-ink-mute">
            The turf's {method === "bkash" ? "bKash" : "Nagad"} number is not configured yet. Please contact the turf.
          </p>
        ) : (
          <p className="mt-2 text-base font-bold tracking-[.32px]">{payNumber}</p>
        )}
        <p className="caption mt-2 text-ink-mute">
          Send the advance amount to the {method === "bkash" ? "bKash" : "Nagad"} number above, then enter your
          Transaction ID below. Your slots stay held while the turf verifies the payment.
        </p>
      </div>

      {/* Transaction inputs */}
      <div className="mt-6 flex flex-col gap-5">
        <label className="block">
          <span className="button-cap mb-2 block">Transaction ID</span>
          <input
            type="text"
            value={txnId}
            onChange={(e) => setTxnId(e.target.value)}
            placeholder="e.g. 9HX7A2B3CD"
            className="text-input"
          />
        </label>
        <label className="block">
          <span className="button-cap mb-2 block">Sender phone number</span>
          <input
            type="tel"
            value={senderPhone}
            onChange={(e) => setSenderPhone(e.target.value)}
            placeholder="01XXXXXXXXX"
            className="text-input"
          />
        </label>
      </div>

      {error && <p className="caption mt-5 font-bold">{error}</p>}

      <button
        type="button"
        onClick={() => void onSubmit()}
        disabled={busy || payNumberMissing}
        className="ghost-button-light button-cap mt-8 w-full text-black disabled:opacity-50"
      >
        {busy ? "Submitting" : "Submit payment"}
      </button>
      <p className="caption mt-3 text-ink-mute">
        Your booking will be reviewed by the turf. The advance is not refunded on user cancellation.
      </p>
    </section>
  );
}

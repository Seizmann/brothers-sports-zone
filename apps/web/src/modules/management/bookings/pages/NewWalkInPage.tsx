import { useCallback, useEffect, useMemo, useState } from "react";
import type { Booking, PaymentMethod, Settings, Slot, SlotAvailability, SlotLock } from "@brothers-sports-zone/shared-types";
import { supabase } from "../../../../lib/supabase";
import { useSession } from "../../../../lib/session";
import {
  ensureWalkInUser,
  fetchActiveLocks,
  fetchAvailability,
  fetchSettings,
  fetchSlots,
  releaseLock,
  submitBooking,
  tryLock,
} from "../../../booking/lib/bookingData";
import { DateStrip } from "../../../booking/components/DateStrip";
import { SlotGrid, type SlotState } from "../../../booking/components/SlotGrid";
import { bdt, dhakaToday } from "../../../../lib/format";

export default function NewWalkInPage() {
  const { session } = useSession();
  const userId = session?.user?.id ?? null;

  const [slots, setSlots] = useState<Slot[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [availability, setAvailability] = useState<SlotAvailability[]>([]);
  const [locks, setLocks] = useState<SlotLock[]>([]);
  const [selectedDate, setSelectedDate] = useState(dhakaToday());

  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customer, setCustomer] = useState<{ id: string; name: string; phone: string } | null>(null);
  const [customerError, setCustomerError] = useState<string | null>(null);
  const [customerBusy, setCustomerBusy] = useState(false);

  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [txnId, setTxnId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmed, setConfirmed] = useState<Booking | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const reload = useCallback(async () => {
    const from = dhakaToday();
    const to = new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10);
    const [avail, activeLocks] = await Promise.all([fetchAvailability(from, to), fetchActiveLocks(from, to)]);
    setAvailability(avail);
    setLocks(activeLocks);
  }, []);

  useEffect(() => {
    if (!userId) return;
    void fetchSlots().then(setSlots).catch(() => {});
    void fetchSettings().then(setSettings).catch(() => {});
    void reload();
  }, [userId, reload]);

  const cartItems = useMemo(
    () =>
      locks
        .filter((l) => l.session_id === userId && l.booking_id === null)
        .map((lock) => ({ lock, slot: slots.find((s) => s.id === lock.slot_id)! }))
        .filter((item) => Boolean(item.slot)),
    [locks, slots, userId],
  );

  const stateOf = useCallback(
    (slotId: number): SlotState => {
      const key = (s: SlotAvailability) => s.date === selectedDate && s.slot_id === slotId;
      if (availability.some((s) => key(s) && s.state === "booked")) return "booked";
      if (availability.some((s) => key(s) && s.state === "blackout")) return "blackout";
      const active = locks.find(
        (l) => l.date === selectedDate && l.slot_id === slotId && l.expires_at > new Date(now).toISOString(),
      );
      if (active) return active.session_id === userId ? "mine" : "locked";
      return "available";
    },
    [availability, locks, selectedDate, userId, now],
  );

  const myLockFor = useCallback(
    (slotId: number) => locks.find((l) => l.date === selectedDate && l.slot_id === slotId && l.session_id === userId),
    [locks, selectedDate, userId],
  );

  async function findOrCreateCustomer() {
    setCustomerError(null);
    setCustomerBusy(true);
    try {
      const user = await ensureWalkInUser(customerName, customerPhone);
      setCustomer(user);
      setCustomerName(user.name);
    } catch (e) {
      setCustomerError(e instanceof Error ? e.message : "Could not find or create the user.");
    } finally {
      setCustomerBusy(false);
    }
  }

  async function onSubmit() {
    if (!customer || cartItems.length === 0) return;
    setError(null);
    if (method !== "cash" && !txnId.trim()) {
      setError("Enter the Transaction ID, or choose cash.");
      return;
    }
    setBusy(true);
    try {
      const booking = await submitBooking({
        items: cartItems.map(({ lock }) => ({ slot_id: lock.slot_id, date: lock.date })),
        paymentMethod: method,
        txnId: method === "cash" ? null : txnId.trim(),
        txnPhone: method === "cash" ? null : customer.phone,
        couponCode: null,
        confirm: method === "cash",
        forUserPhone: customer.phone,
      });
      setConfirmed(booking);
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create the booking.");
      await reload();
    } finally {
      setBusy(false);
    }
  }

  if (confirmed) {
    return (
      <div>
        <p className="eyebrow mb-4 text-white/60">Management</p>
        <h1 className="display-xl">Walk-in booked</h1>
        <p className="button-cap mt-10 text-white/60">Booking ID</p>
        <p className="display-lg mt-2">{confirmed.booking_code}</p>
        <p className="caption mt-4 text-white/60">
          Status: {confirmed.status.replace("_", " ")} · {bdt(confirmed.total_amount)} (advance{" "}
          {bdt(confirmed.advance_amount)}, cash due {bdt(confirmed.cash_due)})
        </p>
        <button
          type="button"
          onClick={() => {
            setConfirmed(null);
            setCustomer(null);
            setCustomerName("");
            setCustomerPhone("");
            setTxnId("");
          }}
          className="ghost-button button-cap mt-10 inline-flex items-center justify-center"
        >
          New walk-in booking
        </button>
      </div>
    );
  }

  return (
    <div>
      <p className="eyebrow mb-4 text-white/60">Management</p>
      <h1 className="display-xl">New walk-in booking</h1>

      {/* Step 1: customer */}
      <section className="mt-10 max-w-xl rounded-sm border border-hairline-on-dark p-5">
        <h2 className="button-cap text-white/60">1 · Customer</h2>
        {customer ? (
          <p className="mt-4">
            <span className="button-cap">{customer.name}</span>
            <span className="caption block text-white/50">{customer.phone}</span>
          </p>
        ) : (
          <div className="mt-4 flex flex-wrap items-end gap-3">
            <label className="block">
              <span className="micro-cap block text-white/50">Name</span>
              <input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Customer name"
                className="text-input !min-h-[40px] !py-1"
              />
            </label>
            <label className="block">
              <span className="micro-cap block text-white/50">Phone</span>
              <input
                type="tel"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                placeholder="01XXXXXXXXX"
                className="text-input !min-h-[40px] !py-1"
              />
            </label>
            <button
              type="button"
              onClick={() => void findOrCreateCustomer()}
              disabled={customerBusy || customerPhone.trim().length === 0}
              className="ghost-button button-cap !min-h-[40px] !py-2 disabled:opacity-40"
            >
              {customerBusy ? "Looking up" : "Find / create"}
            </button>
          </div>
        )}
        {customerError && <p className="caption mt-3 text-white">{customerError}</p>}
        <p className="caption mt-3 text-white/40">
          Existing users are found by phone; new numbers get a minimal walk-in account.
        </p>
      </section>

      {/* Step 2: slots */}
      <section className="mt-10">
        <h2 className="button-cap text-white/60">2 · Slots</h2>
        <div className="mt-5">
          <DateStrip selected={selectedDate} onSelect={setSelectedDate} />
        </div>
        <div className="mt-8">
          <SlotGrid
            slots={slots}
            date={selectedDate}
            stateOf={stateOf}
            myLockFor={myLockFor}
            now={now}
            busySlotId={null}
            onSelect={(slot) => {
              setError(null);
              tryLock(slot.id, selectedDate, userId!, settings?.lock_minutes ?? 5)
                .then(reload)
                .catch((e) => {
                  setError(e instanceof Error ? e.message : "Could not hold this slot.");
                  void reload();
                });
            }}
            onRelease={(lock) => void releaseLock(lock.id).then(reload)}
          />
        </div>
      </section>

      {/* Step 3: payment */}
      {customer && cartItems.length > 0 && (
        <section className="mt-10 max-w-xl rounded-sm border border-hairline-on-dark p-5">
          <h2 className="button-cap text-white/60">3 · Payment</h2>
          <p className="caption mt-4 text-white/60">
            {cartItems.length} slot(s) held ·{" "}
            {bdt(cartItems.reduce((sum, item) => sum + Number(item.slot.price), 0))} total
          </p>
          <div className="mt-4 flex gap-2">
            {(["cash", "bkash", "nagad"] as PaymentMethod[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMethod(m)}
                aria-pressed={method === m}
                className={`min-h-[44px] flex-1 rounded-xs border px-4 button-cap ${
                  method === m ? "border-white bg-white text-black" : "border-hairline-on-dark text-white"
                }`}
              >
                {m === "cash" ? "Cash on spot" : m === "bkash" ? "bKash advance" : "Nagad advance"}
              </button>
            ))}
          </div>
          {method !== "cash" && (
            <label className="mt-4 block">
              <span className="micro-cap block text-white/50">Transaction ID (verified in queue)</span>
              <input
                type="text"
                value={txnId}
                onChange={(e) => setTxnId(e.target.value)}
                placeholder="e.g. 9HX7A2B3CD"
                className="text-input !py-1"
              />
            </label>
          )}
          <p className="caption mt-3 text-white/50">
            {method === "cash"
              ? "The booking is confirmed immediately; the full amount is collected on the spot."
              : "The booking lands in the payment queue for verification."}
          </p>
          {error && <p className="caption mt-3 text-white">{error}</p>}
          <button
            type="button"
            onClick={() => void onSubmit()}
            disabled={busy}
            className="ghost-button button-cap mt-5 inline-flex items-center justify-center disabled:opacity-40"
          >
            {busy ? "Booking" : method === "cash" ? "Book & confirm" : "Book (queue for verification)"}
          </button>
        </section>
      )}
    </div>
  );
}

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSession } from "../../../lib/session";
import {
  extendLocks,
  fetchActiveLocks,
  fetchAvailability,
  fetchSettings,
  fetchSlots,
  releaseLock,
  subscribeToSlotChanges,
  tryLock,
} from "../lib/bookingData";
import type { Settings, Slot, SlotAvailability, SlotLock } from "@brothers-sports-zone/shared-types";
import { dhakaDateShifted, dhakaToday } from "../../../lib/format";
import { DateStrip } from "../components/DateStrip";
import { SlotGrid, type SlotState } from "../components/SlotGrid";
import { CartPanel } from "../components/CartPanel";

const RANGE_DAYS = 30;

export default function BookingPage() {
  const { session } = useSession();
  const userId = session?.user?.id ?? null;

  const [slots, setSlots] = useState<Slot[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [availability, setAvailability] = useState<SlotAvailability[]>([]);
  const [locks, setLocks] = useState<SlotLock[]>([]);
  const [selectedDate, setSelectedDate] = useState(dhakaToday());
  const [error, setError] = useState<string | null>(null);
  const [busySlotId, setBusySlotId] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const loadRef = useRef<() => void>(() => {});

  const reload = useCallback(async () => {
    if (!userId) return;
    const from = dhakaToday();
    const to = dhakaDateShifted(RANGE_DAYS);
    try {
      const [avail, activeLocks] = await Promise.all([fetchAvailability(from, to), fetchActiveLocks(from, to)]);
      setAvailability(avail);
      setLocks(activeLocks);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load availability.");
    }
  }, [userId]);

  // Initial load: slots + settings + availability/locks, then realtime updates.
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    (async () => {
      try {
        const [slotRows, settingsRow] = await Promise.all([fetchSlots(), fetchSettings()]);
        if (cancelled) return;
        setSlots(slotRows);
        setSettings(settingsRow);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Could not load booking data.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    void reload();
    const unsubscribe = subscribeToSlotChanges(() => void reload());
    return unsubscribe;
  }, [userId, reload]);

  // 1-second tick drives countdowns; expired own locks disappear on next reload.
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Keep own locks alive while the user is actively booking: re-extend every
  // 2 minutes so an in-progress selection never expires mid-flow.
  useEffect(() => {
    if (!userId || !settings) return;
    const extend = () => {
      const mine = locks.filter((l) => l.session_id === userId && l.booking_id === null);
      if (mine.length === 0) return;
      const newExpiry = new Date(Date.now() + settings.lock_minutes * 60_000).toISOString();
      void extendLocks(
        mine.map((l) => l.id),
        newExpiry,
      ).then(reload);
    };
    const timer = setInterval(extend, 120_000);
    return () => clearInterval(timer);
  }, [userId, settings, locks, reload]);

  const stateOf = useCallback(
    (slotId: number): SlotState => {
      const date = selectedDate;
      const key = (s: SlotAvailability) => s.date === date && s.slot_id === slotId;
      if (availability.some((s) => key(s) && s.state === "booked")) return "booked";
      if (availability.some((s) => key(s) && s.state === "blackout")) return "blackout";
      const active = locks.find((l) => l.date === date && l.slot_id === slotId && l.expires_at > new Date(now).toISOString());
      if (active) return active.session_id === userId ? "mine" : "locked";
      return "available";
    },
    [availability, locks, selectedDate, userId, now],
  );

  const myLockFor = useCallback(
    (slotId: number) => locks.find((l) => l.date === selectedDate && l.slot_id === slotId && l.session_id === userId),
    [locks, selectedDate, userId],
  );

  const cartItems = useMemo(
    () =>
      locks
        .filter((l) => l.session_id === userId && l.booking_id === null)
        .map((lock) => ({ lock, slot: slots.find((s) => s.id === lock.slot_id)! }))
        .filter((item) => Boolean(item.slot)),
    [locks, slots, userId],
  );
  const cartTotal = cartItems.reduce((sum, item) => sum + Number(item.slot.price), 0);

  const closedDates = useMemo(() => {
    const dates = new Set<string>();
    const perDate = new Map<string, number>();
    for (const a of availability) {
      if (a.state !== "blackout") continue;
      dates.add(a.date);
      perDate.set(a.date, (perDate.get(a.date) ?? 0) + 1);
    }
    // A date is fully closed when every slot is blacked out.
    for (const date of dates) {
      if (slots.length > 0 && (perDate.get(date) ?? 0) < slots.length) dates.delete(date);
    }
    return dates;
  }, [availability, slots]);

  async function onSelectSlot(slot: Slot) {
    if (!userId || !settings) return;
    setBusySlotId(slot.id);
    setError(null);
    try {
      await tryLock(slot.id, selectedDate, userId, settings.lock_minutes);
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not hold this slot.");
      await reload();
    } finally {
      setBusySlotId(null);
    }
  }

  async function onRelease(lock: SlotLock) {
    setError(null);
    try {
      await releaseLock(lock.id);
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not release this slot.");
    }
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-6xl px-6 pb-24 pt-28 sm:px-10 sm:pt-36 lg:px-16">
      <p className="eyebrow mb-4 text-white/60">Booking</p>
      <h1 className="display-xl">Choose your slots</h1>
      <p className="caption mt-4 max-w-xl text-white/60">
        Selecting a slot holds it for {settings?.lock_minutes ?? 5} minutes. Hold as many slots and days as you like,
        then continue to payment.
      </p>

      <div className="mt-10">
        <DateStrip selected={selectedDate} onSelect={setSelectedDate} closedDates={closedDates} />
      </div>

      {error && (
        <p role="alert" className="mt-6 rounded-xs border border-white px-4 py-3 text-white">
          {error}
        </p>
      )}

      <div className="mt-10 grid grid-cols-1 gap-10 lg:grid-cols-[1fr_320px]">
        <SlotGrid
          slots={slots}
          date={selectedDate}
          stateOf={stateOf}
          myLockFor={myLockFor}
          now={now}
          busySlotId={busySlotId}
          onSelect={(slot) => void onSelectSlot(slot)}
          onRelease={(lock) => void onRelease(lock)}
        />
        <aside className="lg:sticky lg:top-28 lg:self-start">
          <h2 className="button-cap mb-4 text-white/60">Your selection</h2>
          <CartPanel items={cartItems} total={cartTotal} now={now} onRemove={(lock) => void onRelease(lock)} />
        </aside>
      </div>
    </main>
  );
}

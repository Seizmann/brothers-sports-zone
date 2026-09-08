/** Data access for the booking flow: slots, availability, locks, settings. */

import { supabase } from "../../../lib/supabase";
import { dhakaDateShifted, dhakaToday, shiftDate } from "../../../lib/format";
import type { Booking, PaymentMethod, Settings, Slot, SlotAvailability, SlotLock, SubmitBookingItem } from "@brothers-sports-zone/shared-types";

/** The availability/lock fetch window: the base strip range, widened when the
 *  user explores a further date (the picker has no booking-window limit per
 *  requirements; get_slot_availability is sparse, so wide windows stay cheap). */
const BASE_RANGE_DAYS = 30;
const LOOKAHEAD_DAYS = 14;

/** Date range to fetch for a selected date: [today, max(base range, date+lookahead)]. */
export function bookingFetchWindow(selectedDate: string): { from: string; to: string } {
  const from = dhakaToday();
  const baseEnd = dhakaDateShifted(BASE_RANGE_DAYS);
  const to = selectedDate > baseEnd ? shiftDate(selectedDate, LOOKAHEAD_DAYS) : baseEnd;
  return { from, to };
}

export async function fetchSlots(): Promise<Slot[]> {
  const { data, error } = await supabase.from("slots").select("*").order("slot_number");
  if (error) throw new Error(error.message);
  return data as Slot[];
}

export async function fetchAvailability(from: string, to: string): Promise<SlotAvailability[]> {
  const { data, error } = await supabase.rpc("get_slot_availability", { from_date: from, to_date: to });
  if (error) throw new Error(error.message);
  return (data ?? []) as SlotAvailability[];
}

/** Every active, unattached lock — mine and everyone else's (RLS lets any
 *  authenticated client see non-expired locks so the grid reflects holds).
 *  Unbounded by date: active locks are few (short TTL + cleanup sweep), and
 *  the cart must include holds on dates outside the availability window. */
export async function fetchActiveLocks(): Promise<SlotLock[]> {
  const { data, error } = await supabase
    .from("slot_locks")
    .select("*")
    .is("booking_id", null)
    .gt("expires_at", new Date().toISOString());
  if (error) throw new Error(error.message);
  return (data ?? []) as SlotLock[];
}

export async function fetchSettings(): Promise<Settings> {
  const { data, error } = await supabase.from("settings").select("*").eq("id", 1).single();
  if (error) throw new Error(error.message);
  return data as Settings;
}

export async function tryLock(slotId: number, date: string, sessionId: string, minutes: number): Promise<SlotLock> {
  const { data, error } = await supabase.rpc("try_lock_slot", {
    requested_slot_id: slotId,
    requested_date: date,
    requested_session_id: sessionId,
    requested_minutes: minutes,
  });
  if (error) throw new Error(error.message);
  return data as SlotLock;
}

export async function releaseLock(lockId: string): Promise<void> {
  const { error } = await supabase.from("slot_locks").delete().eq("id", lockId);
  if (error) throw new Error(error.message);
}

/** Extends the caller's own locks (RLS allows updating own rows). */
export async function extendLocks(lockIds: string[], expiresAt: string): Promise<void> {
  if (lockIds.length === 0) return;
  const { error } = await supabase.from("slot_locks").update({ expires_at: expiresAt }).in("id", lockIds);
  if (error) throw new Error(error.message);
}

/** Live updates for locks and bookings so every client sees availability move. */
export function subscribeToSlotChanges(onChange: () => void): () => void {
  const channel = supabase
    .channel("slot-availability")
    .on("postgres_changes", { event: "*", schema: "public", table: "slot_locks" }, onChange)
    .on("postgres_changes", { event: "*", schema: "public", table: "bookings" }, onChange)
    .subscribe();
  return () => {
    void supabase.removeChannel(channel);
  };
}

/** Atomic booking submission. Server recomputes all amounts and validates
 *  every slot, the coupon, and the caller's locks before inserting.
 *  Admin walk-ins pass `confirm` (+ `forUserPhone`) to land as confirmed. */
export async function submitBooking(params: {
  items: SubmitBookingItem[];
  paymentMethod: PaymentMethod;
  txnId: string | null;
  txnPhone: string | null;
  couponCode: string | null;
  confirm?: boolean;
  forUserPhone?: string | null;
}): Promise<Booking> {
  const { data, error } = await supabase.rpc("submit_booking", {
    p_items: params.items,
    p_payment_method: params.paymentMethod,
    p_txn_id: params.txnId,
    p_txn_phone: params.txnPhone,
    p_coupon_code: params.couponCode,
    p_confirm: params.confirm ?? false,
    p_for_user_phone: params.forUserPhone ?? null,
  });
  if (error) throw new Error(error.message);
  return data as Booking;
}

/** Admin: find a user by phone or create a minimal walk-in account. */
export async function ensureWalkInUser(name: string, phone: string): Promise<{ id: string; name: string; phone: string }> {
  const { data, error } = await supabase.rpc("admin_ensure_user", { p_name: name, p_phone: phone });
  if (error) throw new Error(error.message);
  return data as { id: string; name: string; phone: string };
}

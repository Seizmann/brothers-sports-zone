import { supabase } from "../../../lib/supabase";
import type { Booking } from "@brothers-sports-zone/shared-types";

export interface BookingItemWithSlot {
  slot_id: number;
  date: string;
  price: number;
  slots: { label: string; period: string } | null;
}

export interface BookingWithItems extends Booking {
  booking_items: BookingItemWithSlot[];
}

export async function fetchMyBookings(userId: string): Promise<BookingWithItems[]> {
  const { data, error } = await supabase
    .from("bookings")
    .select("*, booking_items(*, slots(label, period))")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as BookingWithItems[];
}

export async function fetchBookingForUser(bookingId: string, userId: string): Promise<BookingWithItems | null> {
  const { data, error } = await supabase
    .from("bookings")
    .select("*, booking_items(*, slots(label, period))")
    .eq("id", bookingId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as BookingWithItems | null) ?? null;
}

/** User cancellation — only while pending/submitted (RLS enforces this too). */
export async function cancelMyBooking(bookingId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("bookings")
    .update({ status: "cancelled", cancelled_by: "user" })
    .eq("id", bookingId)
    .in("status", ["pending_payment", "payment_submitted"])
    .select("id");
  if (error) throw new Error(error.message);
  return (data ?? []).length === 1;
}

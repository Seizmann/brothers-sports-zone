import { supabase } from "../../../../lib/supabase";
import type { Booking, BookingStatus } from "@brothers-sports-zone/shared-types";

export interface AdminBookingRow extends Booking {
  users: { name: string; phone: string } | null;
  booking_items: Array<{ id: string; date: string; price: number; slot_id: number; slots: { label: string } | null }>;
}

export async function fetchAllBookings(): Promise<AdminBookingRow[]> {
  const { data, error } = await supabase
    .from("bookings")
    .select("*, users(name, phone), booking_items(*, slots(label))")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as AdminBookingRow[];
}

export async function confirmBooking(bookingId: string): Promise<void> {
  const { error } = await supabase.from("bookings").update({ status: "confirmed" }).eq("id", bookingId);
  if (error) throw new Error(error.message);
}

export async function rejectBooking(bookingId: string, reason: string): Promise<void> {
  const { error } = await supabase
    .from("bookings")
    .update({ status: "rejected", rejection_reason: reason })
    .eq("id", bookingId);
  if (error) throw new Error(error.message);
}

export async function adminCancelBooking(bookingId: string, wasConfirmed: boolean): Promise<void> {
  const { error } = await supabase
    .from("bookings")
    .update({
      status: "cancelled",
      cancelled_by: "admin",
      refund_status: wasConfirmed ? "pending" : null,
    })
    .eq("id", bookingId);
  if (error) throw new Error(error.message);
}

export async function markRefunded(bookingId: string): Promise<void> {
  const { error } = await supabase.from("bookings").update({ refund_status: "refunded" }).eq("id", bookingId);
  if (error) throw new Error(error.message);
}

export function statusLabel(status: BookingStatus): string {
  return status.replace(/_/g, " ");
}

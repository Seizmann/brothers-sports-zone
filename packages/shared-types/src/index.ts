export type BookingStatus =
  | "pending_payment"
  | "payment_submitted"
  | "confirmed"
  | "cancelled"
  | "rejected";

export type PaymentMethod = "bkash" | "nagad" | "cash";

export type CouponType = "percentage" | "flat";

export type RefundStatus = "pending" | "refunded";

export type Period = "Morning" | "Afternoon" | "Evening" | "Night";

export interface Slot {
  id: number;
  slot_number: number;
  label: string;
  period: Period;
  start_time: string;
  end_time: string;
  price: number;
}

export interface UserProfile {
  id: string;
  name: string;
  phone: string;
  created_at: string;
}

export interface AdminUser {
  id: string;
  email: string;
  role: "super_admin";
  created_at: string;
  is_active: boolean;
}

export interface Coupon {
  id: string;
  code: string;
  type: CouponType;
  value: number;
  valid_from: string | null;
  valid_until: string | null;
  usage_limit: number | null;
  usage_count: number;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
}

export interface Blackout {
  id: string;
  date: string;
  slot_id: number | null;
  reason: string | null;
  created_by: string | null;
  created_at: string;
}

export interface Booking {
  id: string;
  booking_code: string;
  user_id: string;
  status: BookingStatus;
  created_by_admin: string | null;
  coupon_id: string | null;
  discount_amount: number;
  total_amount: number;
  advance_amount: number;
  cash_due: number;
  payment_method: PaymentMethod | null;
  txn_id: string | null;
  txn_phone: string | null;
  rejection_reason: string | null;
  refund_status: RefundStatus | null;
  cancelled_by: "user" | "admin" | null;
  created_at: string;
  updated_at: string;
}

export interface BookingItem {
  id: string;
  booking_id: string;
  slot_id: number;
  date: string;
  price: number;
}

export interface SlotLock {
  id: string;
  slot_id: number;
  date: string;
  session_id: string;
  locked_at: string;
  expires_at: string;
  booking_id: string | null;
}

export interface Settings {
  id: 1;
  bkash_number: string | null;
  nagad_number: string | null;
  advance_pct: number;
  lock_minutes: number;
}

/** Item passed to the submit_booking RPC. */
export interface SubmitBookingItem {
  slot_id: number;
  date: string;
}

/** Row returned by the get_slot_availability RPC. */
export interface SlotAvailability {
  date: string;
  slot_id: number;
  state: "booked" | "blackout";
}

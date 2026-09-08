export type BookingStatus =
  | "pending_payment"
  | "payment_submitted"
  | "confirmed"
  | "cancelled"
  | "rejected";

export type PaymentMethod = "bkash" | "nagad" | "cash";

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

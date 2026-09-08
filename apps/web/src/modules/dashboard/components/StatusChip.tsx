import type { BookingStatus } from "@brothers-sports-zone/shared-types";

const LABELS: Record<BookingStatus, string> = {
  pending_payment: "Pending payment",
  payment_submitted: "Payment submitted",
  confirmed: "Confirmed",
  cancelled: "Cancelled",
  rejected: "Rejected",
};

export function StatusChip({ status }: { status: BookingStatus }) {
  return (
    <span className="button-cap inline-block rounded-full border border-current px-3 py-1 leading-[1.4]">
      {LABELS[status]}
    </span>
  );
}

export { LABELS as STATUS_LABELS };

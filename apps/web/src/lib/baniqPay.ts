/** Client helpers for the Baniq Pay gateway flow. The secrets live in the
 *  Edge Functions; these wrappers only carry booking ids over functions.invoke. */

import { supabase } from "./supabase";
import type { PaymentMethod } from "@brothers-sports-zone/shared-types";

/** Creates (or reuses, while still open) the Baniq hosted-checkout order for a
 *  pending gateway booking. The caller redirects the browser to checkoutUrl. */
export async function createBaniqOrder(
  bookingId: string,
  provider: PaymentMethod,
): Promise<{ checkoutUrl: string; orderId: string }> {
  const { data, error } = await supabase.functions.invoke("baniq-create-order", {
    body: { booking_id: bookingId, provider: provider === "nagad" ? "nagad" : "bkash" },
  });
  if (error) throw new Error(error.message);
  return data as { checkoutUrl: string; orderId: string };
}

/** Server-side re-verification of the Baniq order (the buyer-return path;
 *  the signed webhook is the independent one). Returns whether the order is
 *  paid and what the confirm RPC decided. */
export async function verifyBaniqPayment(
  bookingId: string,
): Promise<{ paid: boolean; result?: string; orderStatus?: string | null }> {
  const { data, error } = await supabase.functions.invoke("baniq-verify", {
    body: { booking_id: bookingId },
  });
  if (error) throw new Error(error.message);
  return data as { paid: boolean; result?: string; orderStatus?: string | null };
}

/** Human label for a payment_method enum value ("Baniq pay" for the gateway). */
export function paymentMethodLabel(method: PaymentMethod | null): string {
  switch (method) {
    case "bkash":
      return "bKash";
    case "nagad":
      return "Nagad";
    case "cash":
      return "Cash";
    case "baniq_pay":
      return "Baniq Pay";
    default:
      return "—";
  }
}
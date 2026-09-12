/* Baniq Pay — payment webhook (order.paid). Deployed with verify_jwt disabled
 * (Baniq cannot present a Supabase JWT); the request is authenticated with the
 * HMAC-SHA256 signature over the exact raw body (x-deshpay-signature). On a
 * valid signature the booking is confirmed via confirm_baniq_payment — always
 * respond 200 after signature validation so Baniq's retry/backoff does not
 * re-deliver permanent conditions (unknown/cancelled bookings are logged and
 * acknowledged as ignored). */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL");
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const webhookSecret = Deno.env.get("BANIQ_WEBHOOK_SECRET");

if (!supabaseUrl || !serviceRoleKey || !webhookSecret) {
  throw new Error("Missing Baniq webhook environment variables.");
}

function timingSafeHexEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function hmacSha256Hex(secret: string, body: Uint8Array): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign("HMAC", key, body as BufferSource);
  return Array.from(new Uint8Array(mac)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return Response.json({ error: "POST only" }, { status: 405 });
  }

  const raw = new Uint8Array(await req.arrayBuffer());
  const signatureHeader = req.headers.get("x-deshpay-signature") ?? "";
  const expected = "sha256=" + (await hmacSha256Hex(webhookSecret, raw));

  if (!timingSafeHexEqual(signatureHeader, expected)) {
    return Response.json({ error: "Bad signature" }, { status: 401 });
  }

  let payload: { event?: string; order?: { id?: string; amount?: number; buyerSenderNumber?: string | null; paidAt?: string | null; status?: string } };
  try {
    payload = JSON.parse(new TextDecoder().decode(raw));
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (payload.event !== "order.paid" || !payload.order?.id) {
    return Response.json({ ignored: true, event: payload.event ?? null });
  }

  const { data: result, error } = await supabase.rpc("confirm_baniq_payment", {
    p_order_id: payload.order.id,
    p_amount_paisa: payload.order.amount ?? null,
    p_sender_number: payload.order.buyerSenderNumber ?? null,
    p_paid_at: payload.order.paidAt ?? null,
  });
  if (error) {
    console.error("baniq-webhook: confirm RPC failed", error.message);
    return Response.json({ error: "Confirm failed" }, { status: 500 });
  }

  // confirmed / already_confirmed mean the booking is paid. Any other result is
  // a permanent condition — acknowledge with 200 so Baniq stops retrying.
  console.log("baniq-webhook: order", payload.order.id, "result:", result);
  return Response.json({ result });
});
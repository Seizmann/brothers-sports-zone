/* Baniq Pay — server-side verification (authoritative path used when the buyer
 * returns from the hosted checkout). Auth: user JWT (platform verifies it).
 * Body: { booking_id: uuid }
 * Calls GET /api/v1/orders/:orderId on api.baniq.app; when the order is paid
 * for the exact expected amount, transitions the booking via the
 * confirm_baniq_payment RPC (the same RPC the webhook uses — idempotent). */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL");
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const apiKeyId = Deno.env.get("BANIQ_API_KEY_ID");
const apiSecret = Deno.env.get("BANIQ_API_SECRET");

if (!supabaseUrl || !serviceRoleKey || !apiKeyId || !apiSecret) {
  throw new Error("Missing Baniq/Supabase function environment variables.");
}

const BANIQ_API = "https://api.baniq.app";
const ALLOWED_ORIGINS = ["https://brotherssportszone.com", "https://www.brotherssportszone.com", "http://localhost:5173"];

const corsHeaders = (origin: string | null) => ({
  "Access-Control-Allow-Origin": ALLOWED_ORIGINS.includes(origin ?? "") ? origin! : ALLOWED_ORIGINS[0],
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
});

function userIdFromAuthHeader(req: Request): string | null {
  const header = req.headers.get("Authorization") ?? "";
  const token = header.replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  try {
    const payload = JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")));
    return typeof payload.sub === "string" ? payload.sub : null;
  } catch {
    return null;
  }
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

Deno.serve(async (req) => {
  const origin = req.headers.get("Origin");
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders(origin) });
  }
  if (req.method !== "POST") {
    return Response.json({ error: "POST only" }, { status: 405, headers: corsHeaders(origin) });
  }

  const callerId = userIdFromAuthHeader(req);
  if (!callerId) {
    return Response.json({ error: "Sign in required" }, { status: 401, headers: corsHeaders(origin) });
  }

  let body: { booking_id?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400, headers: corsHeaders(origin) });
  }
  const bookingId = typeof body.booking_id === "string" ? body.booking_id : "";
  if (!bookingId) {
    return Response.json({ error: "booking_id is required" }, { status: 400, headers: corsHeaders(origin) });
  }

  const { data: booking, error } = await supabase
    .from("bookings")
    .select("id, user_id, baniq_order_id, advance_amount")
    .eq("id", bookingId)
    .maybeSingle();
  if (error) {
    return Response.json({ error: error.message }, { status: 500, headers: corsHeaders(origin) });
  }
  if (!booking || booking.user_id !== callerId) {
    return Response.json({ error: "Booking not found" }, { status: 404, headers: corsHeaders(origin) });
  }
  if (!booking.baniq_order_id) {
    return Response.json({ error: "No payment order exists for this booking" }, { status: 409, headers: corsHeaders(origin) });
  }

  const verifyRes = await fetch(`${BANIQ_API}/api/v1/orders/${encodeURIComponent(booking.baniq_order_id)}`, {
    headers: { "x-api-key-id": apiKeyId, "x-api-secret": apiSecret },
  });
  if (!verifyRes.ok) {
    const message = await verifyRes.text().catch(() => "Baniq verify failed");
    console.error("baniq-verify: Baniq API error", verifyRes.status, message);
    return Response.json({ error: "Could not verify the payment right now" }, { status: 502, headers: corsHeaders(origin) });
  }

  const order = await verifyRes.json();
  const expectedPaisa = Math.round(Number(booking.advance_amount) * 100);

  if (order.paid !== true || Number(order.amount) !== expectedPaisa) {
    return Response.json(
      { paid: false, orderStatus: order.status ?? null },
      { headers: corsHeaders(origin) },
    );
  }

  const { data: result, error: rpcError } = await supabase.rpc("confirm_baniq_payment", {
    p_order_id: order.orderId,
    p_amount_paisa: order.amount,
    p_sender_number: order.buyerSenderNumber ?? null,
    p_paid_at: order.paidAt ?? null,
  });
  if (rpcError) {
    console.error("baniq-verify: confirm RPC failed", rpcError.message);
    return Response.json({ error: "Could not confirm the payment" }, { status: 500, headers: corsHeaders(origin) });
  }

  return Response.json(
    { paid: true, orderStatus: order.status ?? null, result },
    { headers: corsHeaders(origin) },
  );
});
/* Baniq Pay — create a hosted-checkout order for a pending gateway booking.
 * Auth: user JWT (platform verifies it; we read `sub` from the claims).
 * Body: { booking_id: uuid, provider?: 'bkash' | 'nagad' }
 * Calls POST /api/v1/orders on api.baniq.app, stores the order on the booking,
 * and returns the checkoutUrl the client must redirect to. Idempotent while
 * the previous order is still open. */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL");
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const apiKeyId = Deno.env.get("BANIQ_API_KEY_ID");
const apiSecret = Deno.env.get("BANIQ_API_SECRET");
const appBaseUrl = Deno.env.get("APP_BASE_URL") ?? "https://brotherssportszone.com";

if (!supabaseUrl || !serviceRoleKey || !apiKeyId || !apiSecret) {
  throw new Error("Missing Baniq/Supabase function environment variables.");
}

const BANIQ_API = "https://api.baniq.app";
const ALLOWED_ORIGINS = ["https://brotherssportszone.com", "https://www.brotherssportszone.com", "http://localhost:5173"];
const MAX_PAISA = 100_000_000; // Baniq caps a single order at BDT 1,000,000

const corsHeaders = (origin: string | null) => ({
  "Access-Control-Allow-Origin": ALLOWED_ORIGINS.includes(origin ?? "") ? origin! : ALLOWED_ORIGINS[0],
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
});

function unauthorized(message: string, origin: string | null) {
  return Response.json({ error: message }, { status: 401, headers: corsHeaders(origin) });
}

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

  const userId = userIdFromAuthHeader(req);
  if (!userId) return unauthorized("Sign in required", origin);

  let body: { booking_id?: string; provider?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400, headers: corsHeaders(origin) });
  }
  const bookingId = typeof body.booking_id === "string" ? body.booking_id : "";
  const provider = body.provider === "bkash" || body.provider === "nagad" ? body.provider : undefined;
  if (!bookingId) {
    return Response.json({ error: "booking_id is required" }, { status: 400, headers: corsHeaders(origin) });
  }

  const { data: booking, error } = await supabase
    .from("bookings")
    .select("id, booking_code, user_id, status, payment_method, advance_amount, baniq_order_id, baniq_checkout_url, baniq_order_expires_at")
    .eq("id", bookingId)
    .maybeSingle();
  if (error) {
    return Response.json({ error: error.message }, { status: 500, headers: corsHeaders(origin) });
  }
  if (!booking || booking.user_id !== userId) {
    return Response.json({ error: "Booking not found" }, { status: 404, headers: corsHeaders(origin) });
  }
  if (booking.status !== "pending_payment" || booking.payment_method !== "baniq_pay") {
    return Response.json(
      { error: "This booking is not awaiting a Baniq Pay payment" },
      { status: 409, headers: corsHeaders(origin) },
    );
  }

  // Reuse the live order if the user retries while their previous checkout is
  // still open — Baniq checkout URLs are single-order links.
  if (booking.baniq_order_id && booking.baniq_checkout_url && booking.baniq_order_expires_at) {
    if (new Date(booking.baniq_order_expires_at).getTime() > Date.now()) {
      return Response.json(
        { checkoutUrl: booking.baniq_checkout_url, orderId: booking.baniq_order_id, expiresAt: booking.baniq_order_expires_at, reused: true },
        { headers: corsHeaders(origin) },
      );
    }
  }

  const amountPaisa = Math.round(Number(booking.advance_amount) * 100);
  if (!Number.isFinite(amountPaisa) || amountPaisa < 1 || amountPaisa > MAX_PAISA) {
    return Response.json({ error: "Advance amount is out of range" }, { status: 400, headers: corsHeaders(origin) });
  }

  const bookingPath = `${appBaseUrl}/dashboard/booking/${booking.id}`;
  const createRes = await fetch(`${BANIQ_API}/api/v1/orders`, {
    method: "POST",
    headers: {
      "x-api-key-id": apiKeyId,
      "x-api-secret": apiSecret,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      amount: amountPaisa,
      productName: `Brothers Sports Zone — advance for ${booking.booking_code}`,
      ...(provider ? { provider } : {}),
      reference: booking.id,
      successUrl: `${bookingPath}?baniq=return`,
      cancelUrl: `${bookingPath}?baniq=cancel`,
      metadata: { booking_id: booking.id, booking_code: booking.booking_code },
    }),
  });

  if (!createRes.ok) {
    const message = await createRes.text().catch(() => "Baniq order creation failed");
    console.error("baniq-create-order: Baniq API error", createRes.status, message);
    return Response.json(
      { error: `Payment gateway rejected the order: ${message.slice(0, 300)}` },
      { status: 502, headers: corsHeaders(origin) },
    );
  }

  const order = await createRes.json();
  const patch = await supabase
    .from("bookings")
    .update({
      baniq_order_id: order.orderId,
      baniq_checkout_url: order.checkoutUrl,
      baniq_order_expires_at: order.expiresAt ?? null,
    })
    .eq("id", booking.id)
    .select("baniq_order_id");
  if (patch.error || !(patch.data ?? []).length) {
    console.error("baniq-create-order: failed to store order on booking", patch.error?.message);
    return Response.json({ error: "Could not record the payment order" }, { status: 500, headers: corsHeaders(origin) });
  }

  return Response.json(
    { checkoutUrl: order.checkoutUrl, orderId: order.orderId, expiresAt: order.expiresAt ?? null },
    { headers: corsHeaders(origin) },
  );
});
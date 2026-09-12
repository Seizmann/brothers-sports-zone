# Baniq Pay Integration — Notes & Owner Checklist

> Working document for the Baniq Pay automated payment gateway integration.
> Contains API notes, the secret names this integration needs, and a checklist of
> the steps only the account owner can do. **No real secret values ever go in this file.**

- Public developer docs: https://baniq.app/developers
- Merchant dashboard: https://payme.baniq.app (owner account "Mohammad", free plan)
- Status: **integration in progress** — this file is updated as each phase lands.

---

## 1. How Baniq Pay works (our notes, verified from their docs + dashboard)

Baniq Pay lets a merchant accept bKash / Nagad / Rocket / Upay **on the merchant's own
personal MFS numbers**. When a buyer pays, an SMS arrives on the merchant's phone; the
**Baniq Pay Android app** (paired device) reads that SMS and Baniq auto-verifies the
payment against the order. No TrxID copy-paste; a manual-TrxID fallback exists for
edge cases (`manual_review` state, surfaced in their dashboard).

### API contract (base `https://api.baniq.app`)

- **Auth (server-to-server only):** every call carries `x-api-key-id: dpk_…` and
  `x-api-secret: dps_…`. The secret is shown exactly once at key creation.
- **Create order:** `POST /api/v1/orders`
  - `amount` — integer **paisa** (BDT × 100; `82000` = ৳820.00), fixed, max ৳1,000,000.
  - `productName` — shown on the hosted checkout.
  - `provider` — optional `bkash` | `nagad` | … (omit = first active number).
  - `reference` — our own id, echoed back in verify + webhook (we use the booking UUID).
  - `successUrl` / `cancelUrl` — where the buyer is redirected after payment/cancel.
  - `metadata` — arbitrary JSON, echoed back (we send `{ booking_code }`).
  - Response: `{ orderId, status: "created", amount, checkoutUrl, expiresAt }` — the
    hosted checkout (`https://pay.baniq.app/checkout/<orderId>`) expires (~5 min in
    their example).
- **Verify payment (authoritative):** `GET /api/v1/orders/:orderId`
  - Returns `paid: true|false`, `status`, `amount` (paisa), `buyerSenderNumber`, `paidAt`,
    plus the echoed `reference`/`metadata`.
  - **Golden rule (theirs):** never fulfil from the browser redirect alone — always
    confirm server-to-server via this verify call or a signature-checked webhook.
- **Webhook `order.paid`:** Baniq POSTs to the merchant-configured webhook URL with
  headers `x-deshpay-event: order.paid` and
  `x-deshpay-signature: sha256=<hex>` where hex = HMAC-SHA256 of the **exact raw body**
  using the webhook secret. Verify with constant-time compare. Retries use exponential
  backoff → the receiver must be idempotent and respond 200 quickly.
- **Order lifecycle:** `created → awaiting_payment → auto_verifying → paid`; branch
  states: `manual_review` (buyer paid from a different number than declared, or timed
  out → manual TrxID fallback), `failed`, `expired`. Our integration acts **only** on
  `paid` (via verify/webhook) — everything else stays inside Baniq's dashboard.
- **Errors:** non-2xx with `{ message }` — `401` bad key, `400` invalid body,
  `404` unknown order.
- **No sandbox mode.** Testing means real (small) payments.

### Merchant account state (checked 2026-09-12, read-only)

| Item | State |
|---|---|
| Plan | Free — 100 auto-verifies/month, resets the 1st |
| Payment numbers | bKash **merchant** 01920669997 · Nagad **personal** 01920669997 |
| Device app (reads payment SMS) | Paired, online ("আমার ফোন") |
| Webhook secret | Already generated in dashboard |
| Webhook URL | **Empty — must be set to the deployed function URL** |
| API key | **None yet — one must be created** |

---

## 2. Integration architecture (this repo)

```
Checkout (Baniq mode active)
  1. submit_booking RPC (payment_method='baniq_pay') → booking status='pending_payment'
     (all pricing/advance/coupon/lock logic unchanged, server-side)
  2. Edge Function baniq-create-order (user JWT) → POST /api/v1/orders
     amount = advance × 100 paisa, reference = booking.id → returns checkoutUrl
  3. Browser redirects to checkoutUrl (Baniq hosted checkout)
  4a. Webhook order.paid → Edge Function baniq-webhook (HMAC-verified, no JWT)
      → RPC confirm_baniq_payment → booking confirmed
  4b. Buyer redirected back (?baniq=return) → Edge Function baniq-verify
      (server-side GET /api/v1/orders/:id) → same RPC (idempotent, race-safe)
```

- Both confirmation paths end in **one Postgres RPC** (`confirm_baniq_payment`) that
  re-validates the paid amount against the booking's advance — the client can never
  mark a booking paid.
- Slot locks are attached to the booking at submit time and attached locks are never
  expiry-swept, so the slot stays held for the whole hosted-checkout window.
- A pg_cron sweep cancels `pending_payment` Baniq bookings ~15 min after their order
  expiry (abandoned checkouts) and frees the slots.
- Manual bKash/Nagad flow is untouched and remains the default; `/management/settings`
  toggles between the two modes (`settings.payment_gateway_mode`: `manual` | `baniq_pay`).

---

## 3. Secrets required (names only — values live in Supabase Edge Function secrets)

| Secret | What it is | Where it comes from |
|---|---|---|
| `BANIQ_API_KEY_ID` | API key id (`dpk_…`) | Dashboard → API ও Webhook → + নতুন কী |
| `BANIQ_API_SECRET` | API key secret (`dps_…`, shown once) | Same creation dialog |
| `BANIQ_WEBHOOK_SECRET` | HMAC secret for webhook signatures | Dashboard → API ও Webhook → Webhook Secret (already exists) |

Set them on the Supabase project (`jbrndeeeictiwaydbchr`) as Edge Function secrets.
They are **never** put in client code, `.env` files committed to the repo, or this doc.

---

## 4. Owner checklist

Items only the account owner can do, or that must happen on the merchant/Supabase
accounts. Agent-completed items are ticked as they land.

- [x] Baniq Pay payment numbers configured (bKash merchant + Nagad personal, 01920669997).
- [x] Baniq Pay device app installed + paired on the merchant phone and online.
- [x] Webhook secret generated in dashboard → API ও Webhook (value stays out of the repo;
      copied directly into the Supabase Edge Function secret `BANIQ_WEBHOOK_SECRET`).
- [ ] **API key created** → Dashboard → API ও Webhook → "+ নতুন কী"; store the shown-once
      secret immediately as `BANIQ_API_KEY_ID` + `BANIQ_API_SECRET` Edge Function secrets.
- [ ] **Edge Functions deployed** (`baniq-create-order`, `baniq-verify`, `baniq-webhook`;
      webhook function must have "Verify JWT" disabled) and secrets set.
- [ ] **Webhook URL set** in Dashboard → API ও Webhook → Webhook URL:
      `https://jbrndeeeictiwaydbchr.supabase.co/functions/v1/baniq-webhook`
      (set only after the function is deployed).
- [ ] **Real-payment test** (no sandbox exists): create a test booking with the mode
      toggle ON, complete checkout, send the exact advance amount from a bKash/Nagad
      account whose number matches the sender number declared on Baniq's checkout page,
      then confirm: booking flips to `confirmed` automatically, receipt shows the Baniq
      order id, admin bookings list shows payment method "Baniq pay".
      Note: paying from a **different** number than declared lands the order in
      `manual_review` (Baniq dashboard) — the booking will NOT auto-confirm; handle it
      inside Baniq's dashboard or use a matching sender number.
- [ ] **Go live:** in `/management/settings`, switch Payment mode to "Baniq Pay".
      Default stays "Manual bKash/Nagad" until this is flipped deliberately.
- [ ] Free-plan note: 100 auto-verified payments/month. If monthly advance payments
      exceed that, orders fall back to manual review — upgrade the Baniq plan.

### Fallback deployment path (if dashboard deploy is unavailable)

Install the Supabase CLI, add `SUPABASE_ACCESS_TOKEN` (Supabase dashboard → Access
Tokens) to `SECRETS.md`, then from the repo root:

```
supabase functions deploy baniq-create-order baniq-verify baniq-webhook \
  --project-ref jbrndeeeictiwaydbchr
supabase secrets set BANIQ_API_KEY_ID=… BANIQ_API_SECRET=… BANIQ_WEBHOOK_SECRET=… \
  --project-ref jbrndeeeictiwaydbchr
```

(`baniq-webhook` is deployed with `--no-verify-jwt`.)

---

## 5. Session log (updated per phase)

- **2026-09-12 (planning):** read developer docs + merchant dashboard (read-only); API
  contract verified; schema/RPC/UI/Edge-Function plan approved; live payment test
  deferred to owner.
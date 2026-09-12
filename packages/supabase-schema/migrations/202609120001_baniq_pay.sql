-- Migration 012: Baniq Pay automated payment gateway, alongside the manual flow.
-- Adds a settings.payment_gateway_mode toggle ('manual' | 'baniq_pay', default
-- 'manual' — existing behavior unchanged until an admin flips it), a 'baniq_pay'
-- payment method, gateway bookkeeping columns on bookings, and the server-side
-- confirmation path: confirm_baniq_payment (called only by Edge Functions via
-- the service role) transitions a pending gateway booking to confirmed after
-- re-validating the paid paisa amount against the booking's advance. A pg_cron
-- sweep cancels abandoned gateway checkouts so their slots free up again.
--
-- NOTE ON APPLYING: `alter type ... add value` cannot share a transaction block
-- with statements that use the new value. psql runs each statement in its own
-- autocommit transaction, so applying this file with plain psql (as every prior
-- migration) is safe. Do not wrap it in -1/--single-transaction.

alter type public.payment_method add value 'baniq_pay';

alter table public.settings
  add column payment_gateway_mode text not null default 'manual'
  check (payment_gateway_mode in ('manual', 'baniq_pay'));

alter table public.bookings
  add column baniq_order_id text,
  add column baniq_checkout_url text,
  add column baniq_order_expires_at timestamptz,
  add column baniq_paid_at timestamptz;

alter table public.bookings
  add constraint bookings_baniq_order_id_key unique (baniq_order_id);

-- Gateway bookings can be auto-cancelled by the stale-checkout sweep, which is
-- neither the user nor the admin.
alter table public.bookings drop constraint bookings_cancelled_by_check;
alter table public.bookings
  add constraint bookings_cancelled_by_check
  check (cancelled_by in ('user', 'admin', 'system'));

-- ---------------------------------------------------------------------------
-- submit_booking: rewritten from migration 009. Manual paths are identical;
-- the only deltas are the baniq_pay branch (mode guard, no manual txn fields,
-- no admin walk-in, status pending_payment) and the booking status expression.
-- ---------------------------------------------------------------------------
create or replace function public.submit_booking(
  p_items jsonb,
  p_payment_method public.payment_method,
  p_txn_id text default null,
  p_txn_phone text default null,
  p_coupon_code text default null,
  p_confirm boolean default false,
  p_for_user_phone text default null
)
returns public.bookings
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_caller uuid := auth.uid();
  v_caller_is_admin boolean := public.is_admin();
  v_user public.users;
  v_settings public.settings;
  v_today date := (now() at time zone 'Asia/Dhaka')::date;
  v_coupon public.coupons;
  v_coupon_id uuid := null;
  v_discount numeric(10, 2) := 0;
  v_subtotal numeric(10, 2) := 0;
  v_total numeric(10, 2);
  v_advance numeric(10, 2);
  v_cash_due numeric(10, 2);
  v_booking public.bookings;
  v_item jsonb;
  v_slot_id integer;
  v_item_date date;
  v_expected_locks integer := 0;
  v_attached_locks integer := 0;
  v_seen text[] := '{}';
begin
  if v_caller is null then
    raise exception 'You must be signed in to create a booking';
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'At least one slot is required';
  end if;

  if v_caller_is_admin then
    if p_for_user_phone is null then
      raise exception 'Admin-created bookings require a user phone number';
    end if;
    select * into v_user from public.users where phone = p_for_user_phone;
    if not found then
      raise exception 'No user found with phone %', p_for_user_phone;
    end if;
  else
    if p_for_user_phone is not null then
      raise exception 'Only admins can book on behalf of another user';
    end if;
    select * into v_user from public.users where id = v_caller;
    if not found then
      raise exception 'User profile not found';
    end if;
  end if;

  if p_confirm and not v_caller_is_admin then
    raise exception 'Only admins can confirm a booking directly';
  end if;

  if p_payment_method in ('bkash', 'nagad') and (p_txn_id is null or length(trim(p_txn_id)) = 0) then
    raise exception 'A transaction ID is required for bKash/Nagad payments';
  end if;

  select * into v_settings from public.settings where id = 1;
  if not found then
    raise exception 'System settings are missing';
  end if;

  if p_payment_method = 'baniq_pay' then
    -- The gateway path is self-checkout only: admins walk in manually, and the
    -- booking must stay pending until Baniq verifies the payment server-side.
    if v_caller_is_admin or p_confirm then
      raise exception 'Baniq Pay checkout is only available for online self-bookings';
    end if;
    if v_settings.payment_gateway_mode <> 'baniq_pay' then
      raise exception 'Online payments are currently set to manual bKash/Nagad verification';
    end if;
    if p_txn_id is not null or p_txn_phone is not null then
      raise exception 'Gateway bookings do not take manual transaction details';
    end if;
  end if;

  perform public.cleanup_expired_slot_locks();

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_slot_id := (v_item ->> 'slot_id')::integer;
    v_item_date := (v_item ->> 'date')::date;

    if v_slot_id is null or v_item_date is null then
      raise exception 'Each item needs a slot_id and a date';
    end if;
    if exists (select 1 from public.slots where id = v_slot_id) = false then
      raise exception 'Invalid slot %', v_slot_id;
    end if;
    if v_item_date < v_today then
      raise exception 'Cannot book a past date (%)', v_item_date;
    end if;
    if (v_slot_id::text || ':' || v_item_date::text) = any (v_seen) then
      raise exception 'Duplicate slot in booking request';
    end if;
    v_seen := v_seen || (v_slot_id::text || ':' || v_item_date::text);

    if exists (
      select 1 from public.blackouts
      where date = v_item_date and (slot_id = v_slot_id or slot_id is null)
    ) then
      raise exception 'The slot on % is blacked out', v_item_date;
    end if;

    if exists (
      select 1
      from public.booking_items item
      join public.bookings booking on booking.id = item.booking_id
      where item.slot_id = v_slot_id
        and item.date = v_item_date
        and booking.status in ('pending_payment', 'payment_submitted', 'confirmed')
    ) then
      raise exception 'The slot on % is already booked', v_item_date;
    end if;

    v_subtotal := v_subtotal + (select price from public.slots where id = v_slot_id);
    v_expected_locks := v_expected_locks + 1;
  end loop;

  if p_coupon_code is not null and length(trim(p_coupon_code)) > 0 then
    select * into v_coupon
    from public.coupons
    where lower(code) = lower(trim(p_coupon_code))
    for update;

    if not found then
      raise exception 'Invalid coupon code';
    end if;
    if not v_coupon.is_active then
      raise exception 'This coupon is not active';
    end if;
    if v_coupon.valid_from is not null and v_today < v_coupon.valid_from then
      raise exception 'This coupon is not valid yet';
    end if;
    if v_coupon.valid_until is not null and v_today > v_coupon.valid_until then
      raise exception 'This coupon has expired';
    end if;
    if v_coupon.usage_limit is not null and v_coupon.usage_count >= v_coupon.usage_limit then
      raise exception 'This coupon has reached its usage limit';
    end if;

    v_coupon_id := v_coupon.id;
    v_discount := case v_coupon.type
      when 'percentage' then round(v_subtotal * v_coupon.value / 100.0, 2)
      else least(v_coupon.value, v_subtotal)
    end;
  end if;

  v_total := v_subtotal - v_discount;

  if p_confirm and p_payment_method = 'cash' then
    -- Walk-in paid in full on the spot.
    v_advance := v_total;
    v_cash_due := 0;
  else
    -- Fixed advance, capped at the total so the online amount never exceeds it.
    v_advance := least(v_settings.advance_amount_fixed, v_total);
    v_cash_due := v_total - v_advance;
  end if;

  insert into public.bookings (
    user_id, status, created_by_admin, coupon_id, discount_amount,
    total_amount, advance_amount, cash_due, payment_method, txn_id, txn_phone
  ) values (
    v_user.id,
    case
      when p_confirm then 'confirmed'::public.booking_status
      when p_payment_method = 'baniq_pay' then 'pending_payment'::public.booking_status
      else 'payment_submitted'::public.booking_status
    end,
    case when v_caller_is_admin then v_caller else null end,
    v_coupon_id,
    v_discount,
    v_total,
    v_advance,
    v_cash_due,
    p_payment_method,
    nullif(trim(coalesce(p_txn_id, '')), ''),
    nullif(trim(coalesce(p_txn_phone, '')), '')
  )
  returning * into v_booking;

  for v_item in select * from jsonb_array_elements(p_items) loop
    insert into public.booking_items (booking_id, slot_id, date, price)
    select v_booking.id, (v_item ->> 'slot_id')::integer, (v_item ->> 'date')::date, price
    from public.slots
    where id = (v_item ->> 'slot_id')::integer;
  end loop;

  update public.slot_locks
  set booking_id = v_booking.id
  where session_id = v_caller::text
    and booking_id is null
    and (slot_id, date) in (
      select (entry ->> 'slot_id')::integer, (entry ->> 'date')::date
      from jsonb_array_elements(p_items) as entry
    );

  get diagnostics v_attached_locks = row_count;
  if v_attached_locks <> v_expected_locks then
    raise exception 'Your slot lock has expired. Please select your slots again.';
  end if;

  if v_coupon_id is not null then
    update public.coupons
    set usage_count = usage_count + 1
    where id = v_coupon_id;
  end if;

  return v_booking;
end;
$$;

-- ---------------------------------------------------------------------------
-- Gateway confirmation — the single trust boundary for marking a Baniq booking
-- paid. Only the service role (Edge Functions) may execute it: it re-validates
-- the paid paisa amount against the booking's stored advance and is idempotent
-- (webhook + verify paths can race). Cancelled/rejected bookings are never
-- revived by a late payment — the caller gets a distinct result code instead.
-- ---------------------------------------------------------------------------
create or replace function public.confirm_baniq_payment(
  p_order_id text,
  p_amount_paisa bigint,
  p_sender_number text default null,
  p_paid_at timestamptz default null
)
returns text
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_booking public.bookings;
  v_expected_paisa bigint;
begin
  if p_order_id is null or length(trim(p_order_id)) = 0 then
    return 'booking_not_found';
  end if;

  select * into v_booking
  from public.bookings
  where baniq_order_id = p_order_id
  for update;

  if not found then
    return 'booking_not_found';
  end if;

  if v_booking.status = 'confirmed' then
    return 'already_confirmed';
  end if;

  if v_booking.status in ('cancelled', 'rejected') then
    return 'booking_cancelled';
  end if;

  v_expected_paisa := round(v_booking.advance_amount * 100)::bigint;
  if p_amount_paisa is null or p_amount_paisa <> v_expected_paisa then
    return 'amount_mismatch';
  end if;

  update public.bookings
  set status = 'confirmed',
      txn_id = p_order_id,
      txn_phone = nullif(trim(coalesce(p_sender_number, '')), ''),
      baniq_paid_at = coalesce(p_paid_at, now())
  where id = v_booking.id;

  return 'confirmed';
end;
$$;

revoke execute on function public.confirm_baniq_payment(text, bigint, text, timestamptz)
  from public, anon, authenticated;
grant execute on function public.confirm_baniq_payment(text, bigint, text, timestamptz)
  to service_role;

-- ---------------------------------------------------------------------------
-- Abandoned gateway checkouts: a pending baniq_pay booking whose Baniq order
-- expired >15 minutes ago (or that never got an order) is cancelled so the
-- existing lock sweep frees its slots on the next tick. The order itself
-- expires on Baniq's side; a webhook arriving after cancellation is a no-op.
-- ---------------------------------------------------------------------------
create or replace function public.expire_stale_gateway_bookings()
returns integer
language sql
security definer
set search_path = public
as $$
  with expired as (
    update public.bookings
    set status = 'cancelled',
        cancelled_by = 'system'
    where status = 'pending_payment'
      and payment_method = 'baniq_pay'
      and coalesce(baniq_order_expires_at, created_at) < now() - interval '15 minutes'
    returning id
  )
  select count(*)::integer from expired;
$$;

create extension if not exists pg_cron;

do $$
begin
  if exists (select 1 from cron.job where jobname = 'cleanup-stale-gateway-bookings') then
    perform cron.unschedule('cleanup-stale-gateway-bookings');
  end if;
  perform cron.schedule('cleanup-stale-gateway-bookings', '* * * * *', 'select public.expire_stale_gateway_bookings()');
end $$;
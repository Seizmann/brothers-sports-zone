-- Migration 009: replace the percentage-based advance with a fixed BDT amount.
-- settings.advance_pct (default 50%) drove the advance split in submit_booking;
-- the turf wants a flat advance instead (default 120 BDT). Adds
-- advance_amount_fixed (the singleton row backfills to the default), rewrites
-- the advance computation in submit_booking — least() caps the advance at the
-- booking total so a cheap booking plus a coupon can never demand more online
-- than the total — then drops advance_pct.

alter table public.settings
  add column advance_amount_fixed numeric(10, 2) not null default 120
  check (advance_amount_fixed >= 0);

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
    case when p_confirm then 'confirmed'::public.booking_status else 'payment_submitted'::public.booking_status end,
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

alter table public.settings drop column advance_pct;
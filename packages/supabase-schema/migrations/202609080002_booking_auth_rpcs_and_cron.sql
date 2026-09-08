-- Migration 002: booking/auth RPCs, public availability, realtime publication, pg_cron
-- Builds on 202609080001_initial_schema.sql (never edit an applied migration).

-- ---------------------------------------------------------------------------
-- 1. Realtime publication: slot locks + bookings drive live slot availability
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'slot_locks'
  ) then
    alter publication supabase_realtime add table public.slot_locks;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'bookings'
  ) then
    alter publication supabase_realtime add table public.bookings;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 2. Public availability RPC: the only way anonymous visitors learn slot state.
--    Returns date/slot/state only — no user or payment data leaks.
-- ---------------------------------------------------------------------------
create or replace function public.get_slot_availability(from_date date, to_date date)
returns table (date date, slot_id integer, state text)
language sql
stable
security definer
set search_path = public
as $$
  select item.date, item.slot_id, 'booked'::text
  from public.booking_items item
  join public.bookings booking on booking.id = item.booking_id
  where item.date between from_date and to_date
    and booking.status in ('pending_payment', 'payment_submitted', 'confirmed')

  union

  select blackouts.date, slots.id, 'blackout'::text
  from public.blackouts
  join public.slots on true
  where blackouts.date between from_date and to_date
    and blackouts.slot_id is null

  union

  select blackouts.date, blackouts.slot_id, 'blackout'::text
  from public.blackouts
  where blackouts.date between from_date and to_date
    and blackouts.slot_id is not null
$$;

-- ---------------------------------------------------------------------------
-- 3. Lock cleanup: also free locks attached to cancelled/rejected bookings so
--    those slots become bookable again.
-- ---------------------------------------------------------------------------
create or replace function public.cleanup_expired_slot_locks()
returns integer
language sql
security definer
set search_path = public
as $$
  with removed as (
    delete from public.slot_locks
    where (expires_at <= now() and booking_id is null)
       or booking_id in (select id from public.bookings where status in ('cancelled', 'rejected'))
    returning id
  )
  select count(*)::integer from removed;
$$;

-- try_lock_slot inherits the wider sweep so a rejected booking's leftover lock
-- never wedges a slot into "currently locked".
create or replace function public.try_lock_slot(
  requested_slot_id integer,
  requested_date date,
  requested_session_id text,
  requested_minutes integer default 5
)
returns public.slot_locks
language plpgsql
security definer
set search_path = public
as $$
declare
  result public.slot_locks;
begin
  if requested_session_id is null or length(trim(requested_session_id)) = 0 then
    raise exception 'A session identifier is required';
  end if;

  perform public.cleanup_expired_slot_locks();

  if exists (
    select 1 from public.blackouts
    where date = requested_date and (slot_id = requested_slot_id or slot_id is null)
  ) then
    raise exception 'This slot is blacked out';
  end if;

  if exists (
    select 1
    from public.booking_items item
    join public.bookings booking on booking.id = item.booking_id
    where item.slot_id = requested_slot_id
      and item.date = requested_date
      and booking.status in ('pending_payment', 'payment_submitted', 'confirmed')
  ) then
    raise exception 'This slot is already booked';
  end if;

  begin
    insert into public.slot_locks (slot_id, date, session_id, expires_at)
    values (requested_slot_id, requested_date, requested_session_id, now() + make_interval(mins => greatest(requested_minutes, 1)))
    returning * into result;
  exception when unique_violation then
    raise exception 'This slot is currently locked';
  end;

  return result;
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. Auth: deterministic phone+PIN credential scheme.
--    auth.users.encrypted_password = bcrypt( SHA-256('bsz-auth-v1:phone:pin') , own salt )
--    public.users.pin_hash          = bcrypt( pin , own salt )
--    Two independent, separately-salted values. Identical PINs across users
--    yield different auth credentials because the phone is in the derivation.
-- ---------------------------------------------------------------------------
create or replace function public.derived_auth_password(p_phone text, p_pin text)
returns text
language sql
immutable
as $$
  select encode(digest('bsz-auth-v1:' || p_phone || ':' || p_pin, 'sha256'), 'hex')
$$;

create or replace function public.user_sign_up(p_name text, p_phone text, p_pin text)
returns public.users
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text;
  v_auth_id uuid;
  v_user public.users;
begin
  if p_name is null or length(trim(p_name)) < 2 then
    raise exception 'Please enter your full name';
  end if;
  if p_phone is null or p_phone !~ '^01[0-9]{9}$' then
    raise exception 'Please enter a valid 11-digit Bangladeshi phone number (e.g. 01XXXXXXXXX)';
  end if;
  if p_pin is null or p_pin !~ '^[0-9]{4}$' then
    raise exception 'PIN must be exactly 4 digits';
  end if;

  if exists (select 1 from public.users where phone = p_phone) then
    raise exception 'An account with this phone number already exists. Please log in instead.';
  end if;

  v_email := lower(p_phone) || '@phone.brotherssportszone.com';

  if exists (select 1 from auth.users where email = v_email) then
    raise exception 'An account with this phone number already exists. Please log in instead.';
  end if;

  insert into auth.users (aud, role, email, encrypted_password, email_confirmed_at, raw_user_meta_data)
  values (
    'authenticated',
    'authenticated',
    v_email,
    crypt(public.derived_auth_password(p_phone, p_pin), gen_salt('bf')),
    now(),
    jsonb_build_object('full_name', trim(p_name))
  )
  returning id into v_auth_id;

  insert into public.users (id, name, phone, pin_hash)
  values (v_auth_id, trim(p_name), p_phone, crypt(p_pin, gen_salt('bf')))
  returning * into v_user;

  return v_user;
end;
$$;

create or replace function public.admin_reset_user_pin(p_user_id uuid, p_new_pin text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_phone text;
begin
  if not public.is_admin() then
    raise exception 'Only admins can reset PINs';
  end if;
  if p_new_pin is null or p_new_pin !~ '^[0-9]{4}$' then
    raise exception 'PIN must be exactly 4 digits';
  end if;
  if not exists (select 1 from public.users where id = p_user_id) then
    raise exception 'User not found';
  end if;

  select phone into v_phone from public.users where id = p_user_id;

  update public.users
  set pin_hash = crypt(p_new_pin, gen_salt('bf'))
  where id = p_user_id;

  update auth.users
  set encrypted_password = crypt(public.derived_auth_password(v_phone, p_new_pin), gen_salt('bf'))
  where id = p_user_id;

  if not found then
    raise exception 'Auth account not found for this user';
  end if;
end;
$$;

create or replace function public.admin_create_admin(p_email text, p_password text)
returns public.admin_users
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := lower(trim(coalesce(p_email, '')));
  v_auth_id uuid;
  v_row public.admin_users;
begin
  -- Bootstrap clause: the very first admin may be created before any exist
  -- (used once at setup; afterwards only active admins can create more).
  if not public.is_admin() and exists (select 1 from public.admin_users) then
    raise exception 'Only admins can create admin accounts';
  end if;
  if v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'Please enter a valid email address';
  end if;
  if p_password is null or length(p_password) < 8 then
    raise exception 'Password must be at least 8 characters';
  end if;
  if exists (select 1 from auth.users where email = v_email) then
    raise exception 'An account with this email already exists';
  end if;

  insert into auth.users (aud, role, email, encrypted_password, email_confirmed_at)
  values ('authenticated', 'authenticated', v_email, crypt(p_password, gen_salt('bf')), now())
  returning id into v_auth_id;

  insert into public.admin_users (id, email)
  values (v_auth_id, v_email)
  returning * into v_row;

  return v_row;
end;
$$;

-- Walk-in support: admin looks up a user by phone or creates a minimal account
-- (random unknown credential — the user gains access when an admin resets their PIN).
create or replace function public.admin_ensure_user(p_name text, p_phone text)
returns public.users
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing public.users;
  v_name text := coalesce(nullif(trim(p_name), ''), 'Walk-in Guest');
  v_auth_id uuid;
  v_user public.users;
begin
  if not public.is_admin() then
    raise exception 'Only admins can manage users';
  end if;
  if p_phone is null or p_phone !~ '^01[0-9]{9}$' then
    raise exception 'Please enter a valid 11-digit Bangladeshi phone number';
  end if;

  select * into v_existing from public.users where phone = p_phone;
  if found then
    return v_existing;
  end if;

  if exists (select 1 from auth.users where email = lower(p_phone) || '@phone.brotherssportszone.com') then
    raise exception 'An auth account already exists for this phone but has no profile';
  end if;

  insert into auth.users (aud, role, email, encrypted_password, email_confirmed_at, raw_user_meta_data)
  values (
    'authenticated',
    'authenticated',
    lower(p_phone) || '@phone.brotherssportszone.com',
    crypt(encode(gen_random_bytes(24), 'hex'), gen_salt('bf')),
    now(),
    jsonb_build_object('full_name', v_name)
  )
  returning id into v_auth_id;

  insert into public.users (id, name, phone, pin_hash)
  values (v_auth_id, v_name, p_phone, crypt(lpad((floor(random() * 10000))::integer::text, 4, '0'), gen_salt('bf')))
  returning * into v_user;

  return v_user;
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. Atomic booking submission. Re-validates every slot server-side, computes
--    all amounts from slots.price + settings (client cannot tamper), applies
--    the coupon, creates booking + items, and attaches the caller's slot locks.
--    Admin walk-ins pass p_confirm = true (+ p_for_user_phone) and land as
--    'confirmed' (cash) or 'payment_submitted' (bKash/Nagad advance).
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
set search_path = public
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
    v_advance := round(v_total * v_settings.advance_pct / 100.0, 2);
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
      select (v_item ->> 'slot_id')::integer, (v_item ->> 'date')::date
      from jsonb_array_elements(p_items) as v_item
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
-- 6. RLS addition: users insert own profile (client-side signup fallback path)
-- ---------------------------------------------------------------------------
create policy "users insert own profile" on public.users
for insert with check (id = auth.uid());

-- ---------------------------------------------------------------------------
-- 7. Explicit RPC grants (defensive — defaults already grant these)
-- ---------------------------------------------------------------------------
grant execute on function public.get_slot_availability(date, date) to anon, authenticated;
grant execute on function public.try_lock_slot(integer, date, text, integer) to anon, authenticated;
grant execute on function public.user_sign_up(text, text, text) to anon, authenticated;
grant execute on function public.submit_booking(jsonb, public.payment_method, text, text, text, boolean, text) to authenticated;
grant execute on function public.admin_reset_user_pin(uuid, text) to authenticated;
grant execute on function public.admin_create_admin(text, text) to authenticated;
grant execute on function public.admin_ensure_user(text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 8. pg_cron: sweep expired/void locks every minute
-- ---------------------------------------------------------------------------
create extension if not exists pg_cron;

do $$
begin
  if exists (select 1 from cron.job where jobname = 'cleanup-expired-slot-locks') then
    perform cron.unschedule('cleanup-expired-slot-locks');
  end if;
  perform cron.schedule('cleanup-expired-slot-locks', '* * * * *', 'select public.cleanup_expired_slot_locks()');
end $$;

create extension if not exists pgcrypto;

create type public.booking_status as enum ('pending_payment', 'payment_submitted', 'confirmed', 'cancelled', 'rejected');
create type public.payment_method as enum ('bkash', 'nagad', 'cash');
create type public.coupon_type as enum ('percentage', 'flat');
create type public.refund_status as enum ('pending', 'refunded');

create table public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  phone text unique not null check (phone ~ '^01[0-9]{9}$'),
  pin_hash text not null,
  created_at timestamptz not null default now()
);

create table public.admin_users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique not null,
  role text not null default 'super_admin' check (role = 'super_admin'),
  created_at timestamptz not null default now(),
  is_active boolean not null default true
);

create table public.slots (
  id serial primary key,
  slot_number integer unique not null check (slot_number between 1 and 16),
  label text not null,
  period text not null check (period in ('Morning', 'Afternoon', 'Evening', 'Night')),
  start_time time not null,
  end_time time not null,
  price numeric(10, 2) not null default 0 check (price >= 0)
);

create table public.coupons (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  type public.coupon_type not null,
  value numeric(10, 2) not null check (value > 0),
  valid_from date,
  valid_until date,
  usage_limit integer check (usage_limit is null or usage_limit > 0),
  usage_count integer not null default 0 check (usage_count >= 0),
  is_active boolean not null default true,
  created_by uuid references public.admin_users(id) on delete set null,
  created_at timestamptz not null default now(),
  check (valid_until is null or valid_from is null or valid_until >= valid_from)
);

create table public.blackouts (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  slot_id integer references public.slots(id) on delete cascade,
  reason text,
  created_by uuid references public.admin_users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (date, slot_id)
);

create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  booking_code text unique not null,
  user_id uuid not null references public.users(id) on delete restrict,
  status public.booking_status not null default 'pending_payment',
  created_by_admin uuid references public.admin_users(id) on delete set null,
  coupon_id uuid references public.coupons(id) on delete set null,
  discount_amount numeric(10, 2) not null default 0 check (discount_amount >= 0),
  total_amount numeric(10, 2) not null check (total_amount >= 0),
  advance_amount numeric(10, 2) not null check (advance_amount >= 0),
  cash_due numeric(10, 2) not null check (cash_due >= 0),
  payment_method public.payment_method,
  txn_id text,
  txn_phone text,
  rejection_reason text,
  refund_status public.refund_status,
  cancelled_by text check (cancelled_by in ('user', 'admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.booking_items (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  slot_id integer not null references public.slots(id) on delete restrict,
  date date not null,
  price numeric(10, 2) not null check (price >= 0),
  unique (booking_id, slot_id, date)
);

create table public.slot_locks (
  id uuid primary key default gen_random_uuid(),
  slot_id integer not null references public.slots(id) on delete cascade,
  date date not null,
  session_id text not null,
  locked_at timestamptz not null default now(),
  expires_at timestamptz not null,
  booking_id uuid references public.bookings(id) on delete cascade,
  unique (slot_id, date)
);

create table public.settings (
  id integer primary key default 1 check (id = 1),
  bkash_number text,
  nagad_number text,
  advance_pct integer not null default 50 check (advance_pct between 0 and 100),
  lock_minutes integer not null default 5 check (lock_minutes > 0)
);

create or replace function public.generate_booking_code()
returns text language plpgsql volatile as $$
declare
  candidate text;
begin
  loop
    candidate := 'BSZ-' || upper(substr(encode(gen_random_bytes(3), 'hex'), 1, 4)) || '-' || upper(substr(encode(gen_random_bytes(2), 'hex'), 1, 3));
    exit when not exists (select 1 from public.bookings where booking_code = candidate);
  end loop;
  return candidate;
end;
$$;

create or replace function public.set_booking_code()
returns trigger language plpgsql as $$
begin
  if new.booking_code is null or new.booking_code = '' then
    new.booking_code := public.generate_booking_code();
  end if;
  return new;
end;
$$;

create trigger bookings_set_code before insert on public.bookings
for each row execute function public.set_booking_code();

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger bookings_touch_updated_at before update on public.bookings
for each row execute function public.touch_updated_at();

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admin_users where id = auth.uid() and is_active = true);
$$;

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

  delete from public.slot_locks
  where expires_at <= now() and booking_id is null;

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

create or replace function public.cleanup_expired_slot_locks()
returns integer
language sql
security definer
set search_path = public
as $$
  with removed as (
    delete from public.slot_locks
    where expires_at <= now() and booking_id is null
    returning id
  )
  select count(*)::integer from removed;
$$;

alter table public.users enable row level security;
alter table public.admin_users enable row level security;
alter table public.slots enable row level security;
alter table public.coupons enable row level security;
alter table public.blackouts enable row level security;
alter table public.bookings enable row level security;
alter table public.booking_items enable row level security;
alter table public.slot_locks enable row level security;
alter table public.settings enable row level security;

create policy "users read own profile" on public.users for select using (id = auth.uid() or public.is_admin());
create policy "users update own profile" on public.users for update using (id = auth.uid() or public.is_admin()) with check (id = auth.uid() or public.is_admin());
create policy "admins manage users" on public.users for all using (public.is_admin()) with check (public.is_admin());

create policy "admins read admin users" on public.admin_users for select using (id = auth.uid() or public.is_admin());
create policy "admins manage admin users" on public.admin_users for all using (public.is_admin()) with check (public.is_admin());

create policy "anyone read slots" on public.slots for select using (true);
create policy "admins manage slots" on public.slots for all using (public.is_admin()) with check (public.is_admin());

create policy "admins manage coupons" on public.coupons for all using (public.is_admin()) with check (public.is_admin());
create policy "admins manage blackouts" on public.blackouts for all using (public.is_admin()) with check (public.is_admin());

create policy "users read own bookings" on public.bookings for select using (user_id = auth.uid() or public.is_admin());
create policy "users create own bookings" on public.bookings for insert with check (user_id = auth.uid() or public.is_admin());
create policy "users update own pending bookings" on public.bookings for update using ((user_id = auth.uid() and status in ('pending_payment', 'payment_submitted')) or public.is_admin()) with check (user_id = auth.uid() or public.is_admin());
create policy "admins delete bookings" on public.bookings for delete using (public.is_admin());

create policy "users read own booking items" on public.booking_items for select using (exists (select 1 from public.bookings b where b.id = booking_id and (b.user_id = auth.uid() or public.is_admin())));
create policy "users create own booking items" on public.booking_items for insert with check (exists (select 1 from public.bookings b where b.id = booking_id and (b.user_id = auth.uid() or public.is_admin())));
create policy "admins manage booking items" on public.booking_items for all using (public.is_admin()) with check (public.is_admin());

create policy "users read active locks" on public.slot_locks for select using (session_id = auth.uid()::text or public.is_admin() or expires_at > now());
create policy "users create own locks" on public.slot_locks for insert with check (session_id = auth.uid()::text or public.is_admin());
create policy "users update own locks" on public.slot_locks for update using (session_id = auth.uid()::text or public.is_admin()) with check (session_id = auth.uid()::text or public.is_admin());
create policy "users delete own locks" on public.slot_locks for delete using (session_id = auth.uid()::text or public.is_admin());

create policy "anyone read settings" on public.settings for select using (true);
create policy "admins manage settings" on public.settings for all using (public.is_admin()) with check (public.is_admin());

insert into public.slots (slot_number, label, period, start_time, end_time, price) values
  (1, '06:00 – 07:30', 'Morning', '06:00', '07:30', 0),
  (2, '07:30 – 09:00', 'Morning', '07:30', '09:00', 0),
  (3, '09:00 – 10:30', 'Morning', '09:00', '10:30', 0),
  (4, '10:30 – 12:00', 'Afternoon', '10:30', '12:00', 0),
  (5, '12:00 – 13:30', 'Afternoon', '12:00', '13:30', 0),
  (6, '13:30 – 15:00', 'Afternoon', '13:30', '15:00', 0),
  (7, '15:00 – 16:30', 'Evening', '15:00', '16:30', 0),
  (8, '16:30 – 18:00', 'Evening', '16:30', '18:00', 0),
  (9, '18:00 – 19:30', 'Night', '18:00', '19:30', 0),
  (10, '19:30 – 21:00', 'Night', '19:30', '21:00', 0),
  (11, '21:00 – 22:30', 'Night', '21:00', '22:30', 0),
  (12, '22:30 – 00:00', 'Night', '22:30', '00:00', 0),
  (13, '00:00 – 01:30', 'Night', '00:00', '01:30', 0),
  (14, '01:30 – 03:00', 'Night', '01:30', '03:00', 0),
  (15, '03:00 – 04:30', 'Night', '03:00', '04:30', 0),
  (16, '04:30 – 06:00', 'Night', '04:30', '06:00', 0);

insert into public.settings (id) values (1);

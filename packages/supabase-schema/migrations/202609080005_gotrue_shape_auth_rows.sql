-- Migration 005: write GoTrue-shaped rows when creating auth accounts via SQL.
-- Root cause found by experiment: rows inserted without created_at/updated_at,
-- confirmed_at, empty token strings and raw_app_meta_data JSON are rejected by
-- GoTrue at login ("Invalid login credentials") even with a correct bcrypt hash.
-- This replaces the account-creating functions from migration 004 with bodies
-- that mirror exactly what GoTrue itself writes for a confirmed email user.

create or replace function public.user_sign_up(p_name text, p_phone text, p_pin text)
returns public.users
language plpgsql
security definer
set search_path = public, extensions
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

  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, confirmed_at, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new,
    raw_app_meta_data, raw_user_meta_data
  ) values (
    '00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated',
    v_email, crypt(public.derived_auth_password(p_phone, p_pin), gen_salt('bf')),
    now(), now(), now(), now(),
    '', '', '',
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('full_name', trim(p_name))
  )
  returning id into v_auth_id;

  insert into public.users (id, name, phone, pin_hash)
  values (v_auth_id, trim(p_name), p_phone, crypt(p_pin, gen_salt('bf')))
  returning * into v_user;

  return v_user;
end;
$$;

create or replace function public.admin_create_admin(p_email text, p_password text)
returns public.admin_users
language plpgsql
security definer
set search_path = public, extensions
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

  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, confirmed_at, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new,
    raw_app_meta_data
  ) values (
    '00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated',
    v_email, crypt(p_password, gen_salt('bf')),
    now(), now(), now(), now(),
    '', '', '',
    '{"provider":"email","providers":["email"]}'::jsonb
  )
  returning id into v_auth_id;

  insert into public.admin_users (id, email)
  values (v_auth_id, v_email)
  returning * into v_row;

  return v_row;
end;
$$;

create or replace function public.admin_ensure_user(p_name text, p_phone text)
returns public.users
language plpgsql
security definer
set search_path = public, extensions
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

  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, confirmed_at, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new,
    raw_app_meta_data, raw_user_meta_data
  ) values (
    '00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated',
    lower(p_phone) || '@phone.brotherssportszone.com', crypt(encode(gen_random_bytes(24), 'hex'), gen_salt('bf')),
    now(), now(), now(), now(),
    '', '', '',
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('full_name', v_name)
  )
  returning id into v_auth_id;

  insert into public.users (id, name, phone, pin_hash)
  values (v_auth_id, v_name, p_phone, crypt(lpad((floor(random() * 10000))::integer::text, 4, '0'), gen_salt('bf')))
  returning * into v_user;

  return v_user;
end;
$$;

-- Repair the accounts created earlier with the incomplete shape (GoTrue could
-- not log them in). Only touches rows still in their broken state.
update auth.users
set instance_id = '00000000-0000-0000-0000-000000000000',
    created_at = coalesce(created_at, now()),
    updated_at = coalesce(updated_at, now()),
    confirmed_at = coalesce(confirmed_at, now()),
    confirmation_token = coalesce(confirmation_token, ''),
    recovery_token = coalesce(recovery_token, ''),
    email_change_token_new = coalesce(email_change_token_new, ''),
    raw_app_meta_data = '{"provider":"email","providers":["email"]}'::jsonb
where (created_at is null or updated_at is null or raw_app_meta_data is null
       or confirmation_token is null or recovery_token is null or email_change_token_new is null);

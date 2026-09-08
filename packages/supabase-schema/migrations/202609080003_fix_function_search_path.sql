-- Migration 003: fix function search_path for pgcrypto.
-- pgcrypto is installed in the `extensions` schema on this project, so every
-- function that calls crypt/gen_salt/digest/gen_random_bytes must include it
-- in search_path. Functions were created with `set search_path = public`
-- (or none) and would fail at runtime.

alter function public.generate_booking_code() set search_path = public, extensions;
alter function public.derived_auth_password(text, text) set search_path = public, extensions;
alter function public.user_sign_up(text, text, text) set search_path = public, extensions;
alter function public.admin_reset_user_pin(uuid, text) set search_path = public, extensions;
alter function public.admin_create_admin(text, text) set search_path = public, extensions;
alter function public.admin_ensure_user(text, text) set search_path = public, extensions;

-- auth_phone_exists: boolean existence check for the unified sign-in flow
-- (step 1 decides between the PIN step and the register step).
--
-- Security definer because anon has no SELECT on public.users. Returns ONLY a
-- boolean and validates the phone format first. Existence is already disclosed
-- publicly by user_sign_up's duplicate-phone error, so this adds no new class
-- of leak; it makes the check cheap for the sign-in UI instead of abusing the
-- signup error path.

create or replace function public.auth_phone_exists(p_phone text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if p_phone is null or p_phone !~ '^01[0-9]{9}$' then
    raise invalid_parameter_value
      using message = 'Enter a valid 11-digit Bangladeshi phone number (e.g. 01XXXXXXXXX).';
  end if;
  return exists (select 1 from public.users where phone = p_phone);
end;
$$;

grant execute on function public.auth_phone_exists(text) to anon, authenticated;

/** Phone + PIN auth helpers.
 *
 *  The GoTrue password is a deterministic SHA-256 of `scheme:phone:pin`
 *  (mirrored exactly by the Postgres `derived_auth_password()` function), so
 *  the PIN itself never travels as the auth credential and two users with the
 *  same PIN still get distinct auth credentials. public.users.pin_hash is a
 *  separate, independently-salted bcrypt of the raw PIN written by the
 *  user_sign_up() RPC. */

import { supabase } from "./supabase";

export const AUTH_SCHEME = "bsz-auth-v1";

export function syntheticEmail(phone: string): string {
  return `${phone}@phone.brotherssportszone.com`;
}

export async function deriveAuthCredential(phone: string, pin: string): Promise<string> {
  const bytes = new TextEncoder().encode(`${AUTH_SCHEME}:${phone}:${pin}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function signUpWithPhonePin(name: string, phone: string, pin: string) {
  return supabase.rpc("user_sign_up", { p_name: name, p_phone: phone, p_pin: pin });
}

export async function signInWithPhonePin(phone: string, pin: string) {
  const password = await deriveAuthCredential(phone, pin);
  return supabase.auth.signInWithPassword({ email: syntheticEmail(phone), password });
}

export async function signOut() {
  return supabase.auth.signOut();
}

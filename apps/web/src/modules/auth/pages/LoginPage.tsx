import { useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { AuthShell } from "../AuthShell";
import { TextField } from "../../../components/TextField";
import { GhostButtonLight } from "../../../components/GhostButton";
import { signInWithPhonePin } from "../../../lib/auth";
import { isValidPhone, normalizePhone } from "../../../lib/format";

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const next = (location.state as { next?: string } | null)?.next ?? "/dashboard";

  const [phone, setPhone] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const normalized = normalizePhone(phone);
    if (!isValidPhone(normalized)) {
      setError("Enter a valid 11-digit Bangladeshi phone number (e.g. 01XXXXXXXXX).");
      return;
    }
    if (!/^[0-9]{4}$/.test(pin)) {
      setError("Your PIN is the 4 digits you chose when signing up.");
      return;
    }
    setBusy(true);
    const { error: authError } = await signInWithPhonePin(normalized, pin);
    setBusy(false);
    if (authError) {
      setError("Wrong phone number or PIN. Please try again.");
      return;
    }
    navigate(next, { replace: true });
  }

  return (
    <AuthShell
      eyebrow="Account"
      title="Sign in"
      footer={
        <>
          New here?{" "}
          <Link to="/auth/signup" className="underline">
            Create an account
          </Link>
          <br />
          Forgot your PIN? Contact the turf to reset.
        </>
      }
    >
      <form onSubmit={onSubmit} className="flex flex-col gap-5" noValidate>
        <TextField
          label="Phone number"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          placeholder="01XXXXXXXXX"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />
        <TextField
          label="4-digit PIN"
          type="password"
          inputMode="numeric"
          autoComplete="current-pin"
          maxLength={4}
          placeholder="••••"
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
        />
        {error && <p className="caption font-bold">{error}</p>}
        <GhostButtonLight type="submit" disabled={busy} className={busy ? "opacity-60" : ""}>
          {busy ? "Signing in" : "Sign in"}
        </GhostButtonLight>
      </form>
    </AuthShell>
  );
}

import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AuthShell } from "../AuthShell";
import { TextField } from "../../../components/TextField";
import { GhostButtonLight } from "../../../components/GhostButton";
import { signInWithPhonePin, signUpWithPhonePin } from "../../../lib/auth";
import { isValidPhone, normalizePhone } from "../../../lib/format";
export default function SignUpPage() {
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [pin, setPin] = useState("");
  const [pinConfirm, setPinConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (name.trim().length < 2) {
      setError("Please enter your full name.");
      return;
    }
    const normalized = normalizePhone(phone);
    if (!isValidPhone(normalized)) {
      setError("Enter a valid 11-digit Bangladeshi phone number (e.g. 01XXXXXXXXX).");
      return;
    }
    if (!/^[0-9]{4}$/.test(pin)) {
      setError("PIN must be exactly 4 digits.");
      return;
    }
    if (pin !== pinConfirm) {
      setError("The two PINs do not match.");
      return;
    }
    setBusy(true);
    const { error: rpcError } = await signUpWithPhonePin(name.trim(), normalized, pin);
    if (rpcError) {
      setBusy(false);
      setError(rpcError.message);
      return;
    }
    // The RPC created the auth account; establish the session immediately.
    const { error: authError } = await signInWithPhonePin(normalized, pin);
    setBusy(false);
    if (authError) {
      setError("Account created. Please sign in to continue.");
      navigate("/auth/login", { replace: true });
      return;
    }
    navigate("/dashboard", { replace: true });
  }

  return (
    <AuthShell
      eyebrow="Account"
      title="Create account"
      footer={
        <>
          Already registered?{" "}
          <Link to="/auth/login" className="underline">
            Sign in
          </Link>
          <br />
          Remember your PIN — there is no self-service reset. Contact the turf if you forget it.
        </>
      }
    >
      <form onSubmit={onSubmit} className="flex flex-col gap-5" noValidate>
        <TextField
          label="Full name"
          type="text"
          autoComplete="name"
          placeholder="Your name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <TextField
          label="Phone number"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          placeholder="01XXXXXXXXX"
          hint="Used as your login ID. Must be unique."
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />
        <TextField
          label="4-digit PIN"
          type="password"
          inputMode="numeric"
          autoComplete="new-pin"
          maxLength={4}
          placeholder="••••"
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
        />
        <TextField
          label="Confirm PIN"
          type="password"
          inputMode="numeric"
          autoComplete="new-pin"
          maxLength={4}
          placeholder="••••"
          value={pinConfirm}
          onChange={(e) => setPinConfirm(e.target.value.replace(/\D/g, ""))}
        />
        {error && <p className="caption font-bold">{error}</p>}
        <GhostButtonLight type="submit" disabled={busy} className={busy ? "opacity-60" : ""}>
          {busy ? "Creating account" : "Create account"}
        </GhostButtonLight>
      </form>
    </AuthShell>
  );
}

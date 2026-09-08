import { useState, type FormEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { AuthShell } from "../AuthShell";
import { TextField } from "../../../components/TextField";
import { GhostButtonLight } from "../../../components/GhostButton";
import { phoneExists, signInWithPhonePin, signUpWithPhonePin } from "../../../lib/auth";
import { isValidPhone, normalizePhone } from "../../../lib/format";

/** Unified sign-in flow. Step 1 asks for the phone number only; the account
 *  check picks the next step: registered phones go to the PIN step, unknown
 *  numbers go to account creation with the phone carried over. */
export default function AuthFlowPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const next = (location.state as { next?: string } | null)?.next ?? "/dashboard";

  const [step, setStep] = useState<"phone" | "pin" | "register">("phone");
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [pin, setPin] = useState("");
  const [pinConfirm, setPinConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function backToPhone() {
    setStep("phone");
    setPin("");
    setPinConfirm("");
    setError(null);
  }

  async function submitPhone(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const normalized = normalizePhone(phone);
    if (!isValidPhone(normalized)) {
      setError("Enter a valid 11-digit Bangladeshi phone number (e.g. 01XXXXXXXXX).");
      return;
    }
    setPhone(normalized);
    setBusy(true);
    const { data, error: rpcError } = await phoneExists(normalized);
    setBusy(false);
    if (rpcError) {
      setError("Something went wrong. Please try again.");
      return;
    }
    setStep(data ? "pin" : "register");
  }

  async function submitPin(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!/^[0-9]{4}$/.test(pin)) {
      setError("Your PIN is the 4 digits you chose when signing up.");
      return;
    }
    setBusy(true);
    const { error: authError } = await signInWithPhonePin(phone, pin);
    setBusy(false);
    if (authError) {
      setError("Wrong phone number or PIN. Please try again.");
      return;
    }
    navigate(next, { replace: true });
  }

  async function submitRegister(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (name.trim().length < 2) {
      setError("Please enter your full name.");
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
    const { error: rpcError } = await signUpWithPhonePin(name.trim(), phone, pin);
    if (rpcError) {
      setBusy(false);
      // The account was created between the step-1 check and this submit;
      // fall through to the PIN step instead of dead-ending the user.
      if (rpcError.message.toLowerCase().includes("already exists")) {
        setStep("pin");
        setPin("");
        setPinConfirm("");
        setError(rpcError.message);
        return;
      }
      setError(rpcError.message);
      return;
    }
    // The RPC created the auth account; establish the session immediately.
    const { error: authError } = await signInWithPhonePin(phone, pin);
    setBusy(false);
    if (authError) {
      setStep("pin");
      setPin("");
      setPinConfirm("");
      setError("Account created. Please enter your PIN to continue.");
      return;
    }
    navigate(next, { replace: true });
  }

  const backLink = (
    <button type="button" onClick={backToPhone} className="underline">
      Use a different number
    </button>
  );

  return (
    <AuthShell
      eyebrow="Account"
      title={step === "register" ? "Create account" : step === "pin" ? "Sign in" : "Sign in or create account"}
      footer={
        step === "pin" ? (
          <>
            {backLink}
            <br />
            Forgot your PIN? Contact the turf to reset.
          </>
        ) : step === "register" ? (
          <>
            {backLink}
            <br />
            Remember your PIN. There is no self-service reset; contact the turf if you forget it.
          </>
        ) : (
          <>New numbers create an account in the next step.</>
        )
      }
    >
      {step === "phone" && (
        <form onSubmit={submitPhone} className="flex flex-col gap-5" noValidate>
          <TextField
            label="Phone number"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="01XXXXXXXXX"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
          {error && <p className="caption font-bold">{error}</p>}
          <GhostButtonLight type="submit" disabled={busy} className={busy ? "opacity-60" : ""}>
            {busy ? "Checking" : "Continue"}
          </GhostButtonLight>
        </form>
      )}

      {step === "pin" && (
        <form onSubmit={submitPin} className="flex flex-col gap-5" noValidate>
          <p className="caption text-ink-mute">Signing in with {phone}</p>
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
      )}

      {step === "register" && (
        <form onSubmit={submitRegister} className="flex flex-col gap-5" noValidate>
          <p className="caption text-ink-mute">Creating an account for {phone}</p>
          <TextField
            label="Full name"
            type="text"
            autoComplete="name"
            placeholder="Your name"
            value={name}
            onChange={(e) => setName(e.target.value)}
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
      )}
    </AuthShell>
  );
}

import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { AuthShell } from "../../../auth/AuthShell";
import { TextField } from "../../../../components/TextField";
import { GhostButtonLight } from "../../../../components/GhostButton";
import { supabase } from "../../../../lib/supabase";

export default function AdminLoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const { data, error: authError } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });
    if (authError) {
      setBusy(false);
      setError("Wrong email or password.");
      return;
    }
    // Verify admin status before entering the panel.
    const { data: admin } = await supabase
      .from("admin_users")
      .select("id")
      .eq("id", data.user.id)
      .eq("is_active", true)
      .maybeSingle();
    if (!admin) {
      await supabase.auth.signOut();
      setBusy(false);
      setError("This account does not have admin access.");
      return;
    }
    setBusy(false);
    navigate("/management", { replace: true });
  }

  return (
    <AuthShell eyebrow="Management" title="Admin sign in" footer={<span>Authorized staff only.</span>}>
      <form onSubmit={onSubmit} className="flex flex-col gap-5" noValidate>
        <TextField
          label="Email"
          type="email"
          autoComplete="email"
          placeholder="admin@brotherssportszone.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <TextField
          label="Password"
          type="password"
          autoComplete="current-password"
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {error && <p className="caption font-bold">{error}</p>}
        <GhostButtonLight type="submit" disabled={busy} className={busy ? "opacity-60" : ""}>
          {busy ? "Signing in" : "Sign in"}
        </GhostButtonLight>
      </form>
    </AuthShell>
  );
}

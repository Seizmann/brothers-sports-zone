import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useSession } from "../lib/session";

function FullScreenWait({ label }: { label: string }) {
  return (
    <main className="flex min-h-screen items-center justify-center">
      <p className="micro-cap text-white/60">{label}</p>
    </main>
  );
}

/** Guard for user-facing protected routes. Redirects to login with a `next`. */
export function RequireUser() {
  const { session, loading } = useSession();
  const location = useLocation();
  if (loading) return <FullScreenWait label="Loading" />;
  if (!session) {
    return <Navigate to="/auth/login" replace state={{ next: location.pathname + location.search }} />;
  }
  return <Outlet />;
}

/** Guard for /management/* — client-side half; RLS is the server-side half. */
export function RequireAdmin() {
  const { session, isAdmin, loading, detailsLoading } = useSession();
  if (loading || (session && detailsLoading)) return <FullScreenWait label="Checking access" />;
  if (!session || !isAdmin) return <Navigate to="/management/login" replace />;
  return <Outlet />;
}

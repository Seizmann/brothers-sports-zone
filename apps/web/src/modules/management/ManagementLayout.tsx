import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useSession } from "../../lib/session";

const tabs = [
  { to: "/management", label: "Overview", end: true },
  { to: "/management/bookings", label: "Bookings" },
  { to: "/management/bookings/new", label: "New walk-in" },
  { to: "/management/slots", label: "Slots" },
  { to: "/management/blackouts", label: "Blackouts" },
  { to: "/management/coupons", label: "Coupons" },
  { to: "/management/admins", label: "Admins" },
  { to: "/management/users", label: "Users" },
  { to: "/management/analytics", label: "Analytics" },
  { to: "/management/settings", label: "Settings" },
];

/** Chrome for all /management pages. Access is guarded by RequireAdmin. */
export function ManagementLayout() {
  const { signOut } = useSession();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-canvas-night text-white">
      <header className="border-b border-hairline-on-dark">
        <div className="flex items-center justify-between px-6 py-5 sm:px-10">
          <NavLink to="/management" className="button-cap">
            BSZ Management
          </NavLink>
          <button
            type="button"
            onClick={() =>
              void signOut().then(() => navigate("/management/login", { replace: true }))
            }
            className="micro-cap text-white/60 underline hover:text-white"
          >
            Log out
          </button>
        </div>
        <nav className="flex gap-5 overflow-x-auto px-6 pb-4 sm:px-10" aria-label="Management">
          {tabs.map((t) => (
            <NavLink
              key={t.to}
              to={t.to}
              end={t.end}
              className={({ isActive }) =>
                `micro-cap shrink-0 border-b pb-1 ${isActive ? "border-white text-white" : "border-transparent text-white/50 hover:text-white"}`
              }
            >
              {t.label}
            </NavLink>
          ))}
        </nav>
      </header>
      <main className="mx-auto w-full max-w-7xl px-6 py-10 sm:px-10 lg:px-16">
        <Outlet />
      </main>
    </div>
  );
}

import { useState } from "react";
import { Link, NavLink } from "react-router-dom";
import { useSession } from "../lib/session";

const links = [
  { to: "/gallery", label: "Gallery" },
  { to: "/contact", label: "Contact" },
];

/** Fixed top nav overlaid on photography — transparent, white on image.
 *  Collapses to a full-screen dark menu below 768px. */
export function NavBar() {
  const { session, profile, isAdmin, signOut } = useSession();
  const [open, setOpen] = useState(false);

  const close = () => setOpen(false);

  return (
    <header className="fixed inset-x-0 top-0 z-50">
      <div className="flex items-center justify-between px-6 py-6 md:px-10">
        <Link to="/" className="button-cap text-white" onClick={close}>
          Brothers Sports Zone
        </Link>

        <nav className="hidden items-center gap-8 md:flex" aria-label="Primary">
          {links.map((l) => (
            <NavLink key={l.to} to={l.to} className="micro-cap text-white/80 hover:text-white">
              {l.label}
            </NavLink>
          ))}
          {session ? (
            <>
              <NavLink to="/dashboard" className="micro-cap text-white/80 hover:text-white">
                {isAdmin ? "Management" : profile?.name ?? "Dashboard"}
              </NavLink>
              <button type="button" onClick={() => void signOut()} className="micro-cap text-white/80 hover:text-white">
                Log out
              </button>
            </>
          ) : (
            <NavLink to="/auth/login" className="micro-cap text-white/80 hover:text-white">
              Sign in
            </NavLink>
          )}
          <Link to="/book" className="ghost-button button-cap !min-h-[44px] !py-3 text-white">
            Book a slot
          </Link>
        </nav>

        <button
          type="button"
          className="flex h-11 w-11 flex-col items-end justify-center gap-[6px] md:hidden"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? (
            <span className="button-cap text-white">Close</span>
          ) : (
            <>
              <span className="block h-px w-8 bg-white" />
              <span className="block h-px w-8 bg-white" />
            </>
          )}
        </button>
      </div>

      {open && (
        <div className="fixed inset-0 -z-10 flex min-h-screen flex-col justify-end bg-canvas-night p-6 pb-12">
          <nav className="flex flex-col gap-8" aria-label="Mobile">
            {links.map((l) => (
              <NavLink key={l.to} to={l.to} className="display-lg text-white" onClick={close}>
                {l.label}
              </NavLink>
            ))}
            {session ? (
              <>
                <NavLink to={isAdmin ? "/management" : "/dashboard"} className="display-lg text-white" onClick={close}>
                  {isAdmin ? "Management" : "Dashboard"}
                </NavLink>
                <button
                  type="button"
                  onClick={() => {
                    close();
                    void signOut();
                  }}
                  className="display-lg text-left text-white"
                >
                  Log out
                </button>
              </>
            ) : (
              <NavLink to="/auth/login" className="display-lg text-white" onClick={close}>
                Sign in
              </NavLink>
            )}
            <Link to="/book" className="ghost-button button-cap mt-6 self-start text-white" onClick={close}>
              Book a slot
            </Link>
          </nav>
        </div>
      )}
    </header>
  );
}

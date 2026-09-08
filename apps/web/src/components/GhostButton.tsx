import { Link } from "react-router-dom";
import type { ButtonHTMLAttributes, ReactNode } from "react";

interface GhostButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  to?: string;
  children: ReactNode;
}

/** Ghost outlined pill — the only button style on dark marketing surfaces.
 *  Renders a react-router Link when `to` is given, else a native button. */
export function GhostButton({ to, children, className = "", type = "button", ...rest }: GhostButtonProps) {
  const classes = `ghost-button button-cap inline-flex items-center justify-center ${className}`.trim();
  if (to) {
    return (
      <Link to={to} className={classes}>
        {children}
      </Link>
    );
  }
  return (
    <button type={type} className={classes} {...rest}>
      {children}
    </button>
  );
}

/** Ghost pill for light (white form) surfaces. */
export function GhostButtonLight({ to, children, className = "", type = "button", ...rest }: GhostButtonProps) {
  const classes = `ghost-button-light button-cap inline-flex items-center justify-center text-black ${className}`.trim();
  if (to) {
    return (
      <Link to={to} className={classes}>
        {children}
      </Link>
    );
  }
  return (
    <button type={type} className={classes} {...rest}>
      {children}
    </button>
  );
}

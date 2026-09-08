import type { ReactNode } from "react";
import { Link } from "react-router-dom";

/** Dark canvas with the form on the only white surface in the system. */
export function AuthShell({
  eyebrow,
  title,
  children,
  footer,
}: {
  eyebrow: string;
  title: string;
  children: ReactNode;
  footer: ReactNode;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-canvas-night px-4 py-24">
      <div className="w-full max-w-md rounded-md bg-canvas-light p-6 text-black sm:p-8">
        <p className="eyebrow mb-6 text-ink-mute">{eyebrow}</p>
        <h1 className="display-lg mb-8 text-black">{title}</h1>
        {children}
        <div className="caption mt-8 text-ink-mute">{footer}</div>
        <p className="caption mt-4 text-ink-mute">
          <Link to="/" className="underline">
            Back to site
          </Link>
        </p>
      </div>
    </main>
  );
}

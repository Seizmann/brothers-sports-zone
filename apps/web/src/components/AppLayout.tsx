import { Outlet } from "react-router-dom";
import { NavBar } from "./NavBar";
import { FooterDark } from "./FooterDark";

/** Layout for authenticated user pages (/book, /dashboard). */
export function AppLayout() {
  return (
    <div className="min-h-screen bg-canvas-night text-white">
      <NavBar />
      <Outlet />
      <FooterDark />
    </div>
  );
}

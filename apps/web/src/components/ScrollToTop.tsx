import { useEffect } from "react";
import { useLocation, useNavigationType } from "react-router-dom";

/** Resets window scroll on client-side navigation. Mounted once inside the
 *  Router, above the route tree.
 *
 *  - PUSH/REPLACE navigations (link clicks) scroll to the top.
 *  - POP navigations (browser back/forward) are left to the browser's native
 *    scroll restoration so history navigation keeps its position.
 *  - Hash-only changes are left to native anchor behavior (no in-page
 *    anchors exist today, but this keeps future ones safe). */
export function ScrollToTop() {
  const { pathname, hash } = useLocation();
  const navigationType = useNavigationType();

  useEffect(() => {
    if (hash) return;
    if (navigationType === "POP") return;
    window.scrollTo(0, 0);
  }, [pathname, hash, navigationType]);

  return null;
}

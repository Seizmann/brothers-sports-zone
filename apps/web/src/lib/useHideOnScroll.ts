import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";

/** SpaceX-style header visibility: hide while scrolling down, show on any
 *  scroll up, always visible at the top of the page. While `enabled` is false
 *  (e.g. the mobile menu is open) the listener pauses and the value freezes —
 *  callers must also guard with their own condition so an open menu can never
 *  end up hidden. */
export function useHideOnScroll(enabled: boolean): boolean {
  const [hidden, setHidden] = useState(false);
  const location = useLocation();

  // Navigation lands at the top (ScrollToTop) — the header comes back.
  useEffect(() => {
    setHidden(false);
  }, [location.key]);

  useEffect(() => {
    if (!enabled) return;
    let lastY = window.scrollY;
    let raf = 0;
    let ticking = false;
    const update = () => {
      ticking = false;
      const y = window.scrollY;
      // Top of page (small threshold absorbs iOS rubber-banding) and any
      // scroll up show the header; scrolling down hides it.
      if (y <= 4 || y < lastY) setHidden(false);
      else if (y > lastY) setHidden(true);
      lastY = y;
    };
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      raf = window.requestAnimationFrame(update);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.cancelAnimationFrame(raf);
    };
  }, [enabled]);

  return hidden;
}

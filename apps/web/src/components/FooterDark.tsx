import { Link } from "react-router-dom";

/** Site-wide dark footer. */
export function FooterDark() {
  return (
    <footer className="print-hide bg-canvas-night text-white">
      <div className="hairline-dark px-6 py-12 md:px-10">
        <div className="flex flex-col gap-10 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="button-cap">Brothers Sports Zone</p>
            <p className="caption mt-3 max-w-xs text-white/60">
              Single football turf in Faridpur, Dhaka, Bangladesh. Book your slot, pay the advance, play under the
              lights.
            </p>
          </div>
          <nav className="flex gap-16" aria-label="Footer">
            <div className="flex flex-col gap-1">
              <p className="micro-cap text-white/50">Site</p>
              <Link to="/" className="micro-cap text-white/80 hover:text-white">Home</Link>
              <Link to="/gallery" className="micro-cap text-white/80 hover:text-white">Gallery</Link>
              <Link to="/contact" className="micro-cap text-white/80 hover:text-white">Contact</Link>
            </div>
            <div className="flex flex-col gap-1">
              <p className="micro-cap text-white/50">Legal</p>
              <Link to="/terms" className="micro-cap text-white/80 hover:text-white">Terms</Link>
              <Link to="/privacy" className="micro-cap text-white/80 hover:text-white">Privacy</Link>
              <Link to="/book" className="micro-cap text-white/80 hover:text-white">Book a slot</Link>
            </div>
          </nav>
        </div>
        <p className="caption mt-12 text-white/40">
          © {new Date().getFullYear()}{" "}
          <a
            href="https://spritexai.pro.bd"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-white/70"
          >
            SpritexAI
          </a>
          . All rights reserved.
        </p>
      </div>
    </footer>
  );
}

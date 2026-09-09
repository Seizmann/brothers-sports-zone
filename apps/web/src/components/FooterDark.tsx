import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { CONTACT_DEFAULTS, SOCIAL_DEFAULTS } from "../lib/site";
import { supabase } from "../lib/supabase";
import { normalizePhone } from "../lib/format";
import type { Settings } from "@brothers-sports-zone/shared-types";

type FooterInfo = Pick<typeof CONTACT_DEFAULTS, "phone" | "email" | "location"> & typeof SOCIAL_DEFAULTS;

/** Contact info and social links come from the settings singleton (edited in
 *  /management/settings), the same source the /contact page reads. Defaults
 *  render immediately — that is what the prerendered HTML bakes — then the
 *  client fetch overwrites them with the live DB values. On fetch failure
 *  the defaults simply stay. */
export function FooterDark() {
  const [info, setInfo] = useState<FooterInfo>({
    phone: CONTACT_DEFAULTS.phone,
    email: CONTACT_DEFAULTS.email,
    location: CONTACT_DEFAULTS.location,
    facebook: SOCIAL_DEFAULTS.facebook,
    instagram: SOCIAL_DEFAULTS.instagram,
  });

  useEffect(() => {
    void (async () => {
      const { data } = await supabase
        .from("settings")
        .select("contact_phone, contact_email, contact_location, facebook_url, instagram_url")
        .eq("id", 1)
        .maybeSingle();
      if (data) {
        const row = data as Pick<
          Settings,
          "contact_phone" | "contact_email" | "contact_location" | "facebook_url" | "instagram_url"
        >;
        setInfo({
          phone: row.contact_phone,
          email: row.contact_email,
          location: row.contact_location,
          facebook: row.facebook_url,
          instagram: row.instagram_url,
        });
      }
    })();
  }, []);

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
          <div className="flex flex-wrap gap-x-16 gap-y-10">
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
            <div className="flex flex-col gap-1">
              <p className="micro-cap text-white/50">Contact</p>
              <a href={`tel:${normalizePhone(info.phone)}`} className="micro-cap text-white/80 hover:text-white">
                {info.phone}
              </a>
              <a href={`mailto:${info.email}`} className="micro-cap text-white/80 hover:text-white">
                {info.email}
              </a>
              <p className="micro-cap max-w-44 text-white/80">{info.location}</p>
            </div>
            <div className="flex flex-col gap-1">
              <p className="micro-cap text-white/50">Follow</p>
              <a
                href={info.facebook}
                target="_blank"
                rel="noopener noreferrer"
                className="micro-cap text-white/80 hover:text-white"
              >
                Facebook
              </a>
              <a
                href={info.instagram}
                target="_blank"
                rel="noopener noreferrer"
                className="micro-cap text-white/80 hover:text-white"
              >
                Instagram
              </a>
            </div>
          </div>
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

import { useEffect, useState } from "react";
import { usePageMeta, PUBLIC_PAGES } from "../lib/seo";
import { CONTACT_DEFAULTS } from "../lib/site";
import { supabase } from "../lib/supabase";
import { normalizePhone } from "../lib/format";
import type { Settings } from "@brothers-sports-zone/shared-types";

const contact = PUBLIC_PAGES[2];

type ContactInfo = typeof CONTACT_DEFAULTS;

/** Contact info comes from the settings singleton (edited in
 *  /management/settings). Defaults render immediately — that is what the
 *  prerendered HTML bakes — then the client fetch overwrites them with the
 *  live DB values. On fetch failure the defaults simply stay. */
export default function ContactPage() {
  usePageMeta(contact);
  const [info, setInfo] = useState<ContactInfo>(CONTACT_DEFAULTS);

  useEffect(() => {
    void (async () => {
      const { data } = await supabase
        .from("settings")
        .select("contact_phone, contact_email, contact_location, map_lat, map_lng")
        .eq("id", 1)
        .maybeSingle();
      if (data) {
        const row = data as Pick<
          Settings,
          "contact_phone" | "contact_email" | "contact_location" | "map_lat" | "map_lng"
        >;
        setInfo({
          phone: row.contact_phone,
          email: row.contact_email,
          location: row.contact_location,
          mapLat: row.map_lat,
          mapLng: row.map_lng,
        });
      }
    })();
  }, []);

  return (
    <>
      <section className="px-6 pb-12 pt-32 sm:px-10 sm:pt-40 lg:px-16">
        <p className="eyebrow mb-6 text-white/60">Find us</p>
        <h1 className="display-xl">Contact &amp; location</h1>
      </section>

      <section className="grid grid-cols-1 gap-2 px-2 md:grid-cols-2">
        <div className="px-6 py-10 sm:px-10 lg:px-16">
          <p className="micro-cap text-white/50">Address</p>
          <p className="mt-3 text-base leading-7 tracking-[.32px] text-white">{info.location}</p>
          <p className="micro-cap mt-10 text-white/50">Phone</p>
          <p className="mt-3 text-base leading-7 tracking-[.32px] text-white">
            <a href={`tel:${normalizePhone(info.phone)}`}>{info.phone}</a>
          </p>
          <p className="micro-cap mt-10 text-white/50">Email</p>
          <p className="mt-3 text-base leading-7 tracking-[.32px] text-white">
            <a href={`mailto:${info.email}`}>{info.email}</a>
          </p>
          <p className="micro-cap mt-10 text-white/50">Booking</p>
          <p className="mt-3 max-w-md text-base leading-7 tracking-[.32px] text-white/70">
            Slots are booked online. For PIN resets and walk-in bookings, call or visit the turf.
          </p>
        </div>
        <iframe
          title="Brothers Sports Zone location map"
          src={`https://www.google.com/maps?q=${info.mapLat},${info.mapLng}&output=embed`}
          className="h-64 w-full border border-hairline-on-dark md:h-full"
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          allowFullScreen
        />
      </section>
    </>
  );
}

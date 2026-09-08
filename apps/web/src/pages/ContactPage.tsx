import { usePageMeta, PUBLIC_PAGES } from "../lib/seo";
import { SITE } from "../lib/site";

const contact = PUBLIC_PAGES[2];

export default function ContactPage() {
  usePageMeta(contact);
  return (
    <>
      <section className="px-6 pb-12 pt-32 sm:px-10 sm:pt-40 lg:px-16">
        <p className="eyebrow mb-6 text-white/60">Find us</p>
        <h1 className="display-xl">Contact &amp; location</h1>
      </section>

      <section className="grid grid-cols-1 gap-2 px-2 md:grid-cols-2">
        <div className="px-6 py-10 sm:px-10 lg:px-16">
          <p className="micro-cap text-white/50">Address</p>
          <p className="mt-3 text-base leading-7 tracking-[.32px] text-white">{SITE.address}</p>
          <p className="micro-cap mt-10 text-white/50">Phone</p>
          <p className="mt-3 text-base leading-7 tracking-[.32px] text-white">{SITE.phone}</p>
          <p className="micro-cap mt-10 text-white/50">Booking</p>
          <p className="mt-3 max-w-md text-base leading-7 tracking-[.32px] text-white/70">
            Slots are booked online. For PIN resets and walk-in bookings, call or visit the turf.
          </p>
        </div>
        <img
          src="/docs/map-placeholder.webp"
          alt="Map showing the location of the turf"
          loading="lazy"
          className="h-64 w-full object-cover md:h-full"
        />
      </section>

      <section className="px-2 pb-2 pt-2">
        <iframe
          title="Brothers Sports Zone location map"
          src={SITE.mapsEmbed}
          className="h-[420px] w-full border border-hairline-on-dark"
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          allowFullScreen
        />
      </section>
    </>
  );
}

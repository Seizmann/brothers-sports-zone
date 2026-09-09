import { useEffect, useState } from "react";
import type { Slot } from "@brothers-sports-zone/shared-types";
import { GhostButton } from "../components/GhostButton";
import { usePageMeta, PUBLIC_PAGES } from "../lib/seo";
import { bdt, formatSlotRange } from "../lib/format";
import { fetchSlots } from "../modules/booking/lib/bookingData";

const home = PUBLIC_PAGES[0];

const PERIODS = ["Morning", "Afternoon", "Evening", "Night"] as const;

/** Live slot list from the slots table, grouped into period accordions.
 *  One group open at a time; while loading or on fetch failure the band
 *  keeps its heading and footnote only. */
function SlotOverview() {
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetchSlots()
      .then((rows) => {
        if (active) setSlots(rows);
      })
      .catch(() => {
        if (active) setSlots(null);
      });
    return () => {
      active = false;
    };
  }, []);

  if (!slots) return null;

  const groups = PERIODS.map((period) => ({
    period,
    slots: slots.filter((s) => s.period === period),
  })).filter((g) => g.slots.length > 0);

  return (
    <div className="mt-12 border-t border-hairline-on-dark">
      {groups.map(({ period, slots: groupSlots }) => {
        const expanded = open === period;
        const headerId = `slots-${period.toLowerCase()}-header`;
        const panelId = `slots-${period.toLowerCase()}-panel`;
        return (
          <div key={period} className="border-b border-hairline-on-dark">
            <button
              type="button"
              id={headerId}
              aria-expanded={expanded}
              aria-controls={panelId}
              onClick={() => setOpen(expanded ? null : period)}
              className="flex min-h-[56px] w-full items-center justify-between gap-4 py-4 text-left transition-colors hover:bg-white/5"
            >
              <span className="button-cap">{period}</span>
              <span className="micro-cap flex items-center gap-3 text-white/50">
                {groupSlots.length} slots
                <svg
                  aria-hidden="true"
                  viewBox="0 0 16 16"
                  className={`h-3 w-3 transition-transform ${expanded ? "rotate-180" : ""}`}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                >
                  <path d="M3 6l5 5 5-5" />
                </svg>
              </span>
            </button>
            {expanded && (
              <ul id={panelId} role="region" aria-labelledby={headerId} className="pb-2">
                {groupSlots.map((slot) => (
                  <li
                    key={slot.id}
                    className="flex items-center justify-between gap-4 border-t border-hairline-on-dark py-3"
                  >
                    <span className="caption text-white/80">{formatSlotRange(slot.label)}</span>
                    <span className="caption font-bold">{slot.price > 0 ? bdt(slot.price) : "price TBD"}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function HomePage() {
  usePageMeta(home);
  return (
    <>
      {/* Hero — full-bleed photography, type directly on the graded image */}
      <section className="relative flex min-h-screen items-end">
        <img
          src="/docs/hero-turf-night.webp"
          alt="Brothers Sports Zone football turf under floodlights at night"
          className="img-locked absolute inset-0 h-full w-full object-cover"
          fetchPriority="high"
          draggable={false}
        />
        <div className="relative p-6 pb-16 sm:p-10 sm:pb-20 lg:p-16 lg:pb-24">
          <p className="eyebrow mb-6 text-white">Faridpur · Dhaka · Bangladesh</p>
          <h1 className="display-xxl max-w-4xl">Play under the lights</h1>
          <p className="mt-8 max-w-xl text-base leading-7 tracking-[.32px] text-white/80">
            One turf. Sixteen slots a day, morning to late night. Pick your slot, book it online,
            and your game is on.
          </p>
          <GhostButton to="/book" className="mt-10">
            Book a slot
          </GhostButton>
        </div>
      </section>

      {/* About band */}
      <section className="relative flex min-h-[80vh] items-end">
        <img
          src="/docs/turf-aerial-day.webp"
          alt="Aerial view of the football turf"
          className="img-locked absolute inset-0 h-full w-full object-cover"
          loading="lazy"
          draggable={false}
        />
        <div className="relative p-6 pb-16 sm:p-10 sm:pb-20 lg:p-16 lg:pb-24">
          <p className="eyebrow mb-6 text-white">The turf</p>
          <h2 className="display-xl max-w-3xl">Built for the game</h2>
          <p className="mt-8 max-w-xl text-base leading-7 tracking-[.32px] text-white/80">
            Brothers Sports Zone is a single football turf in Faridpur, Dhaka. Book one slot at a time or take the
            whole evening. The calendar shows live availability for every slot.
          </p>
        </div>
      </section>

      {/* Slot overview band — live per-slot times and prices, expandable */}
      <section className="bg-canvas-night px-6 py-20 sm:px-10 lg:px-16 lg:py-28">
        <p className="eyebrow mb-6 text-white/60">Daily schedule</p>
        <h2 className="display-lg">Sixteen slots. One calendar.</h2>
        <SlotOverview />
        <p className="caption mt-8 max-w-xl text-white/60">
          The turf sets prices per slot. Selecting a slot holds it for five minutes while you complete payment.
        </p>
      </section>

      {/* CTA band */}
      <section className="relative flex min-h-[70vh] items-end">
        <img
          src="/docs/match-action-night.webp"
          alt="Players contesting the ball at night"
          className="img-locked absolute inset-0 h-full w-full object-cover"
          loading="lazy"
          draggable={false}
        />
        <div className="relative p-6 pb-16 sm:p-10 sm:pb-20 lg:p-16 lg:pb-24">
          <p className="eyebrow mb-6 text-white">Booking open</p>
          <h2 className="display-xl max-w-3xl">Your slot is waiting</h2>
          <GhostButton to="/book" className="mt-10">
            Book a slot
          </GhostButton>
        </div>
      </section>
    </>
  );
}

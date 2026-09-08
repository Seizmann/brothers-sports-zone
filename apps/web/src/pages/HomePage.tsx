import { GhostButton } from "../components/GhostButton";
import { usePageMeta, PUBLIC_PAGES } from "../lib/seo";

const home = PUBLIC_PAGES[0];

const periods = [
  { name: "Morning", window: "06:00 – 10:30", note: "3 slots" },
  { name: "Afternoon", window: "10:30 – 15:00", note: "3 slots" },
  { name: "Evening", window: "15:00 – 18:00", note: "2 slots" },
  { name: "Night", window: "18:00 – 06:00", note: "8 slots" },
];

export default function HomePage() {
  usePageMeta(home);
  return (
    <>
      {/* Hero — full-bleed photography, type directly on the graded image */}
      <section className="relative flex min-h-screen items-end">
        <img
          src="/docs/hero-turf-night.webp"
          alt="Brothers Sports Zone football turf under floodlights at night"
          className="absolute inset-0 h-full w-full object-cover"
          fetchPriority="high"
        />
        <div className="relative p-6 pb-16 sm:p-10 sm:pb-20 lg:p-16 lg:pb-24">
          <p className="eyebrow mb-6 text-white">Faridpur · Dhaka · Bangladesh</p>
          <h1 className="display-xxl max-w-4xl">Play under the lights</h1>
          <p className="mt-8 max-w-xl text-base leading-7 tracking-[.32px] text-white/80">
            One turf. Sixteen slots a day, morning to late night. Pick your slot, send the advance by bKash or Nagad,
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
          className="absolute inset-0 h-full w-full object-cover"
          loading="lazy"
        />
        <div className="relative p-6 pb-16 sm:p-10 sm:pb-20 lg:p-16 lg:pb-24">
          <p className="eyebrow mb-6 text-white">The turf</p>
          <h2 className="display-xl max-w-3xl">Built for the game</h2>
          <p className="mt-8 max-w-xl text-base leading-7 tracking-[.32px] text-white/80">
            Brothers Sports Zone is a single football turf in Faridpur, Dhaka. Book solo slots or lock the whole
            evening — the calendar shows real-time availability across every slot.
          </p>
        </div>
      </section>

      {/* Slot overview band */}
      <section className="bg-canvas-night px-6 py-20 sm:px-10 lg:px-16 lg:py-28">
        <p className="eyebrow mb-6 text-white/60">Daily schedule</p>
        <h2 className="display-lg">Sixteen slots. One calendar.</h2>
        <div className="mt-12 grid grid-cols-1 border-t border-hairline-on-dark sm:grid-cols-2 lg:grid-cols-4">
          {periods.map((p) => (
            <div
              key={p.name}
              className="border-b border-r border-hairline-on-dark p-6 first:border-l sm:[&:nth-child(2n)]:border-l-0 lg:[&:nth-child(2n)]:border-l lg:[&:nth-child(4n)]:border-r-0"
            >
              <p className="button-cap">{p.name}</p>
              <p className="caption mt-4 text-white/70">{p.window}</p>
              <p className="micro-cap mt-1 text-white/50">{p.note}</p>
            </div>
          ))}
        </div>
        <p className="caption mt-8 max-w-xl text-white/60">
          Prices are set per slot by the turf. Selecting a slot holds it for five minutes while you complete payment.
        </p>
      </section>

      {/* CTA band */}
      <section className="relative flex min-h-[70vh] items-end">
        <img
          src="/docs/match-action-night.webp"
          alt="Players contesting the ball at night"
          className="absolute inset-0 h-full w-full object-cover"
          loading="lazy"
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

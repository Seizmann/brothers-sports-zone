import { usePageMeta, PUBLIC_PAGES } from "../lib/seo";

const gallery = PUBLIC_PAGES[1];

const photos = [
  { src: "/docs/match-action-night.webp", alt: "Night match action on the turf" },
  { src: "/docs/turf-aerial-day.webp", alt: "Aerial view of the football turf" },
  { src: "/docs/team-play-day.webp", alt: "Teams playing during the day" },
  { src: "/docs/floodlights-detail.webp", alt: "Floodlight towers over the turf" },
  { src: "/docs/goal-net-detail.webp", alt: "Goal net detail" },
  { src: "/docs/hero-turf-night.webp", alt: "The turf under floodlights at night" },
];

export default function GalleryPage() {
  usePageMeta(gallery);
  return (
    <>
      <section className="px-6 pb-12 pt-32 sm:px-10 sm:pt-40 lg:px-16">
        <p className="eyebrow mb-6 text-white/60">Brothers Sports Zone</p>
        <h1 className="display-xl">Gallery</h1>
      </section>
      <section className="grid grid-cols-1 gap-2 px-2 pb-2 sm:grid-cols-2 md:grid-cols-3">
        {photos.map((p) => (
          <img key={p.src} src={p.src} alt={p.alt} loading="lazy" className="aspect-[4/3] w-full object-cover" />
        ))}
      </section>
    </>
  );
}

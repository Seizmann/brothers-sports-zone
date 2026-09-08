import { usePageMeta, PUBLIC_PAGES } from "../lib/seo";
import { SITE } from "../lib/site";

const privacy = PUBLIC_PAGES[4];

const sections = [
  {
    heading: "What we collect",
    body: "To manage bookings we store your name, phone number, and a securely hashed 4-digit PIN. For payments we store the bKash/Nagad transaction ID and sender number you submit, along with your booking history.",
  },
  {
    heading: "How it is used",
    body: "Your data is used only to operate bookings: reserving slots, verifying payments, showing your dashboard and receipts, and contacting you about your bookings when needed. We do not sell or share your data with third parties.",
  },
  {
    heading: "Security",
    body: "PINs are stored only as cryptographic hashes, never in plain text. Bookings and payments are stored in a managed Supabase (PostgreSQL) database with row-level security, so your records are visible only to you and the turf's administrators.",
  },
  {
    heading: "Cookies and sessions",
    body: "We use a login session cookie (JWT) to keep you signed in and local browser storage to remember your in-progress slot selection. No advertising or tracking cookies are used.",
  },
  {
    heading: "Deletion",
    body: "You can request removal of your account and booking history by contacting the turf. Transaction records required for accounting may be retained where legally necessary.",
  },
  {
    heading: "Contact",
    body: `Questions about this policy can be raised by calling ${SITE.phone} or visiting the turf at ${SITE.address}.`,
  },
];

export default function PrivacyPage() {
  usePageMeta(privacy);
  return (
    <section className="px-6 pb-24 pt-32 sm:px-10 sm:pt-40 lg:px-16">
      <p className="eyebrow mb-6 text-white/60">Brothers Sports Zone</p>
      <h1 className="display-xl">Privacy policy</h1>
      <div className="mt-14 max-w-2xl">
        {sections.map((s, i) => (
          <div key={s.heading} className="hairline-dark py-8 first:border-t-0 first:pt-0">
            <h2 className="button-cap">
              <span className="text-white/40">{String(i + 1).padStart(2, "0")}</span> {s.heading}
            </h2>
            <p className="mt-4 text-base leading-7 tracking-[.32px] text-white/75">{s.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

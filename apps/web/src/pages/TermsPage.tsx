import { usePageMeta, PUBLIC_PAGES } from "../lib/seo";

const terms = PUBLIC_PAGES[3];

const sections = [
  {
    heading: "Bookings",
    body: "A booking is confirmed only after the turf verifies your advance payment. Selecting a slot holds it for five minutes; if payment is not submitted within that window the slot is released for others. Slot prices are set by the turf and may differ between time slots and days.",
  },
  {
    heading: "Payment",
    body: "Payment is made by sending the advance amount to the turf's bKash or Nagad number and submitting the transaction ID during checkout. The remaining amount is payable in cash on arrival. Bookings pending payment verification remain reserved until an administrator confirms or rejects them.",
  },
  {
    heading: "Cancellation by users",
    body: "You may cancel a booking from your dashboard while it is still awaiting payment verification. Once a booking is confirmed, it can no longer be cancelled by the user. Advance payments are not refunded when a user cancels.",
  },
  {
    heading: "Cancellation by the turf",
    body: "The turf may cancel any booking (for example for maintenance or events). Confirmed bookings cancelled by the turf are refunded in full.",
  },
  {
    heading: "Conduct",
    body: "Bookings are personal. Please arrive on time; slots start and end exactly on schedule. The turf reserves the right to refuse service for misconduct or repeated no-shows.",
  },
  {
    heading: "Accounts",
    body: "Access to bookings is through your phone number and a 4-digit PIN. Do not share your PIN. If you forget it, contact the turf to have it reset — there is no self-service reset.",
  },
];

export default function TermsPage() {
  usePageMeta(terms);
  return (
    <section className="px-6 pb-24 pt-32 sm:px-10 sm:pt-40 lg:px-16">
      <p className="eyebrow mb-6 text-white/60">Brothers Sports Zone</p>
      <h1 className="display-xl">Terms of service</h1>
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

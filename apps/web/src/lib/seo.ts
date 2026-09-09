import { useEffect } from "react";
import { OG_IMAGE_PATH, SITE } from "./site";

export interface PageMeta {
  path: string;
  title: string;
  description: string;
}

/** Per-page SEO metadata for the prerendered public pages. */
export const PUBLIC_PAGES: PageMeta[] = [
  {
    path: "/",
    title: "Brothers Sports Zone — Football Turf Booking in Faridpur",
    description:
      "Book a football turf slot at Brothers Sports Zone in Faridpur, Dhaka. Sixteen daily slots from morning to late night with live availability, advance payment online, and the rest in cash on arrival.",
  },
  {
    path: "/gallery",
    title: "Gallery — Brothers Sports Zone",
    description:
      "Photos of the Brothers Sports Zone football turf in Faridpur: floodlit night matches, aerial views, and facility details.",
  },
  {
    path: "/contact",
    title: "Contact & Location — Brothers Sports Zone",
    description:
      "Find Brothers Sports Zone in Faridpur, Dhaka, Bangladesh. Address, map, and contact details for slot bookings.",
  },
  {
    path: "/terms",
    title: "Terms of Service — Brothers Sports Zone",
    description: "Terms of service for booking slots at Brothers Sports Zone football turf, Faridpur.",
  },
  {
    path: "/privacy",
    title: "Privacy Policy — Brothers Sports Zone",
    description: "How Brothers Sports Zone collects, uses, and protects your information.",
  },
];

interface HeadTag {
  tag: "title" | "meta" | "link";
  attrs: Record<string, string>;
  content?: string;
}

export function headTagsFor(page: PageMeta): HeadTag[] {
  const url = `${SITE.domain}${page.path === "/" ? "" : page.path}`;
  const image = `${SITE.domain}${OG_IMAGE_PATH}`;
  return [
    { tag: "title", attrs: {}, content: page.title },
    { tag: "meta", attrs: { name: "description" }, content: page.description },
    { tag: "meta", attrs: { property: "og:title" }, content: page.title },
    { tag: "meta", attrs: { property: "og:description" }, content: page.description },
    { tag: "meta", attrs: { property: "og:type" }, content: "website" },
    { tag: "meta", attrs: { property: "og:url" }, content: url },
    { tag: "meta", attrs: { property: "og:image" }, content: image },
    { tag: "meta", attrs: { property: "og:site_name" }, content: SITE.name },
    { tag: "link", attrs: { rel: "canonical", href: url } },
  ];
}

function upsertMeta(attrs: Record<string, string>, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(
    `meta[${Object.keys(attrs)[0]}="${attrs[Object.keys(attrs)[0]]}"]`,
  );
  if (!el) {
    el = document.createElement("meta");
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

/** Keeps document head correct during client-side navigation between
 *  prerendered public pages. Protected routes are not prerendered. */
export function usePageMeta(page: PageMeta) {
  useEffect(() => {
    document.title = page.title;
    for (const t of headTagsFor(page)) {
      if (t.tag === "meta" && t.content) {
        upsertMeta(t.attrs, t.content);
      } else if (t.tag === "link" && t.attrs.rel === "canonical") {
        let link = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
        if (!link) {
          link = document.createElement("link");
          link.rel = "canonical";
          document.head.appendChild(link);
        }
        link.href = t.attrs.href;
      }
    }
  }, [page]);
}

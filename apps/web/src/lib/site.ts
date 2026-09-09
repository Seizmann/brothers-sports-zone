/** Site-wide static config for public pages and SEO. */

export const SITE = {
  name: "Brothers Sports Zone",
  domain: "https://brotherssportszone.com",
  tagline: "Football turf in Faridpur, Dhaka",
  address: "Faridpur, Dhaka, Bangladesh",
  phone: "01878-099659",
} as const;

export const OG_IMAGE_PATH = "/docs/og-image.webp";

/** Contact info baked into the prerendered /contact HTML and shown until the
 *  live settings row loads. Keep in sync with the
 *  202609090003_contact_info.sql column defaults. */
export const CONTACT_DEFAULTS = {
  phone: "01878099659",
  email: "hello@brotherssportszone.com",
  location: "Chanmari Drain Chak, Faridpur Sadar, Faridpur",
  mapLat: 23.596549,
  mapLng: 89.843991,
};

/** Footer social links, same defaults convention as CONTACT_DEFAULTS. Keep
 *  in sync with the 202609090004_social_links.sql column defaults. */
export const SOCIAL_DEFAULTS = {
  facebook: "https://www.facebook.com/share/1DV8SpFLL9/",
  instagram: "https://www.instagram.com/brothers_sports_zone_faridpur",
};

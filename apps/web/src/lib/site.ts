/** Site-wide static config for public pages and SEO. */

export const SITE = {
  name: "Brothers Sports Zone",
  domain: "https://brotherssportszone.com",
  tagline: "Football turf in Faridpur, Dhaka",
  address: "Faridpur, Dhaka, Bangladesh",
  // TODO(user): replace with the turf's real public phone number before launch.
  phone: "+880 1XXX-XXXXXX",
  mapsEmbed: "https://www.google.com/maps?q=Faridpur%2C%20Dhaka%2C%20Bangladesh&output=embed",
} as const;

export const OG_IMAGE_PATH = "/docs/og-image.webp";

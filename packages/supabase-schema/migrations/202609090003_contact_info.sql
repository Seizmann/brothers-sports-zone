-- Migration 010: DB-driven contact info for the /contact page.
-- The contact page hardcoded placeholder phone/address and a query-based
-- Google Maps embed. The turf wants these editable from
-- /management/settings alongside the payment numbers, so the settings
-- singleton gains public-identity columns: contact phone, email, free-text
-- location, and the map pin as separate lat/lng numerics (typed range
-- checks beat parsing a "lat,lng" text field at render time). Unlike the
-- nullable bKash/Nagad numbers — whose absence just hides a payment method
-- — the contact block is the turf's public identity, so these are NOT NULL
-- with defaults backfilled onto the singleton row (the same values ship as
-- CONTACT_DEFAULTS in apps/web/src/lib/site.ts for the prerendered HTML).
-- Existing RLS policies already cover the new columns: anyone reads
-- settings, admins manage it. No RLS or RPC changes.

alter table public.settings
  add column contact_phone    text             not null default '01878099659',
  add column contact_email    text             not null default 'hello@brotherssportszone.com',
  add column contact_location text             not null default 'Chanmari Drain Chak, Faridpur Sadar, Faridpur',
  add column map_lat          double precision not null default 23.596549 check (map_lat between -90 and 90),
  add column map_lng          double precision not null default 89.843991 check (map_lng between -180 and 180);

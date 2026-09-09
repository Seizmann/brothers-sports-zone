-- Migration 011: DB-driven footer social links.
-- The footer gains contact info and social links driven by the settings
-- singleton, editable from /management/settings. Facebook and Instagram URLs
-- are NOT NULL with defaults backfilled onto the singleton row: the social
-- block is part of the turf's public identity, same treatment as the contact
-- columns added in migration 010 (unlike the nullable bKash/Nagad numbers,
-- whose absence just hides a payment method). The same values ship as
-- SOCIAL_DEFAULTS in apps/web/src/lib/site.ts for the prerendered HTML —
-- keep them in sync on any default change. No CHECK on the text columns;
-- URL well-formedness is validated app-side, matching the contact columns.
-- Existing RLS policies already cover the new columns: anyone reads
-- settings, admins manage it. No RLS or RPC changes.

alter table public.settings
  add column facebook_url  text not null default 'https://www.facebook.com/share/1DV8SpFLL9/',
  add column instagram_url text not null default 'https://www.instagram.com/brothers_sports_zone_faridpur';

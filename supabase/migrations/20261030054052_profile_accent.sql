-- =============================================================================
-- profile_accent  |  Per-user accent colour (Settings > Accent color)
--
-- Stored on the profile so it follows the account across devices. Null means
-- the default (signal red). Ids match ACCENTS in src/lib/accent.js.
-- Existing RLS ("owner can update own profile") already covers writes.
-- =============================================================================

alter table public.profiles
  add column accent text check (accent in ('red', 'orange', 'amber', 'lime', 'cyan', 'white'));

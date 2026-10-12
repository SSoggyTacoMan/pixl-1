-- Hardened relaunch, spec Section 4: owner-only admin power.
--
-- TAKE A DATABASE BACKUP BEFORE RUNNING THIS IN PRODUCTION. It drops three
-- tables and rewrites admins.permissions; there is no down migration.
--
-- After this, the internal dashboard has exactly four roles:
--   owner     = ADMIN_SLACK_IDS env var only (no table can grant it)
--   reviewer  = admins row holding 'review' (+ review markers only)
--   helper    = helpers table
--   fulfiller = fulfillers table
--
-- 1. Drop the tables for roles that no longer exist. super_admins was the
--    table the 2026-10-11 attacker inserted themselves into.
-- 2. Strip every non-review permission from admins rows (warn, ban, notify,
--    pixels, shop, fulfillment, events, sidequests, story, goals, news,
--    referrals, ideas, tickets, lookup, show_n_tell, forms, operations, and
--    the 'sponsor' label). Sponsors keep their review + second_pass.
-- 3. Delete admins rows left with no permissions at all.
--
-- Idempotent: safe to run more than once.

drop table if exists super_admins;
drop table if exists moderators;
drop table if exists report_viewers;

update admins
set permissions = coalesce(
  array(
    select distinct p
    from unnest(permissions) as p
    where p in (
      'review',
      'second_pass',
      'review_hardware_only',
      'review_software_only',
      'edit_submission',
      'no_review'
    )
    order by p
  ),
  '{}'::text[]
)
where exists (
  select 1
  from unnest(permissions) as p
  where p not in (
    'review',
    'second_pass',
    'review_hardware_only',
    'review_software_only',
    'edit_submission',
    'no_review'
  )
);

delete from admins where cardinality(permissions) = 0;

-- Marks the reports whose severe AI verdict was logged as a counted 'chat'
-- violation (one that feeds the 7-violation auto-ban). reports.ts uses it to
-- let each distinct reporter contribute at most one counted AI violation per
-- target per corroboration window; further severe verdicts from the same
-- reporter are kept as uncounted 'ai_flag' rows for reviewers.
alter table reports add column if not exists ai_counted boolean not null default false;

create index if not exists reports_target_reporter_ai_counted_idx
  on reports (target_id, reporter_id, created_at)
  where ai_counted;

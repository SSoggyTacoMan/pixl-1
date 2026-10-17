-- projects.approved_hours is the CUMULATIVE credited total: pixel payout is a
-- delta against what the project already paid, and a re-approval overwrites it.
-- An update ship gets its own Airtable row that must carry only the hours not
-- already approved on the earlier row, so the approved total at the moment the
-- update was shipped is frozen here (0 for a project that was never an update).
-- Set by POST /api/projects/:id/ship; never player-visible.
--
-- Backfill: updates already in the review queue (is_update, not yet re-approved)
-- still hold their previous approval in approved_hours, since shipping does not
-- clear it. Collaborators follow their project.
--
-- Idempotent. Run against the orchard/CNPG database.

ALTER TABLE projects ADD COLUMN IF NOT EXISTS prior_approved_hours numeric(10, 2) NOT NULL DEFAULT 0;
ALTER TABLE project_collaborators ADD COLUMN IF NOT EXISTS prior_approved_hours numeric(10, 2) NOT NULL DEFAULT 0;

UPDATE projects
SET prior_approved_hours = approved_hours
WHERE is_update
  AND status <> 'approved'
  AND approved_hours IS NOT NULL
  AND prior_approved_hours = 0;

UPDATE project_collaborators c
SET prior_approved_hours = c.approved_hours
FROM projects p
WHERE c.project_id = p.id
  AND p.is_update
  AND p.status <> 'approved'
  AND c.approved_hours IS NOT NULL
  AND c.prior_approved_hours = 0;

-- Enable RLS and example policies (originally for PostgreSQL)
-- NOTE: MySQL does not support row-level security. Retain this script for
--       documentation purposes only; do not execute it against MySQL.

-- Tasks: enable row-level security
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

-- We'll use an application-defined setting app.user_id to know current user
-- Set this per connection in your backend: SELECT set_config('app.user_id', '<uuid>', false);

-- Policy: assignee or project member can SELECT
CREATE POLICY tasks_select_member ON tasks
FOR SELECT USING (
  assignee_user_id = (current_setting('app.user_id', true))::uuid
  OR project_id IN (
    SELECT pm.project_id FROM project_members pm
    WHERE pm.user_id = (current_setting('app.user_id', true))::uuid
  )
);

-- Policy: assignee can UPDATE their own status (example)
CREATE POLICY tasks_update_assignee ON tasks
FOR UPDATE USING (
  assignee_user_id = (current_setting('app.user_id', true))::uuid
);

-- PM of project can UPDATE tasks in their projects
CREATE POLICY tasks_update_pm ON tasks
FOR UPDATE USING (
  project_id IN (
    SELECT p.id FROM projects p
    WHERE p.owner_user_id = (current_setting('app.user_id', true))::uuid
  )
);

-- Optionally restrict INSERT/DELETE to PM/Owner via your backend roles

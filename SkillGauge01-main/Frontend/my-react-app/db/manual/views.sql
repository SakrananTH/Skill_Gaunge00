-- Manual DB artifacts for dashboards and utilities
-- Safe to run multiple times. Use DROP/REFRESH blocks as needed.

-- View: tasks overview across projects/sites
CREATE OR REPLACE VIEW v_tasks_overview AS
SELECT
  t.id               AS task_id,
  t.title,
  t.status,
  t.priority,
  t.due_date,
  p.id               AS project_id,
  p.name             AS project_name,
  s.id               AS site_id,
  s.name             AS site_name,
  u.id               AS assignee_id,
  u.full_name        AS assignee_name
FROM tasks t
JOIN projects p ON p.id = t.project_id
LEFT JOIN sites s ON s.id = t.site_id
LEFT JOIN users u ON u.id = t.assignee_user_id;

-- Function: get a user's role keys as array
CREATE OR REPLACE FUNCTION get_user_roles(p_user_id uuid)
RETURNS text[]
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(array_agg(DISTINCT r.key ORDER BY r.key), ARRAY[]::text[])
  FROM user_roles ur
  JOIN roles r ON r.id = ur.role_id
  WHERE ur.user_id = p_user_id;
$$;

-- Materialized View: per-project task counts (total/todo/in-progress/done)
-- If definition changes, uncomment DROP block before create
-- DROP MATERIALIZED VIEW IF EXISTS mv_project_task_counts;
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_project_task_counts AS
SELECT
  p.id   AS project_id,
  p.name AS project_name,
  COUNT(*)                                          AS tasks_total,
  COUNT(*) FILTER (WHERE t.status = 'todo')         AS tasks_todo,
  COUNT(*) FILTER (WHERE t.status = 'in-progress')  AS tasks_in_progress,
  COUNT(*) FILTER (WHERE t.status = 'done')         AS tasks_done
FROM projects p
LEFT JOIN tasks t ON t.project_id = p.id
GROUP BY p.id, p.name
WITH NO DATA;

-- Refresh helper (execute when you need fresh numbers)
-- REFRESH MATERIALIZED VIEW CONCURRENTLY mv_project_task_counts;

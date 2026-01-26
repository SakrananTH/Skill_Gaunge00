-- Fix seed after initial failure: create project, membership, site, tasks, questions and options

-- Project + membership ensuring id available whether newly inserted or pre-existing by name
WITH pm AS (
  SELECT id AS user_id FROM users WHERE phone = '+66853334444'
), fm AS (
  SELECT id AS user_id FROM users WHERE phone = '+66861234567'
), wk AS (
  SELECT id AS user_id FROM users WHERE phone = '+66869876543'
), existing AS (
  SELECT id FROM projects WHERE name = 'โครงการตัวอย่าง'
), ins AS (
  INSERT INTO projects(name, owner_user_id)
  SELECT 'โครงการตัวอย่าง', pm.user_id FROM pm
  WHERE NOT EXISTS (SELECT 1 FROM existing)
  RETURNING id
), np AS (
  SELECT id FROM ins
  UNION ALL
  SELECT id FROM existing
)
INSERT INTO project_members(project_id, user_id, role_in_project)
SELECT np.id, (SELECT user_id FROM pm), 'PM' FROM np
ON CONFLICT DO NOTHING;

WITH np AS (
  SELECT id FROM projects WHERE name = 'โครงการตัวอย่าง'
), fm AS (
  SELECT id AS user_id FROM users WHERE phone = '+66861234567'
), wk AS (
  SELECT id AS user_id FROM users WHERE phone = '+66869876543'
), existing_site AS (
  SELECT id, project_id FROM sites WHERE name = 'ไซต์ A'
), new_site AS (
  INSERT INTO sites(project_id, name, location)
  SELECT np.id, 'ไซต์ A', 'กรุงเทพฯ' FROM np
  WHERE NOT EXISTS (SELECT 1 FROM existing_site)
  RETURNING id, project_id
), ns AS (
  SELECT * FROM new_site
  UNION ALL
  SELECT * FROM existing_site
)
INSERT INTO tasks(project_id, site_id, title, priority, status, assignee_user_id, due_date)
SELECT ns.project_id, ns.id, 'ติดตั้งแผ่นยิปซัม', 'high', 'todo', (SELECT user_id FROM fm), CURRENT_DATE + 7 FROM ns
ON CONFLICT DO NOTHING;

WITH ns AS (
  SELECT s.id, s.project_id FROM sites s JOIN projects p ON p.id = s.project_id
  WHERE p.name = 'โครงการตัวอย่าง' AND s.name = 'ไซต์ A'
), wk AS (
  SELECT id AS user_id FROM users WHERE phone = '+66869876543'
)
INSERT INTO tasks(project_id, site_id, title, priority, status, assignee_user_id, due_date)
SELECT ns.project_id, ns.id, 'ตรวจความปลอดภัย', 'medium', 'in-progress', (SELECT user_id FROM wk), CURRENT_DATE + 10 FROM ns
ON CONFLICT DO NOTHING;

-- Questions + options (idempotent on text uniqueness assumption)
INSERT INTO questions(text, category, difficulty, version, active)
SELECT 'ใครควรสวมอุปกรณ์ป้องกันส่วนบุคคล (PPE) หน้างาน?', 'safety', 'easy', '1.0', true
WHERE NOT EXISTS (SELECT 1 FROM questions WHERE text LIKE 'ใครควรสวม%');

INSERT INTO questions(text, category, difficulty, version, active)
SELECT 'เบรกเกอร์ทำหน้าที่อะไร?', 'electrical', 'easy', '1.0', true
WHERE NOT EXISTS (SELECT 1 FROM questions WHERE text LIKE 'เบรกเกอร์ทำหน้าที่%');

WITH q1 AS (SELECT id FROM questions WHERE text LIKE 'ใครควรสวม%'),
     q2 AS (SELECT id FROM questions WHERE text LIKE 'เบรกเกอร์ทำหน้าที่%')
INSERT INTO question_options(question_id, text, is_correct)
SELECT (SELECT id FROM q1), 'ทุกคนที่อยู่ในพื้นที่ก่อสร้าง', true
WHERE NOT EXISTS (
  SELECT 1 FROM question_options WHERE question_id = (SELECT id FROM q1) AND text = 'ทุกคนที่อยู่ในพื้นที่ก่อสร้าง'
);

WITH q1 AS (SELECT id FROM questions WHERE text LIKE 'ใครควรสวม%')
INSERT INTO question_options(question_id, text, is_correct)
SELECT (SELECT id FROM q1), 'เฉพาะผู้จัดการโครงการ', false
WHERE NOT EXISTS (
  SELECT 1 FROM question_options WHERE question_id = (SELECT id FROM q1) AND text = 'เฉพาะผู้จัดการโครงการ'
);

WITH q2 AS (SELECT id FROM questions WHERE text LIKE 'เบรกเกอร์ทำหน้าที่%')
INSERT INTO question_options(question_id, text, is_correct)
SELECT (SELECT id FROM q2), 'ป้องกันกระแสเกินและลัดวงจร', true
WHERE NOT EXISTS (
  SELECT 1 FROM question_options WHERE question_id = (SELECT id FROM q2) AND text = 'ป้องกันกระแสเกินและลัดวงจร'
);

WITH q2 AS (SELECT id FROM questions WHERE text LIKE 'เบรกเกอร์ทำหน้าที่%')
INSERT INTO question_options(question_id, text, is_correct)
SELECT (SELECT id FROM q2), 'เพิ่มแรงดันไฟฟ้า', false
WHERE NOT EXISTS (
  SELECT 1 FROM question_options WHERE question_id = (SELECT id FROM q2) AND text = 'เพิ่มแรงดันไฟฟ้า'
);

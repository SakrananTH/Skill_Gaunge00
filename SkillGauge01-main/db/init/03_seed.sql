-- Minimal seed data for MySQL

INSERT INTO roles(`key`, description) VALUES
  ('admin', 'System administrator'),
  ('project_manager', 'Project manager'),
  ('foreman', 'Site foreman'),
  ('worker', 'Crew member')
ON DUPLICATE KEY UPDATE description = VALUES(description);

SET @hash_admin := '$2a$10$X3wuLPiWccWOWyLF7Qk9FeCfCkGiyLRgQmxU1WDRdfBOoLOq2aIfa';
SET @hash_default := '$2a$10$nJnYLwJQ6Nu2lqsErhQmIuE8KfJHO0GtKHSTuPMH6gu.fpvWWE2NS';

SET @admin_user_id := '11111111-1111-1111-1111-111111111111';
SET @pm_user_id    := '22222222-2222-2222-2222-222222222222';
SET @fm_user_id    := '33333333-3333-3333-3333-333333333333';
SET @wk_user_id    := '44444444-4444-4444-4444-444444444444';

INSERT INTO users (id, full_name, phone, email, password_hash, status)
VALUES
  (@admin_user_id, 'ผู้ดูแลระบบ', '+66863125891', 'admin@example.com', @hash_admin, 'active'),
  (@pm_user_id,    'วิชัย ลิ้มเจริญ', '+66853334444', 'pm@example.com', @hash_default, 'active'),
  (@fm_user_id,    'สมิทธิ์ ไม่มีนี่', '+66861234567', 'foreman@example.com', @hash_default, 'active'),
  (@wk_user_id,    'โสภา ไพบูลย์', '+66869876543', 'worker@example.com', @hash_default, 'active')
ON DUPLICATE KEY UPDATE
  full_name = VALUES(full_name),
  email = VALUES(email),
  status = VALUES(status);

SET @admin_role_id := (SELECT id FROM roles WHERE `key` = 'admin');
SET @pm_role_id    := (SELECT id FROM roles WHERE `key` = 'project_manager');
SET @fm_role_id    := (SELECT id FROM roles WHERE `key` = 'foreman');
SET @wk_role_id    := (SELECT id FROM roles WHERE `key` = 'worker');

INSERT IGNORE INTO user_roles(user_id, role_id) VALUES
  (@admin_user_id, @admin_role_id),
  (@pm_user_id, @pm_role_id),
  (@fm_user_id, @fm_role_id),
  (@wk_user_id, @wk_role_id);

SET @project_id := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
INSERT INTO projects (id, name, owner_user_id, status)
VALUES (@project_id, 'โครงการตัวอย่าง', @pm_user_id, 'active')
ON DUPLICATE KEY UPDATE name = VALUES(name), owner_user_id = VALUES(owner_user_id), status = VALUES(status);

INSERT IGNORE INTO project_members(project_id, user_id, role_in_project) VALUES
  (@project_id, @pm_user_id, 'PM'),
  (@project_id, @fm_user_id, 'Foreman'),
  (@project_id, @wk_user_id, 'Worker');

SET @site_id := 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
INSERT INTO sites (id, project_id, name, location)
VALUES (@site_id, @project_id, 'ไซต์ A', 'กรุงเทพฯ')
ON DUPLICATE KEY UPDATE name = VALUES(name), location = VALUES(location);

INSERT INTO tasks (id, project_id, site_id, title, priority, status, assignee_user_id, due_date)
VALUES
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', @project_id, @site_id, 'ติดตั้งแผ่นยิปซัม', 'high', 'todo', @fm_user_id, DATE_ADD(CURDATE(), INTERVAL 7 DAY)),
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', @project_id, @site_id, 'ตรวจความปลอดภัย', 'medium', 'in-progress', @wk_user_id, DATE_ADD(CURDATE(), INTERVAL 10 DAY))
ON DUPLICATE KEY UPDATE
  title = VALUES(title),
  priority = VALUES(priority),
  status = VALUES(status),
  assignee_user_id = VALUES(assignee_user_id),
  due_date = VALUES(due_date);

SET @q1 := 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee';
SET @q2 := 'ffffffff-ffff-ffff-ffff-ffffffffffff';

INSERT INTO questions (id, text, category, difficulty, version, active)
VALUES
  (@q1, 'ใครควรสวมอุปกรณ์ป้องกันส่วนบุคคล (PPE) หน้างาน?', 'safety', 'easy', '1.0', 1),
  (@q2, 'เบรกเกอร์ทำหน้าที่อะไร?', 'electrical', 'easy', '1.0', 1)
ON DUPLICATE KEY UPDATE
  text = VALUES(text),
  category = VALUES(category),
  difficulty = VALUES(difficulty),
  version = VALUES(version),
  active = VALUES(active);

INSERT INTO question_options (id, question_id, text, is_correct)
VALUES
  ('e1e1e1e1-e1e1-e1e1-e1e1-e1e1e1e1e1e1', @q1, 'ทุกคนที่อยู่ในพื้นที่ก่อสร้าง', 1),
  ('e2e2e2e2-e2e2-e2e2-e2e2-e2e2e2e2e2e2', @q1, 'เฉพาะผู้จัดการโครงการ', 0),
  ('f1f1f1f1-f1f1-f1f1-f1f1-f1f1f1f1f1f1', @q2, 'ป้องกันกระแสเกินและลัดวงจร', 1),
  ('f2f2f2f2-f2f2-f2f2-f2f2-f2f2f2f2f2f2', @q2, 'เพิ่มแรงดันไฟฟ้า', 0)
ON DUPLICATE KEY UPDATE
  text = VALUES(text),
  is_correct = VALUES(is_correct);

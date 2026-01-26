-- ===============================================================================
-- SkillGauge Complete Seed Data
-- ข้อมูลตัวอย่างครบถ้วนสำหรับระบบจัดการทักษะพนักงาน
-- ===============================================================================

-- ===============================================================================
-- 1. ROLES & PERMISSIONS (บทบาทและสิทธิ์การใช้งาน)
-- ===============================================================================

INSERT INTO roles (id, `key`, description) VALUES
  (1, 'admin', 'ผู้ดูแลระบบ - มีสิทธิ์เต็มทุกอย่าง'),
  (2, 'project_manager', 'ผู้จัดการโครงการ - จัดการโปรเจคและทีม'),
  (3, 'worker', 'พนักงาน - ใช้งานทั่วไปและทำแบบทดสอบ'),
  (4, 'hr', 'ฝ่ายบุคคล - จัดการข้อมูลพนักงาน'),
  (5, 'trainer', 'ผู้อบรม - สร้างและจัดการแบบทดสอบ')
ON DUPLICATE KEY UPDATE description = VALUES(description);

-- ===============================================================================
-- 2. USERS (ผู้ใช้งานระบบ)
-- ===============================================================================

-- Admin Account
INSERT INTO users (id, full_name, phone, email, password_hash, status, created_at) VALUES
  (UUID(), 'ผู้ดูแลระบบ Admin', '0812345678', 'admin@skillgauge.com', 
   '$2a$10$YourHashedPasswordHere', 'active', NOW()),
  (UUID(), 'สมชาย ใจดี', '0823456789', 'somchai@skillgauge.com', 
   '$2a$10$YourHashedPasswordHere', 'active', NOW()),
  (UUID(), 'สมหญิง รักงาน', '0834567890', 'somying@skillgauge.com', 
   '$2a$10$YourHashedPasswordHere', 'active', NOW())
ON DUPLICATE KEY UPDATE full_name = VALUES(full_name);

-- กำหนดบทบาทให้ผู้ใช้
INSERT INTO user_roles (user_id, role_id, assigned_at)
SELECT u.id, 1, NOW() FROM users u WHERE u.email = 'admin@skillgauge.com'
ON DUPLICATE KEY UPDATE assigned_at = VALUES(assigned_at);

INSERT INTO user_roles (user_id, role_id, assigned_at)
SELECT u.id, 2, NOW() FROM users u WHERE u.email = 'somchai@skillgauge.com'
ON DUPLICATE KEY UPDATE assigned_at = VALUES(assigned_at);

-- ===============================================================================
-- 3. DEPARTMENTS & POSITIONS (แผนกและตำแหน่งงาน)
-- ===============================================================================

-- เพิ่มตารางแผนก (ถ้ายังไม่มี)
CREATE TABLE IF NOT EXISTS departments (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(120) NOT NULL,
  code VARCHAR(30) NOT NULL,
  description TEXT NULL,
  manager_name VARCHAR(120) NULL,
  target_score DECIMAL(5,2) NULL DEFAULT 75.00,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  UNIQUE KEY uq_departments_code (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO departments (name, code, description, manager_name, target_score) VALUES
  ('ฝ่ายก่อสร้าง', 'CONST', 'แผนกงานก่อสร้างและโครงสร้าง', 'คุณสมชาย', 75.00),
  ('ฝ่ายไฟฟ้า', 'ELEC', 'แผนกงานระบบไฟฟ้าและแสงสว่าง', 'คุณสมหญิง', 80.00),
  ('ฝ่ายประปา', 'PLUMB', 'แผนกงานระบบประปาและสุขาภิบาล', 'คุณสมศักดิ์', 75.00),
  ('ฝ่ายปรับอากาศ', 'HVAC', 'แผนกงานระบบปรับอากาศ', 'คุณสมพร', 80.00),
  ('ฝ่ายจิตรกรรม', 'PAINT', 'แผนกงานทาสีและตกแต่ง', 'คุณสมบูรณ์', 70.00),
  ('ฝ่ายภูมิสถาปัตย์', 'LAND', 'แผนกงานจัดสวนและภูมิทัศน์', 'คุณสมใจ', 70.00)
ON DUPLICATE KEY UPDATE description = VALUES(description);

-- ===============================================================================
-- 4. TRADE TYPES & SKILL CATEGORIES (ประเภทงานและหมวดทักษะ)
-- ===============================================================================

CREATE TABLE IF NOT EXISTS trade_types (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(120) NOT NULL,
  code VARCHAR(30) NOT NULL,
  category VARCHAR(60) NULL,
  description TEXT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_trade_types_code (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO trade_types (name, code, category, description) VALUES
  ('ช่างก่อสร้าง', 'MASON', 'งานโครงสร้าง', 'งานก่ออิฐ ฉาบปูน งานคอนกรีต'),
  ('ช่างไฟฟ้า', 'ELECTRICIAN', 'งานระบบ', 'งานติดตั้งและซ่อมบำรุงระบบไฟฟ้า'),
  ('ช่างประปา', 'PLUMBER', 'งานระบบ', 'งานติดตั้งและซ่อมบำรุงระบบประปา'),
  ('ช่างแอร์', 'HVAC_TECH', 'งานระบบ', 'งานติดตั้งและซ่อมบำรุงเครื่องปรับอากาศ'),
  ('ช่างเหล็กดัด', 'WELDER', 'งานโครงสร้าง', 'งานเชื่อมและดัดเหล็ก'),
  ('ช่างไม้', 'CARPENTER', 'งานตกแต่ง', 'งานไม้และงานตกแต่ง'),
  ('ช่างทาสี', 'PAINTER', 'งานตกแต่ง', 'งานทาสีและพ่นสี'),
  ('ช่างปูกระเบื้อง', 'TILER', 'งานตกแต่ง', 'งานปูกระเบื้องและหินอ่อน'),
  ('ช่างอลูมิเนียม', 'ALUMINUM', 'งานตกแต่ง', 'งานติดตั้งอลูมิเนียมและกระจก'),
  ('ช่างจัดสวน', 'LANDSCAPER', 'งานภูมิทัศน์', 'งานจัดสวนและดูแลต้นไม้')
ON DUPLICATE KEY UPDATE description = VALUES(description);

-- ===============================================================================
-- 5. WORKERS (ข้อมูลพนักงาน)
-- ===============================================================================

INSERT INTO workers (
  national_id, full_name, phone, birth_date, age, role_code, trade_type,
  experience_years, province, district, subdistrict, postal_code,
  employment_status, start_date, created_at
) VALUES
  ('1234567890123', 'นายสมชาย ช่างดี', '0891234567', '1990-05-15', 33, 'worker', 'ELECTRICIAN',
   10, 'กรุงเทพมหานคร', 'บางกะปิ', 'คลองจั่น', '10240', 'active', '2020-01-15', NOW()),
  
  ('2345678901234', 'นายสมศักดิ์ ขยันงาน', '0892345678', '1988-08-20', 35, 'worker', 'MASON',
   12, 'กรุงเทพมหานคร', 'ห้วยขวาง', 'ห้วยขวาง', '10310', 'active', '2019-03-20', NOW()),
  
  ('3456789012345', 'นายสมพร มั่นใจ', '0893456789', '1992-03-10', 31, 'worker', 'PLUMBER',
   8, 'นนทบุรี', 'เมืองนนทบุรี', 'สวนใหญ่', '11000', 'active', '2021-06-10', NOW()),
  
  ('4567890123456', 'นายสมบูรณ์ ทาสีดี', '0894567890', '1995-11-25', 28, 'worker', 'PAINTER',
   5, 'กรุงเทพมหานคร', 'บางนา', 'บางนา', '10260', 'active', '2022-02-14', NOW()),
  
  ('5678901234567', 'นายสมหวัง ประปาเก่ง', '0895678901', '1987-07-08', 36, 'worker', 'PLUMBER',
   15, 'สมุทรปราการ', 'เมืองสมุทรปราการ', 'ปากน้ำ', '10270', 'active', '2018-09-01', NOW()),
  
  ('6789012345678', 'นายสมใจ ไฟฟ้าแรง', '0896789012', '1993-12-30', 30, 'worker', 'ELECTRICIAN',
   7, 'กรุงเทพมหานคร', 'ลาดกระบัง', 'ลาดกระบัง', '10520', 'active', '2020-11-20', NOW()),
  
  ('7890123456789', 'นายสมคิด แอร์เย็น', '0897890123', '1991-04-18', 32, 'worker', 'HVAC_TECH',
   9, 'ปทุมธานี', 'คลองหลวง', 'คลองหนึ่ง', '12120', 'active', '2019-07-15', NOW()),
  
  ('8901234567890', 'นายสมร ปูกระเบื้อง', '0898901234', '1994-09-05', 29, 'worker', 'TILER',
   6, 'กรุงเทพมหานคร', 'บางแค', 'บางแค', '10160', 'active', '2021-03-25', NOW()),
  
  ('9012345678901', 'นายสมนึก เชื่อมเหล็ก', '0899012345', '1989-02-14', 34, 'worker', 'WELDER',
   11, 'สมุทรสาคร', 'เมืองสมุทรสาคร', 'มหาชัย', '74000', 'active', '2019-05-10', NOW()),
  
  ('0123456789012', 'นายสมดี จัดสวนสวย', '0890123456', '1996-06-22', 27, 'worker', 'LANDSCAPER',
   4, 'กรุงเทพมหานคร', 'ประเวศ', 'ประเวศ', '10250', 'probation', '2023-10-01', NOW())
ON DUPLICATE KEY UPDATE full_name = VALUES(full_name);

-- ===============================================================================
-- 6. QUESTION CATEGORIES & SUBCATEGORIES (หมวดหมู่คำถาม)
-- ===============================================================================

-- ตรวจสอบว่ามีตาราง subcategories หรือไม่
CREATE TABLE IF NOT EXISTS subcategories (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  category VARCHAR(120) NOT NULL,
  name VARCHAR(120) NOT NULL,
  description TEXT NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  UNIQUE KEY uq_subcategories (category, name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO subcategories (category, name, description) VALUES
  ('ช่างไฟฟ้า', 'ความปลอดภัย', 'ความรู้เรื่องความปลอดภัยในงานไฟฟ้า'),
  ('ช่างไฟฟ้า', 'ทฤษฎีพื้นฐาน', 'ความรู้พื้นฐานเรื่องไฟฟ้า'),
  ('ช่างไฟฟ้า', 'การติดตั้ง', 'ทักษะการติดตั้งระบบไฟฟ้า'),
  ('ช่างไฟฟ้า', 'การซ่อมบำรุง', 'การแก้ไขและบำรุงรักษา'),
  
  ('ช่างก่อสร้าง', 'ความปลอดภัย', 'ความปลอดภัยในงานก่อสร้าง'),
  ('ช่างก่อสร้าง', 'วัสดุก่อสร้าง', 'ความรู้เรื่องวัสดุและคุณสมบัติ'),
  ('ช่างก่อสร้าง', 'เทคนิคการก่อ', 'ทักษะการก่ออิฐและฉาบปูน'),
  ('ช่างก่อสร้าง', 'งานคอนกรีต', 'การเทและบ่มคอนกรีต'),
  
  ('ช่างประปา', 'ความปลอดภัย', 'ความปลอดภัยในงานประปา'),
  ('ช่างประปา', 'ระบบท่อ', 'ความรู้เรื่องระบบท่อและการเชื่อมต่อ'),
  ('ช่างประปา', 'อุปกรณ์สุขภัณฑ์', 'การติดตั้งและซ่อมอุปกรณ์'),
  
  ('ทั่วไป', 'ความปลอดภัย', 'ความปลอดภัยทั่วไปในงานก่อสร้าง'),
  ('ทั่วไป', 'กฎหมายแรงงาน', 'กฎหมายและระเบียบที่เกี่ยวข้อง'),
  ('ทั่วไป', 'สิทธิประโยชน์', 'สิทธิและสวัสดิการพนักงาน')
ON DUPLICATE KEY UPDATE description = VALUES(description);

-- ===============================================================================
-- 7. QUESTIONS & OPTIONS (คำถามและตัวเลือก)
-- ===============================================================================

-- คำถามด้านความปลอดภัย
INSERT INTO questions (id, text, category, difficulty, version, active) VALUES
  (UUID(), 'อุปกรณ์ป้องกันส่วนบุคคล (PPE) ใดที่จำเป็นที่สุดสำหรับช่างไฟฟ้า?', 'ช่างไฟฟ้า', 'easy', 'v1', 1),
  (UUID(), 'แรงดันไฟฟ้ากี่โวลต์ถือว่าอันตรายต่อชีวิต?', 'ช่างไฟฟ้า', 'medium', 'v1', 1),
  (UUID(), 'ก่อนเริ่มงานไฟฟ้าควรทำอย่างไร?', 'ช่างไฟฟ้า', 'easy', 'v1', 1),
  
  (UUID(), 'อัตราส่วนผสมคอนกรีตทั่วไปคือเท่าไร?', 'ช่างก่อสร้าง', 'medium', 'v1', 1),
  (UUID(), 'ระยะเวลาการบ่มคอนกรีตที่เหมาะสมคือกี่วัน?', 'ช่างก่อสร้าง', 'medium', 'v1', 1),
  (UUID(), 'วัสดุใดที่ใช้ก่ออิฐให้แข็งแรงที่สุด?', 'ช่างก่อสร้าง', 'easy', 'v1', 1),
  
  (UUID(), 'ท่อ PVC ใช้สำหรับงานใด?', 'ช่างประปา', 'easy', 'v1', 1),
  (UUID(), 'ความดันน้ำมาตรฐานในระบบประปาควรเป็นเท่าไร?', 'ช่างประปา', 'medium', 'v1', 1),
  
  (UUID(), 'เมื่อเกิดอุบัติเหตุในงานก่อสร้าง ควรทำอย่างไรก่อน?', 'ทั่วไป', 'easy', 'v1', 1),
  (UUID(), 'สัญลักษณ์สีเหลืองในงานก่อสร้างหมายถึงอะไร?', 'ทั่วไป', 'easy', 'v1', 1)
ON DUPLICATE KEY UPDATE text = VALUES(text);

-- เพิ่มตัวเลือกคำตอบ (ตัวอย่าง)
SET @q1 = (SELECT id FROM questions WHERE text LIKE '%PPE%' LIMIT 1);
INSERT INTO question_options (id, question_id, text, is_correct) VALUES
  (UUID(), @q1, 'หมวกนิรภัย ถุงมือฉนวน รองเท้าเซฟตี้', 1),
  (UUID(), @q1, 'แว่นตากันแดดเท่านั้น', 0),
  (UUID(), @q1, 'ถุงมือผ้าธรรมดา', 0),
  (UUID(), @q1, 'ไม่จำเป็นต้องใส่อะไร', 0)
ON DUPLICATE KEY UPDATE text = VALUES(text);

-- ===============================================================================
-- 8. QUIZZES (แบบทดสอบ)
-- ===============================================================================

INSERT INTO quizzes (id, title, description, category, difficulty, question_count, passing_score, time_limit_minutes, status, created_by) VALUES
  (UUID(), 'แบบทดสอบช่างไฟฟ้าระดับพื้นฐาน', 'ทดสอบความรู้พื้นฐานสำหรับช่างไฟฟ้ามือใหม่', 'ช่างไฟฟ้า', 'easy', 20, 60.00, 30, 'approved', 'ผู้อบรม A'),
  (UUID(), 'แบบทดสอบช่างไฟฟ้าระดับกลาง', 'ทดสอบความรู้ระดับกลางสำหรับช่างไฟฟ้า', 'ช่างไฟฟ้า', 'medium', 30, 70.00, 45, 'approved', 'ผู้อบรม A'),
  (UUID(), 'แบบทดสอบความปลอดภัยในงานก่อสร้าง', 'ทดสอบความรู้ด้านความปลอดภัย', 'ทั่วไป', 'easy', 25, 80.00, 30, 'approved', 'ผู้อบรม B'),
  (UUID(), 'แบบทดสอบช่างก่อสร้างพื้นฐาน', 'ทดสอบทักษะการก่อสร้างพื้นฐาน', 'ช่างก่อสร้าง', 'easy', 25, 65.00, 40, 'approved', 'ผู้อบรม C'),
  (UUID(), 'แบบทดสอบช่างประปามืออาชีพ', 'ทดสอบทักษะช่างประปาระดับสูง', 'ช่างประปา', 'hard', 35, 75.00, 60, 'pending', 'ผู้อบรม D'),
  (UUID(), 'แบบทดสอบงานทาสีและตกแต่ง', 'ทดสอบความรู้เรื่องการทาสี', 'ช่างทาสี', 'medium', 20, 65.00, 30, 'pending', 'ผู้อบรม E')
ON DUPLICATE KEY UPDATE title = VALUES(title);

-- ===============================================================================
-- 9. ASSESSMENT ROUNDS (รอบการประเมิน)
-- ===============================================================================

INSERT INTO assessment_rounds (id, title, category, description, question_count, start_at, end_at, status) VALUES
  (UUID(), 'การประเมินช่างไฟฟ้าประจำปี 2026', 'ช่างไฟฟ้า', 
   'การประเมินทักษะประจำปีสำหรับช่างไฟฟ้าทุกคน', 30, 
   '2026-01-01 00:00:00', '2026-12-31 23:59:59', 'active'),
  
  (UUID(), 'การประเมินความปลอดภัย Q1/2026', 'ทั่วไป',
   'การประเมินความรู้ด้านความปลอดภัยไตรมาสแรก', 25,
   '2026-01-01 00:00:00', '2026-03-31 23:59:59', 'active'),
  
  (UUID(), 'การประเมินช่างก่อสร้างรายเดือน', 'ช่างก่อสร้าง',
   'การประเมินทักษะประจำเดือนมกราคม', 20,
   '2026-01-01 00:00:00', '2026-01-31 23:59:59', 'active'),
  
  (UUID(), 'การประเมินพนักงานใหม่', 'ทั่วไป',
   'การประเมินสำหรับพนักงานที่ผ่านการทดลองงาน', 30,
   '2026-01-15 00:00:00', '2026-02-15 23:59:59', 'active')
ON DUPLICATE KEY UPDATE title = VALUES(title);

-- ===============================================================================
-- 10. ASSESSMENTS (การประเมินพนักงาน)
-- ===============================================================================

-- สร้างการประเมินตัวอย่างที่ใกล้หมดอายุ
SET @round1 = (SELECT id FROM assessment_rounds WHERE title LIKE '%ช่างไฟฟ้าประจำปี%' LIMIT 1);
SET @round2 = (SELECT id FROM assessment_rounds WHERE title LIKE '%ความปลอดภัย%' LIMIT 1);

INSERT INTO assessments (id, user_id, round_id, started_at, expiry_date, status, score, passed)
SELECT 
  UUID(),
  (SELECT id FROM users ORDER BY RAND() LIMIT 1),
  @round1,
  DATE_SUB(NOW(), INTERVAL FLOOR(RAND() * 20) DAY),
  DATE_ADD(NOW(), INTERVAL FLOOR(2 + RAND() * 10) DAY),
  'in_progress',
  NULL,
  NULL
FROM (SELECT 1 UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 UNION SELECT 5) AS tmp
ON DUPLICATE KEY UPDATE status = VALUES(status);

-- เพิ่มการประเมินที่เสร็จสมบูรณ์แล้ว
INSERT INTO assessments (id, user_id, round_id, started_at, finished_at, status, score, passed)
SELECT 
  UUID(),
  (SELECT id FROM users ORDER BY RAND() LIMIT 1),
  @round2,
  DATE_SUB(NOW(), INTERVAL FLOOR(10 + RAND() * 30) DAY),
  DATE_SUB(NOW(), INTERVAL FLOOR(5 + RAND() * 25) DAY),
  'completed',
  ROUND(60 + RAND() * 40, 2),
  IF(RAND() > 0.3, 1, 0)
FROM (SELECT 1 UNION SELECT 2 UNION SELECT 3) AS tmp
ON DUPLICATE KEY UPDATE status = VALUES(status);

-- ===============================================================================
-- 11. PROJECTS (โครงการ)
-- ===============================================================================

INSERT INTO projects (id, name, owner_user_id, status) VALUES
  (UUID(), 'โครงการคอนโดมิเนียมสีลม', 
   (SELECT id FROM users WHERE email = 'somchai@skillgauge.com' LIMIT 1), 'active'),
  (UUID(), 'โครงการบ้านจัดสรรลาดกระบัง',
   (SELECT id FROM users WHERE email = 'somchai@skillgauge.com' LIMIT 1), 'active'),
  (UUID(), 'โครงการตึกสำนักงานอโศก',
   (SELECT id FROM users WHERE email = 'admin@skillgauge.com' LIMIT 1), 'active')
ON DUPLICATE KEY UPDATE name = VALUES(name);

-- ===============================================================================
-- 12. SITES (สถานที่ทำงาน)
-- ===============================================================================

SET @project1 = (SELECT id FROM projects WHERE name LIKE '%คอนโดมิเนียมสีลม%' LIMIT 1);
SET @project2 = (SELECT id FROM projects WHERE name LIKE '%บ้านจัดสรร%' LIMIT 1);

INSERT INTO sites (id, project_id, name, location) VALUES
  (UUID(), @project1, 'อาคาร A', 'ชั้น 1-15'),
  (UUID(), @project1, 'อาคาร B', 'ชั้น 1-20'),
  (UUID(), @project2, 'โซน A', 'บ้านเลขที่ 1-50'),
  (UUID(), @project2, 'โซน B', 'บ้านเลขที่ 51-100')
ON DUPLICATE KEY UPDATE name = VALUES(name);

-- ===============================================================================
-- 13. TASKS (งานที่มอบหมาย)
-- ===============================================================================

SET @site1 = (SELECT id FROM sites WHERE name = 'อาคาร A' LIMIT 1);
SET @worker1 = (SELECT id FROM users WHERE email = 'somchai@skillgauge.com' LIMIT 1);

INSERT INTO tasks (id, project_id, site_id, title, priority, status, assignee_user_id, due_date) VALUES
  (UUID(), @project1, @site1, 'ติดตั้งระบบไฟฟ้าชั้น 5', 'high', 'in-progress', @worker1, DATE_ADD(CURDATE(), INTERVAL 7 DAY)),
  (UUID(), @project1, @site1, 'ตรวจสอบระบบประปาชั้น 3', 'medium', 'todo', @worker1, DATE_ADD(CURDATE(), INTERVAL 14 DAY)),
  (UUID(), @project1, @site1, 'ทาสีห้องพักชั้น 10', 'low', 'todo', NULL, DATE_ADD(CURDATE(), INTERVAL 30 DAY))
ON DUPLICATE KEY UPDATE title = VALUES(title);

-- ===============================================================================
-- 14. TRAINING RECORDS (บันทึกการอบรม)
-- ===============================================================================

CREATE TABLE IF NOT EXISTS training_records (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  worker_id INT UNSIGNED NOT NULL,
  training_title VARCHAR(255) NOT NULL,
  training_date DATE NOT NULL,
  duration_hours DECIMAL(5,2) NULL,
  trainer_name VARCHAR(120) NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'completed',
  certificate_number VARCHAR(100) NULL,
  expiry_date DATE NULL,
  notes TEXT NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  KEY idx_training_worker (worker_id),
  KEY idx_training_date (training_date),
  CONSTRAINT fk_training_worker FOREIGN KEY (worker_id) REFERENCES workers(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO training_records (worker_id, training_title, training_date, duration_hours, trainer_name, status, certificate_number, expiry_date) VALUES
  (1, 'อบรมความปลอดภัยในงานไฟฟ้า', '2025-06-15', 8.00, 'อ.สมชาย', 'completed', 'CERT-2025-001', '2027-06-15'),
  (2, 'อบรมเทคนิคการก่ออิฐสมัยใหม่', '2025-08-20', 16.00, 'อ.สมหญิง', 'completed', 'CERT-2025-002', '2027-08-20'),
  (3, 'อบรมระบบประปาและสุขาภิบาล', '2025-09-10', 12.00, 'อ.สมพร', 'completed', 'CERT-2025-003', '2027-09-10')
ON DUPLICATE KEY UPDATE training_title = VALUES(training_title);

-- ===============================================================================
-- 15. CERTIFICATIONS (ใบรับรองและใบอนุญาต)
-- ===============================================================================

CREATE TABLE IF NOT EXISTS certifications (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  worker_id INT UNSIGNED NOT NULL,
  cert_type VARCHAR(60) NOT NULL,
  cert_name VARCHAR(255) NOT NULL,
  cert_number VARCHAR(100) NULL,
  issue_date DATE NULL,
  expiry_date DATE NULL,
  issuing_authority VARCHAR(255) NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'active',
  document_url VARCHAR(500) NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  KEY idx_cert_worker (worker_id),
  KEY idx_cert_expiry (expiry_date),
  CONSTRAINT fk_cert_worker FOREIGN KEY (worker_id) REFERENCES workers(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO certifications (worker_id, cert_type, cert_name, cert_number, issue_date, expiry_date, issuing_authority, status) VALUES
  (1, 'ใบอนุญาต', 'ใบอนุญาตช่างไฟฟ้า', 'ELC-12345', '2023-01-15', '2028-01-15', 'กรมพัฒนาฝีมือแรงงาน', 'active'),
  (2, 'ใบรับรอง', 'ใบรับรองช่างก่อสร้าง', 'CON-67890', '2022-05-20', '2027-05-20', 'สภาวิศวกร', 'active'),
  (5, 'ใบอนุญาต', 'ใบอนุญาตช่างประปา', 'PLB-54321', '2021-03-10', '2026-03-10', 'กรมโรงงานอุตสาหกรรม', 'active')
ON DUPLICATE KEY UPDATE cert_name = VALUES(cert_name);

-- ===============================================================================
-- 16. ATTENDANCE (การลงเวลาทำงาน)
-- ===============================================================================

CREATE TABLE IF NOT EXISTS attendance (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  worker_id INT UNSIGNED NOT NULL,
  work_date DATE NOT NULL,
  check_in TIME NULL,
  check_out TIME NULL,
  total_hours DECIMAL(5,2) NULL,
  overtime_hours DECIMAL(5,2) NULL DEFAULT 0.00,
  status VARCHAR(30) NOT NULL DEFAULT 'present',
  project_id CHAR(36) NULL,
  site_id CHAR(36) NULL,
  notes TEXT NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  UNIQUE KEY uq_attendance (worker_id, work_date),
  KEY idx_attendance_date (work_date),
  KEY idx_attendance_status (status),
  CONSTRAINT fk_attendance_worker FOREIGN KEY (worker_id) REFERENCES workers(id) ON DELETE CASCADE,
  CONSTRAINT fk_attendance_project FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL,
  CONSTRAINT fk_attendance_site FOREIGN KEY (site_id) REFERENCES sites(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- สร้างข้อมูลการลงเวลา 30 วันย้อนหลัง
INSERT INTO attendance (worker_id, work_date, check_in, check_out, total_hours, status, project_id)
SELECT 
  w.id,
  DATE_SUB(CURDATE(), INTERVAL d.day DAY),
  '08:00:00',
  '17:00:00',
  8.00,
  IF(RAND() > 0.05, 'present', 'absent'),
  @project1
FROM workers w
CROSS JOIN (
  SELECT 0 AS day UNION SELECT 1 UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 UNION
  SELECT 5 UNION SELECT 6 UNION SELECT 7 UNION SELECT 8 UNION SELECT 9
) d
WHERE w.employment_status = 'active'
ON DUPLICATE KEY UPDATE check_in = VALUES(check_in);

-- ===============================================================================
-- 17. PERFORMANCE REVIEWS (การประเมินผลการทำงาน)
-- ===============================================================================

CREATE TABLE IF NOT EXISTS performance_reviews (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  worker_id INT UNSIGNED NOT NULL,
  review_date DATE NOT NULL,
  reviewer_name VARCHAR(120) NOT NULL,
  period_start DATE NULL,
  period_end DATE NULL,
  technical_score DECIMAL(5,2) NULL,
  quality_score DECIMAL(5,2) NULL,
  safety_score DECIMAL(5,2) NULL,
  teamwork_score DECIMAL(5,2) NULL,
  punctuality_score DECIMAL(5,2) NULL,
  overall_score DECIMAL(5,2) NULL,
  strengths TEXT NULL,
  weaknesses TEXT NULL,
  improvement_plan TEXT NULL,
  next_review_date DATE NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  KEY idx_review_worker (worker_id),
  KEY idx_review_date (review_date),
  CONSTRAINT fk_review_worker FOREIGN KEY (worker_id) REFERENCES workers(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO performance_reviews (
  worker_id, review_date, reviewer_name, period_start, period_end,
  technical_score, quality_score, safety_score, teamwork_score, punctuality_score, overall_score,
  strengths, weaknesses, improvement_plan, next_review_date
) VALUES
  (1, '2025-12-20', 'คุณสมชาย', '2025-07-01', '2025-12-31',
   85.00, 88.00, 90.00, 87.00, 92.00, 88.40,
   'มีความชำนาญในงานไฟฟ้า ทำงานรวดเร็ว', 
   'ควรพัฒนาทักษะการสื่อสารกับลูกค้า',
   'ส่งอบรมหลักสูตรการบริการลูกค้า', '2026-06-20'),
  
  (2, '2025-12-15', 'คุณสมหญิง', '2025-07-01', '2025-12-31',
   82.00, 85.00, 88.00, 90.00, 85.00, 86.00,
   'มีประสบการณ์สูง งานละเอียด', 
   'ควรเพิ่มความรวดเร็วในการทำงาน',
   'ฝึกทักษะการจัดการเวลา', '2026-06-15')
ON DUPLICATE KEY UPDATE review_date = VALUES(review_date);

-- ===============================================================================
-- 18. SALARY & PAYROLL (เงินเดือนและการจ่ายเงิน)
-- ===============================================================================

CREATE TABLE IF NOT EXISTS salary_records (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  worker_id INT UNSIGNED NOT NULL,
  pay_period_start DATE NOT NULL,
  pay_period_end DATE NOT NULL,
  base_salary DECIMAL(10,2) NOT NULL,
  overtime_pay DECIMAL(10,2) NULL DEFAULT 0.00,
  bonus DECIMAL(10,2) NULL DEFAULT 0.00,
  allowances DECIMAL(10,2) NULL DEFAULT 0.00,
  deductions DECIMAL(10,2) NULL DEFAULT 0.00,
  net_salary DECIMAL(10,2) NOT NULL,
  payment_date DATE NULL,
  payment_status VARCHAR(30) NOT NULL DEFAULT 'pending',
  payment_method VARCHAR(30) NULL,
  notes TEXT NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  KEY idx_salary_worker (worker_id),
  KEY idx_salary_period (pay_period_start, pay_period_end),
  CONSTRAINT fk_salary_worker FOREIGN KEY (worker_id) REFERENCES workers(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO salary_records (
  worker_id, pay_period_start, pay_period_end, base_salary, overtime_pay, bonus, net_salary, payment_status
) VALUES
  (1, '2025-12-01', '2025-12-31', 25000.00, 2500.00, 3000.00, 30500.00, 'paid'),
  (2, '2025-12-01', '2025-12-31', 28000.00, 1800.00, 2000.00, 31800.00, 'paid'),
  (3, '2025-12-01', '2025-12-31', 22000.00, 2200.00, 1500.00, 25700.00, 'paid')
ON DUPLICATE KEY UPDATE base_salary = VALUES(base_salary);

-- ===============================================================================
-- 19. SYSTEM SETTINGS (การตั้งค่าระบบ)
-- ===============================================================================

CREATE TABLE IF NOT EXISTS system_settings (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  setting_key VARCHAR(100) NOT NULL,
  setting_value TEXT NULL,
  setting_type VARCHAR(30) NOT NULL DEFAULT 'string',
  description TEXT NULL,
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  UNIQUE KEY uq_setting_key (setting_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO system_settings (setting_key, setting_value, setting_type, description) VALUES
  ('company_name', 'SkillGauge Thailand', 'string', 'ชื่อบริษัท'),
  ('passing_score', '60', 'number', 'คะแนนผ่านขั้นต่ำ (%)'),
  ('max_quiz_attempts', '3', 'number', 'จำนวนครั้งสูงสุดที่สามารถทำแบบทดสอบได้'),
  ('session_timeout', '12', 'number', 'เวลาหมดอายุของ session (ชั่วโมง)'),
  ('enable_notifications', 'true', 'boolean', 'เปิดใช้งานการแจ้งเตือน'),
  ('notification_email', 'admin@skillgauge.com', 'string', 'อีเมลสำหรับการแจ้งเตือน'),
  ('assessment_reminder_days', '7', 'number', 'แจ้งเตือนก่อนการประเมินหมดอายุ (วัน)'),
  ('certificate_validity_years', '2', 'number', 'อายุใบรับรอง (ปี)')
ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value);

-- ===============================================================================
-- 20. NOTIFICATIONS (การแจ้งเตือน)
-- ===============================================================================

CREATE TABLE IF NOT EXISTS notifications (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id CHAR(36) NULL,
  worker_id INT UNSIGNED NULL,
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  type VARCHAR(30) NOT NULL DEFAULT 'info',
  status VARCHAR(30) NOT NULL DEFAULT 'unread',
  link_url VARCHAR(500) NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  read_at DATETIME(6) NULL,
  PRIMARY KEY (id),
  KEY idx_notification_user (user_id),
  KEY idx_notification_worker (worker_id),
  KEY idx_notification_status (status),
  KEY idx_notification_created (created_at),
  CONSTRAINT fk_notification_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_notification_worker FOREIGN KEY (worker_id) REFERENCES workers(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO notifications (user_id, title, message, type, status) VALUES
  ((SELECT id FROM users LIMIT 1), 'แบบทดสอบรอการอนุมัติ', 'มีแบบทดสอบ 2 รายการรอการอนุมัติ', 'warning', 'unread'),
  ((SELECT id FROM users LIMIT 1 OFFSET 1), 'การประเมินใกล้หมดอายุ', 'การประเมินของคุณจะหมดอายุใน 5 วัน', 'warning', 'unread')
ON DUPLICATE KEY UPDATE message = VALUES(message);

-- ===============================================================================
-- สิ้นสุดการโหลดข้อมูล
-- ===============================================================================

-- แสดงสถิติข้อมูลที่โหลด
SELECT 'ข้อมูลที่โหลดเสร็จสมบูรณ์' AS status;
SELECT 'Roles' AS table_name, COUNT(*) AS record_count FROM roles
UNION ALL
SELECT 'Users', COUNT(*) FROM users
UNION ALL
SELECT 'Workers', COUNT(*) FROM workers
UNION ALL
SELECT 'Departments', COUNT(*) FROM departments
UNION ALL
SELECT 'Trade Types', COUNT(*) FROM trade_types
UNION ALL
SELECT 'Questions', COUNT(*) FROM questions
UNION ALL
SELECT 'Quizzes', COUNT(*) FROM quizzes
UNION ALL
SELECT 'Assessment Rounds', COUNT(*) FROM assessment_rounds
UNION ALL
SELECT 'Assessments', COUNT(*) FROM assessments
UNION ALL
SELECT 'Projects', COUNT(*) FROM projects
UNION ALL
SELECT 'Tasks', COUNT(*) FROM tasks
UNION ALL
SELECT 'Training Records', COUNT(*) FROM training_records
UNION ALL
SELECT 'Certifications', COUNT(*) FROM certifications
UNION ALL
SELECT 'System Settings', COUNT(*) FROM system_settings;

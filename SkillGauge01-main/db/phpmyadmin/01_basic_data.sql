-- ===============================================================================
-- SkillGauge - ข้อมูลพื้นฐานระบบ (สำหรับ phpMyAdmin)
-- ===============================================================================
-- คำแนะนำ: Copy ทีละส่วนแล้ววางใน phpMyAdmin SQL tab แล้วกด Go
-- ===============================================================================

-- ส่วนที่ 1: บทบาทและสิทธิ์
-- ===============================================================================

INSERT INTO roles (id, `key`, description) VALUES
  (1, 'admin', 'ผู้ดูแลระบบ - มีสิทธิ์เต็มทุกอย่าง'),
  (2, 'project_manager', 'ผู้จัดการโครงการ - จัดการโปรเจคและทีม'),
  (3, 'worker', 'พนักงาน - ใช้งานทั่วไปและทำแบบทดสอบ'),
  (4, 'hr', 'ฝ่ายบุคคล - จัดการข้อมูลพนักงาน'),
  (5, 'trainer', 'ผู้อบรม - สร้างและจัดการแบบทดสอบ')
ON DUPLICATE KEY UPDATE description = VALUES(description);

-- ===============================================================================
-- ส่วนที่ 2: ผู้ใช้งานระบบ
-- ===============================================================================

INSERT INTO users (id, full_name, phone, email, password_hash, status, created_at) VALUES
  ('a1b2c3d4-1111-1111-1111-111111111111', 'ผู้ดูแลระบบ Admin', '0812345678', 'admin@skillgauge.com', 
   '$2a$10$YourHashedPasswordHere', 'active', NOW()),
  ('a1b2c3d4-2222-2222-2222-222222222222', 'สมชาย ใจดี', '0823456789', 'somchai@skillgauge.com', 
   '$2a$10$YourHashedPasswordHere', 'active', NOW()),
  ('a1b2c3d4-3333-3333-3333-333333333333', 'สมหญิง รักงาน', '0834567890', 'somying@skillgauge.com', 
   '$2a$10$YourHashedPasswordHere', 'active', NOW())
ON DUPLICATE KEY UPDATE full_name = VALUES(full_name);

-- กำหนดบทบาทให้ผู้ใช้
INSERT INTO user_roles (user_id, role_id, assigned_at)
SELECT id, 1, NOW() FROM users WHERE email = 'admin@skillgauge.com'
ON DUPLICATE KEY UPDATE assigned_at = VALUES(assigned_at);

INSERT INTO user_roles (user_id, role_id, assigned_at)
SELECT id, 2, NOW() FROM users WHERE email = 'somchai@skillgauge.com'
ON DUPLICATE KEY UPDATE assigned_at = VALUES(assigned_at);

INSERT INTO user_roles (user_id, role_id, assigned_at)
SELECT id, 3, NOW() FROM users WHERE email = 'somying@skillgauge.com'
ON DUPLICATE KEY UPDATE assigned_at = VALUES(assigned_at);

-- ===============================================================================
-- ส่วนที่ 3: แผนกและประเภทงาน
-- ===============================================================================

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
-- ส่วนที่ 4: ข้อมูลพนักงาน
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
-- เสร็จสิ้น - ข้อมูลพื้นฐาน
-- ===============================================================================

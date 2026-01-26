-- ===============================================================================
-- SkillGauge - โครงการและงาน (สำหรับ phpMyAdmin)
-- ===============================================================================

-- ส่วนที่ 1: โครงการ (Projects)
-- ===============================================================================

-- ใช้ subquery เพื่อหา user_id ที่มีอยู่จริง
SET @pm_user_id = (SELECT id FROM users WHERE email = 'somchai@skillgauge.com' LIMIT 1);
SET @admin_user_id = (SELECT id FROM users WHERE email = 'admin@skillgauge.com' LIMIT 1);

INSERT INTO projects (id, name, owner_user_id, status, created_at) VALUES
  (UUID(), 'โครงการคอนโดมิเนียมสีลม', @pm_user_id, 'active', NOW()),
  (UUID(), 'โครงการบ้านจัดสรรลาดกระบัง', @pm_user_id, 'active', NOW()),
  (UUID(), 'โครงการตึกสำนักงานอโศก', @admin_user_id, 'active', NOW()),
  (UUID(), 'โครงการโรงแรมพัทยา', @pm_user_id, 'active', NOW()),
  (UUID(), 'โครงการโรงงานชลบุรี', @pm_user_id, 'active', NOW())
ON DUPLICATE KEY UPDATE name = VALUES(name);

-- ===============================================================================
-- ส่วนที่ 2: ตารางเสริม - การอบรม
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

-- ใช้ subquery หา worker_id จาก national_id
INSERT INTO training_records (worker_id, training_title, training_date, duration_hours, trainer_name, status, certificate_number, expiry_date)
SELECT w.id, 'อบรมความปลอดภัยในงานไฟฟ้า', '2025-06-15', 8.00, 'อ.สมชาย', 'completed', 'CERT-2025-001', '2027-06-15'
FROM workers w WHERE w.national_id = '1234567890123'
UNION ALL
SELECT w.id, 'อบรมเทคนิคการก่ออิฐสมัยใหม่', '2025-08-20', 16.00, 'อ.สมหญิง', 'completed', 'CERT-2025-002', '2027-08-20'
FROM workers w WHERE w.national_id = '2345678901234'
UNION ALL
SELECT w.id, 'อบรมระบบประปาและสุขาภิบาล', '2025-09-10', 12.00, 'อ.สมพร', 'completed', 'CERT-2025-003', '2027-09-10'
FROM workers w WHERE w.national_id = '3456789012345'
UNION ALL
SELECT w.id, 'อบรมเทคนิคการทาสีและพ่นสี', '2025-07-05', 10.00, 'อ.สมบูรณ์', 'completed', 'CERT-2025-004', '2027-07-05'
FROM workers w WHERE w.national_id = '4567890123456'
UNION ALL
SELECT w.id, 'อบรมการซ่อมบำรุงระบบประปา', '2025-10-15', 14.00, 'อ.สมหวัง', 'completed', 'CERT-2025-005', '2027-10-15'
FROM workers w WHERE w.national_id = '5678901234567'
UNION ALL
SELECT w.id, 'อบรมระบบไฟฟ้าแรงสูง', '2025-11-20', 16.00, 'อ.สมใจ', 'completed', 'CERT-2025-006', '2027-11-20'
FROM workers w WHERE w.national_id = '6789012345678'
UNION ALL
SELECT w.id, 'อบรมระบบปรับอากาศและทำความเย็น', '2025-09-25', 20.00, 'อ.สมคิด', 'completed', 'CERT-2025-007', '2027-09-25'
FROM workers w WHERE w.national_id = '7890123456789'
ON DUPLICATE KEY UPDATE training_title = VALUES(training_title);

-- ===============================================================================
-- ส่วนที่ 3: ใบรับรองและใบอนุญาต
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

-- ใช้ subquery หา worker_id จาก national_id  
INSERT INTO certifications (worker_id, cert_type, cert_name, cert_number, issue_date, expiry_date, issuing_authority, status)
SELECT w.id, 'ใบอนุญาต', 'ใบอนุญาตช่างไฟฟ้า', 'ELC-12345', '2023-01-15', '2028-01-15', 'กรมพัฒนาฝีมือแรงงาน', 'active'
FROM workers w WHERE w.national_id = '1234567890123'
UNION ALL
SELECT w.id, 'ใบรับรอง', 'ใบรับรองช่างก่อสร้าง', 'CON-67890', '2022-05-20', '2027-05-20', 'สภาวิศวกร', 'active'
FROM workers w WHERE w.national_id = '2345678901234'
UNION ALL
SELECT w.id, 'ใบอนุญาต', 'ใบอนุญาตช่างประปา', 'PLB-54321', '2021-03-10', '2026-03-10', 'กรมโรงงานอุตสาหกรรม', 'active'
FROM workers w WHERE w.national_id = '3456789012345'
UNION ALL
SELECT w.id, 'ใบอนุญาต', 'ใบอนุญาตช่างประปาชั้นสูง', 'PLB-99999', '2020-08-15', '2025-08-15', 'กรมโรงงานอุตสาหกรรม', 'active'
FROM workers w WHERE w.national_id = '5678901234567'
UNION ALL
SELECT w.id, 'ใบรับรอง', 'ใบรับรองช่างไฟฟ้าระดับสูง', 'ELC-77777', '2023-03-20', '2028-03-20', 'กรมพัฒนาฝีมือแรงงาน', 'active'
FROM workers w WHERE w.national_id = '6789012345678'
UNION ALL
SELECT w.id, 'ใบอนุญาต', 'ใบอนุญาตช่างทำความเย็น', 'HVAC-11111', '2022-06-10', '2027-06-10', 'กรมโรงงานอุตสาหกรรม', 'active'
FROM workers w WHERE w.national_id = '7890123456789'
ON DUPLICATE KEY UPDATE cert_name = VALUES(cert_name);

-- ===============================================================================
-- ส่วนที่ 4: การประเมินผลการทำงาน
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

-- ใช้ subquery หา worker_id
INSERT INTO performance_reviews (
  worker_id, review_date, reviewer_name, period_start, period_end,
  technical_score, quality_score, safety_score, teamwork_score, punctuality_score, overall_score,
  strengths, weaknesses, improvement_plan, next_review_date
)
SELECT 
  w.id, '2025-12-20', 'คุณสมชาย', '2025-07-01', '2025-12-31',
  85.00, 88.00, 90.00, 87.00, 92.00, 88.40,
  'มีความชำนาญในงานไฟฟ้า ทำงานรวดเร็ว มีความรับผิดชอบสูง', 
  'ควรพัฒนาทักษะการสื่อสารกับลูกค้า และการทำงานเป็นทีม',
  'ส่งอบรมหลักสูตรการบริการลูกค้าและการทำงานเป็นทีม', '2026-06-20'
FROM workers w WHERE w.national_id = '1234567890123'
UNION ALL
SELECT 
  w.id, '2025-12-15', 'คุณสมหญิง', '2025-07-01', '2025-12-31',
  82.00, 85.00, 88.00, 90.00, 85.00, 86.00,
  'มีประสบการณ์สูง งานละเอียด คุณภาพดี', 
  'ควรเพิ่มความรวดเร็วในการทำงาน',
  'ฝึกทักษะการจัดการเวลาและเทคนิคการทำงานอย่างมีประสิทธิภาพ', '2026-06-15'
FROM workers w WHERE w.national_id = '2345678901234'
UNION ALL
SELECT 
  w.id, '2025-12-10', 'คุณสมพร', '2025-07-01', '2025-12-31',
  80.00, 83.00, 85.00, 88.00, 87.00, 84.60,
  'ทำงานมั่นใจ แก้ปัญหาเป็น ช่วยเหลือเพื่อนร่วมงาน', 
  'ควรเรียนรู้เทคโนโลยีใหม่ๆ ในงานประปา',
  'ส่งอบรมหลักสูตรระบบประปาสมัยใหม่', '2026-06-10'
FROM workers w WHERE w.national_id = '3456789012345'
UNION ALL
SELECT 
  w.id, '2025-12-05', 'คุณสมบูรณ์', '2025-07-01', '2025-12-31',
  78.00, 80.00, 82.00, 85.00, 90.00, 83.00,
  'ทาสีสวยงาม ตรงเวลา มีความรับผิดชอบ', 
  'ควรพัฒนาทักษะการเลือกใช้วัสดุให้เหมาะสม',
  'ศึกษาเพิ่มเติมเรื่องคุณสมบัติของสี และการเลือกใช้', '2026-06-05'
FROM workers w WHERE w.national_id = '4567890123456'
ON DUPLICATE KEY UPDATE review_date = VALUES(review_date);

-- ===============================================================================
-- ส่วนที่ 5: การตั้งค่าระบบ
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
  ('certificate_validity_years', '2', 'number', 'อายุใบรับรอง (ปี)'),
  ('working_hours_per_day', '8', 'number', 'จำนวนชั่วโมงการทำงานต่อวัน'),
  ('overtime_rate', '1.5', 'number', 'อัตราค่าล่วงเวลา (เท่า)'),
  ('holiday_rate', '2', 'number', 'อัตราค่าทำงานวันหยุด (เท่า)')
ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value);

-- ===============================================================================
-- ส่วนที่ 6: การแจ้งเตือน
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

-- ใช้ค่า user_id ที่หามาแล้ว
INSERT INTO notifications (user_id, title, message, type, status, created_at) VALUES
  (@admin_user_id, 'แบบทดสอบรอการอนุมัติ', 'มีแบบทดสอบ 3 รายการรอการอนุมัติ', 'warning', 'unread', NOW()),
  (@admin_user_id, 'การประเมินใกล้หมดอายุ', 'มีการประเมิน 5 รายการที่ใกล้หมดอายุภายใน 7 วัน', 'warning', 'unread', NOW()),
  (@pm_user_id, 'พนักงานใหม่เข้าระบบ', 'มีพนักงานใหม่ 2 คนรอการอนุมัติ', 'info', 'unread', NOW()),
  (@admin_user_id, 'ใบรับรองใกล้หมดอายุ', 'มีใบรับรอง 2 รายการที่จะหมดอายุในเดือนหน้า', 'warning', 'unread', NOW())
ON DUPLICATE KEY UPDATE message = VALUES(message);

-- ===============================================================================
-- เสร็จสิ้น - โครงการและข้อมูลเสริม
-- ===============================================================================

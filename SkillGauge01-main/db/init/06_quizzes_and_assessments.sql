-- เพิ่มตารางสำหรับจัดการแบบทดสอบ (Quizzes)
CREATE TABLE IF NOT EXISTS quizzes (
  id CHAR(36) NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT NULL,
  category VARCHAR(120) NULL,
  subcategory VARCHAR(120) NULL,
  difficulty VARCHAR(60) NULL,
  question_count INT UNSIGNED NOT NULL DEFAULT 0,
  passing_score DECIMAL(5,2) NULL DEFAULT 60.00,
  time_limit_minutes INT UNSIGNED NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'pending',  -- pending, approved, rejected, archived
  created_by VARCHAR(255) NULL,
  approved_by VARCHAR(255) NULL,
  approved_at DATETIME(6) NULL,
  rejected_reason TEXT NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  KEY idx_quizzes_status (status),
  KEY idx_quizzes_category (category),
  KEY idx_quizzes_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- เพิ่มคอลัมน์ status สำหรับ assessment_rounds ถ้ายังไม่มี
-- ตรวจสอบว่ามีคอลัมน์อยู่แล้วหรือไม่
SET @col_exists = 0;
SELECT COUNT(*) INTO @col_exists 
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_SCHEMA = 'admin-worker-registration' 
  AND TABLE_NAME = 'assessment_rounds' 
  AND COLUMN_NAME = 'status';

SET @query = IF(@col_exists = 0, 
  'ALTER TABLE assessment_rounds ADD COLUMN status VARCHAR(30) NOT NULL DEFAULT ''active'' AFTER frequency_months', 
  'SELECT ''Column status already exists'' AS message');
PREPARE stmt FROM @query;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- เพิ่ม index
SET @idx_exists = 0;
SELECT COUNT(*) INTO @idx_exists 
FROM INFORMATION_SCHEMA.STATISTICS 
WHERE TABLE_SCHEMA = 'admin-worker-registration' 
  AND TABLE_NAME = 'assessment_rounds' 
  AND INDEX_NAME = 'idx_assessment_rounds_status';

SET @query = IF(@idx_exists = 0, 
  'ALTER TABLE assessment_rounds ADD INDEX idx_assessment_rounds_status (status)', 
  'SELECT ''Index idx_assessment_rounds_status already exists'' AS message');
PREPARE stmt FROM @query;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- เพิ่มคอลัมน์ที่จำเป็นสำหรับการประเมิน
SET @col_exists = 0;
SELECT COUNT(*) INTO @col_exists 
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_SCHEMA = 'admin-worker-registration' 
  AND TABLE_NAME = 'assessments' 
  AND COLUMN_NAME = 'round_id';

SET @query = IF(@col_exists = 0, 
  'ALTER TABLE assessments ADD COLUMN round_id CHAR(36) NULL AFTER user_id', 
  'SELECT ''Column round_id already exists'' AS message');
PREPARE stmt FROM @query;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @col_exists = 0;
SELECT COUNT(*) INTO @col_exists 
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_SCHEMA = 'admin-worker-registration' 
  AND TABLE_NAME = 'assessments' 
  AND COLUMN_NAME = 'expiry_date';

SET @query = IF(@col_exists = 0, 
  'ALTER TABLE assessments ADD COLUMN expiry_date DATETIME(6) NULL AFTER finished_at', 
  'SELECT ''Column expiry_date already exists'' AS message');
PREPARE stmt FROM @query;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @col_exists = 0;
SELECT COUNT(*) INTO @col_exists 
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_SCHEMA = 'admin-worker-registration' 
  AND TABLE_NAME = 'assessments' 
  AND COLUMN_NAME = 'status';

SET @query = IF(@col_exists = 0, 
  'ALTER TABLE assessments ADD COLUMN status VARCHAR(30) NOT NULL DEFAULT ''pending'' AFTER passed', 
  'SELECT ''Column status already exists'' AS message');
PREPARE stmt FROM @query;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ตารางเชื่อมโยงระหว่าง quizzes และ questions
CREATE TABLE IF NOT EXISTS quiz_questions (
  quiz_id CHAR(36) NOT NULL,
  question_id CHAR(36) NOT NULL,
  order_index INT UNSIGNED NOT NULL DEFAULT 0,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (quiz_id, question_id),
  KEY idx_quiz_questions_quiz (quiz_id),
  KEY idx_quiz_questions_question (question_id),
  CONSTRAINT fk_quiz_questions_quiz FOREIGN KEY (quiz_id) REFERENCES quizzes(id) ON DELETE CASCADE,
  CONSTRAINT fk_quiz_questions_question FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ข้อมูลตัวอย่างสำหรับทดสอบ
INSERT IGNORE INTO quizzes (id, title, description, category, question_count, status, created_by, created_at) VALUES
  (UUID(), 'แบบทดสอบทักษะช่างไฟฟ้า', 'ทดสอบความรู้พื้นฐานด้านไฟฟ้า', 'ช่างไฟฟ้า', 20, 'pending', 'ผู้สอบ A', NOW()),
  (UUID(), 'แบบทดสอบความปลอดภัย', 'ทดสอบความรู้ด้านความปลอดภัยในการทำงาน', 'ความปลอดภัย', 15, 'pending', 'ผู้สอบ B', NOW()),
  (UUID(), 'แบบทดสอบช่างก่อสร้าง', 'ทดสอบทักษะการก่อสร้างพื้นฐาน', 'ช่างก่อสร้าง', 25, 'approved', 'ผู้สอบ C', DATE_SUB(NOW(), INTERVAL 5 DAY));

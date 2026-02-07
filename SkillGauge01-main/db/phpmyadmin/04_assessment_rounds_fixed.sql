-- ==================================================================================
-- SkillGauge - Assessment Rounds Table
-- สำหรับเก็บโครงสร้างข้อสอบและการตั้งค่ากิจกรรมข้อสอบ
-- ==================================================================================

DROP TABLE IF EXISTS assessment_rounds;

CREATE TABLE assessment_rounds (
  id CHAR(36) PRIMARY KEY,
  category VARCHAR(100) NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT NULL,
  
  question_count INT UNSIGNED NOT NULL DEFAULT 60,
  passing_score DECIMAL(5,2) NOT NULL DEFAULT 60.00,
  duration_minutes INT UNSIGNED NOT NULL DEFAULT 60,
  
  start_at DATETIME NULL,
  end_at DATETIME NULL,
  frequency_months INT UNSIGNED NULL,
  
  show_score TINYINT(1) NOT NULL DEFAULT 1,
  show_answers TINYINT(1) NOT NULL DEFAULT 0,
  show_breakdown TINYINT(1) NOT NULL DEFAULT 1,
  
  subcategory_quotas TEXT NULL,
  difficulty_weights TEXT NULL,
  criteria TEXT NULL,
  
  status VARCHAR(50) NOT NULL DEFAULT 'draft',
  active TINYINT(1) NOT NULL DEFAULT 1,
  history TEXT NULL,
  
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_by VARCHAR(100) NULL,
  updated_by VARCHAR(100) NULL,
  
  KEY idx_category (category),
  KEY idx_status (status),
  KEY idx_active (active),
  KEY idx_start_end (start_at, end_at),
  KEY idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==================================================================================
-- ข้อมูลตัวอย่าง
-- ==================================================================================

INSERT INTO assessment_rounds (
  id, category, title, description,
  question_count, passing_score, duration_minutes,
  frequency_months, show_score, show_answers, show_breakdown,
  subcategory_quotas, difficulty_weights, criteria,
  status, created_by
) VALUES
(
  '11111111-1111-1111-1111-111111111111',
  'structure',
  'ข้อสอบโครงสร้างระดับ 1',
  'ข้อสอบโครงสร้างสำหรับระดับพื้นฐาน',
  60,
  60.00,
  60,
  6,
  1,
  0,
  1,
  '{"rebar":{"pct":20,"count":12},"concrete":{"pct":20,"count":12},"formwork":{"pct":20,"count":12},"tools":{"pct":20,"count":12},"theory":{"pct":20,"count":12}}',
  '{"easy":100,"medium":0,"hard":0}',
  '{"level1":60,"level2":70,"level3":80}',
  'active',
  'admin'
),
(
  '22222222-2222-2222-2222-222222222222',
  'structure',
  'ข้อสอบโครงสร้างระดับ 2',
  'ข้อสอบโครงสร้างสำหรับระดับกลาง',
  60,
  70.00,
  60,
  6,
  1,
  0,
  1,
  '{"rebar":{"pct":20,"count":12},"concrete":{"pct":20,"count":12},"formwork":{"pct":20,"count":12},"tools":{"pct":20,"count":12},"theory":{"pct":20,"count":12}}',
  '{"easy":0,"medium":100,"hard":0}',
  '{"level1":60,"level2":70,"level3":80}',
  'active',
  'admin'
),
(
  '33333333-3333-3333-3333-333333333333',
  'plumbing',
  'ข้อสอบประปาระดับ 1',
  'ข้อสอบประปาสำหรับระดับพื้นฐาน',
  60,
  60.00,
  60,
  6,
  1,
  0,
  1,
  '{}',
  '{"easy":100,"medium":0,"hard":0}',
  '{"level1":60,"level2":70,"level3":80}',
  'active',
  'admin'
);

-- ตรวจสอบข้อมูล
SELECT * FROM assessment_rounds;

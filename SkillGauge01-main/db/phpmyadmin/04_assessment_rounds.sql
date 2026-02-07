-- ===============================================================================
-- SkillGauge - โครงสร้างข้อสอบ (Assessment Rounds)
-- ===============================================================================

-- ตารางสำหรับเก็บโครงสร้างข้อสอบ/กิจกรรมข้อสอบ
CREATE TABLE IF NOT EXISTS assessment_rounds (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  category VARCHAR(100) NOT NULL COMMENT 'ประเภทช่าง: structure, plumbing, roofing, etc.',
  title VARCHAR(255) NOT NULL COMMENT 'ชื่อกิจกรรมข้อสอบ',
  description TEXT NULL COMMENT 'คำอธิบายรายละเอียด',
  
  -- การตั้งค่าข้อสอบพื้นฐาน
  question_count INT UNSIGNED NOT NULL DEFAULT 60 COMMENT 'จำนวนข้อสอบทั้งหมด',
  passing_score DECIMAL(5,2) NOT NULL DEFAULT 60.00 COMMENT 'เกณฑ์ผ่าน (%)',
  duration_minutes INT UNSIGNED NOT NULL DEFAULT 60 COMMENT 'เวลาทำข้อสอบ (นาที)',
  
  -- ช่วงเวลาการจัดสอบ
  start_at DATETIME NULL COMMENT 'เวลาเริ่มต้น',
  end_at DATETIME NULL COMMENT 'เวลาสิ้นสุด',
  frequency_months INT UNSIGNED NULL COMMENT 'ความถี่การสอบ (เดือน)',
  
  -- การแสดงผลและสิทธิ์
  show_score TINYINT(1) NOT NULL DEFAULT 1 COMMENT 'แสดงคะแนนหรือไม่',
  show_answers TINYINT(1) NOT NULL DEFAULT 0 COMMENT 'แสดงเฉลยหรือไม่',
  show_breakdown TINYINT(1) NOT NULL DEFAULT 1 COMMENT 'แสดงสรุปรายหมวดหมู่ย่อยหรือไม่',
  
  -- โครงสร้างข้อสอบ (JSON)
  subcategory_quotas JSON NULL COMMENT 'สัดส่วนหมวดหมู่ย่อย {subcategory: {pct: number, count: number}}',
  difficulty_weights JSON NULL COMMENT 'น้ำหนักความยาก {easy: number, medium: number, hard: number}',
  criteria JSON NULL COMMENT 'เกณฑ์การผ่าน {level1: number, level2: number, level3: number}',
  
  -- สถานะและประวัติ
  status VARCHAR(50) NOT NULL DEFAULT 'draft' COMMENT 'draft, active, archived',
  active TINYINT(1) NOT NULL DEFAULT 1,
  history JSON NULL COMMENT 'ประวัติการแก้ไข [{timestamp, user, action}]',
  
  -- Timestamps และ Audit
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_by VARCHAR(100) NULL,
  updated_by VARCHAR(100) NULL,
  
  -- Indexes
  KEY idx_category (category),
  KEY idx_status (status),
  KEY idx_active (active),
  KEY idx_start_end (start_at, end_at),
  KEY idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='ตารางเก็บโครงสร้างข้อสอบและการตั้งค่ากิจกรรมข้อสอบ';

-- ===============================================================================
-- ข้อมูลตัวอย่าง (Sample Data)
-- ===============================================================================

INSERT INTO assessment_rounds (
  id, category, title, description,
  question_count, passing_score, duration_minutes,
  frequency_months, show_score, show_answers, show_breakdown,
  subcategory_quotas, difficulty_weights, criteria,
  status, created_by
) VALUES
(
  UUID(),
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
  JSON_OBJECT(
    'rebar', JSON_OBJECT('pct', 20, 'count', 12),
    'concrete', JSON_OBJECT('pct', 20, 'count', 12),
    'formwork', JSON_OBJECT('pct', 20, 'count', 12),
    'tools', JSON_OBJECT('pct', 20, 'count', 12),
    'theory', JSON_OBJECT('pct', 20, 'count', 12)
  ),
  JSON_OBJECT('easy', 100, 'medium', 0, 'hard', 0),
  JSON_OBJECT('level1', 60, 'level2', 70, 'level3', 80),
  'active',
  'admin'
),
(
  UUID(),
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
  JSON_OBJECT(
    'rebar', JSON_OBJECT('pct', 20, 'count', 12),
    'concrete', JSON_OBJECT('pct', 20, 'count', 12),
    'formwork', JSON_OBJECT('pct', 20, 'count', 12),
    'tools', JSON_OBJECT('pct', 20, 'count', 12),
    'theory', JSON_OBJECT('pct', 20, 'count', 12)
  ),
  JSON_OBJECT('easy', 0, 'medium', 100, 'hard', 0),
  JSON_OBJECT('level1', 60, 'level2', 70, 'level3', 80),
  'active',
  'admin'
),
(
  UUID(),
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
  JSON_OBJECT(),
  JSON_OBJECT('easy', 100, 'medium', 0, 'hard', 0),
  JSON_OBJECT('level1', 60, 'level2', 70, 'level3', 80),
  'active',
  'admin'
)
ON DUPLICATE KEY UPDATE updated_at = NOW();

-- ===============================================================================
-- Indexes สำหรับ Performance
-- ===============================================================================

-- สร้าง Virtual Column สำหรับ JSON queries (MySQL 5.7+)
ALTER TABLE assessment_rounds 
  ADD COLUMN target_level VARCHAR(20) 
  GENERATED ALWAYS AS (
    CASE 
      WHEN JSON_EXTRACT(difficulty_weights, '$.easy') = 100 THEN 'easy'
      WHEN JSON_EXTRACT(difficulty_weights, '$.medium') = 100 THEN 'medium'
      WHEN JSON_EXTRACT(difficulty_weights, '$.hard') = 100 THEN 'hard'
      ELSE 'mixed'
    END
  ) VIRTUAL;

CREATE INDEX idx_target_level ON assessment_rounds(target_level);

-- ===============================================================================
-- Comments อธิบายตาราง
-- ===============================================================================

-- อธิบายโครงสร้าง JSON
-- subcategory_quotas: {
--   "rebar": {"pct": 20, "count": 12},
--   "concrete": {"pct": 20, "count": 12}
-- }
--
-- difficulty_weights: {
--   "easy": 40,
--   "medium": 40,
--   "hard": 20
-- }
--
-- criteria: {
--   "level1": 60,  -- เกณฑ์ผ่านระดับ 1
--   "level2": 70,  -- เกณฑ์ผ่านระดับ 2
--   "level3": 80   -- เกณฑ์ผ่านระดับ 3
-- }
--
-- history: [
--   {"timestamp": "2026-02-06T10:30:00", "user": "admin", "action": "Created"},
--   {"timestamp": "2026-02-06T11:30:00", "user": "admin", "action": "Updated question count"}
-- ]

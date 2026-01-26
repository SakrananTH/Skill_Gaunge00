-- Add subcategory support to questions table
-- Migration: Add subcategory column and create subcategories lookup table

-- Create subcategories lookup table
CREATE TABLE IF NOT EXISTS subcategories (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  category VARCHAR(120) NOT NULL COMMENT 'Parent category (structure, plumbing, etc.)',
  `key` VARCHAR(100) NOT NULL COMMENT 'Unique identifier (rebar, concrete, etc.)',
  label VARCHAR(255) NOT NULL COMMENT 'Display name in Thai',
  description TEXT NULL,
  question_count INT UNSIGNED NULL COMMENT 'Target number of questions for this subcategory',
  percentage DECIMAL(5,2) NULL COMMENT 'Percentage of total questions (e.g., 25.00)',
  display_order INT UNSIGNED NOT NULL DEFAULT 0,
  active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  UNIQUE KEY uq_subcategories_category_key (category, `key`),
  KEY idx_subcategories_category (category),
  KEY idx_subcategories_active (active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Subcategories for organizing questions within main categories';

-- Add subcategory column to questions table
ALTER TABLE questions 
ADD COLUMN subcategory VARCHAR(100) NULL COMMENT 'Subcategory key (rebar, concrete, formwork, etc.)' AFTER category,
ADD KEY idx_questions_subcategory (subcategory);

-- Insert subcategories for structure category (โครงสร้าง)
INSERT INTO subcategories (category, `key`, label, description, question_count, percentage, display_order, active) VALUES
('structure', 'rebar', '1. งานเหล็กเสริม (Rebar)', 'รวมการทำเหล็กเสริม, วะตาแบบ, การฉบอย, มาตรฐานเหล็ดี', 15, 25.00, 1, 1),
('structure', 'concrete', '2. งานคอนกรีต (Concrete)', 'รวมวัคอง, การกลอฉ, การปก, การรด, การตรกฉอบ Slump', 15, 25.00, 2, 1),
('structure', 'formwork', '3. งานไม้แบบ (Formwork)', 'รวมการติดมอบ, คาสา, น้ำรว, ความปลอดภัย', 12, 20.00, 3, 1),
('structure', 'tools', '4. องค์ความรู้/คาม/เครื่องมือ/คุณภาพ', 'รายละเอียดทุ่ดคด, ระบตาแบบ, ตื่มหนัอนตุ่ดตก, ความตรตาอดุบา', 12, 20.00, 4, 1),
('structure', 'theory', '5. ทฤษฎีแบบ/พฤติ (Design Theory)', 'ความรู้ตั้วโคราก่ราวอิ่ง, ตามทความวิฐี', 6, 10.00, 5, 1);

-- Note: Add more subcategories for other categories (plumbing, roofing, etc.) as needed
-- Example for plumbing:
-- INSERT INTO subcategories (category, `key`, label, description, question_count, percentage, display_order, active) VALUES
-- ('plumbing', 'pipes', 'งานท่อ', 'การติดตั้งและซ่อมแซมท่อ', 20, 33.33, 1, 1),
-- ('plumbing', 'fixtures', 'งานสุขภัณฑ์', 'การติดตั้งอุปกรณ์สุขภัณฑ์', 20, 33.33, 2, 1),
-- ('plumbing', 'drainage', 'งานระบายน้ำ', 'ระบบระบายน้ำและท่อระบายน้ำ', 20, 33.34, 3, 1);

-- Create index for better query performance
CREATE INDEX idx_questions_category_subcategory ON questions(category, subcategory);

-- Migration completed
-- Note: Existing questions will have NULL subcategory until manually updated

-- ===============================================================================
-- SkillGauge - STEP 0: โครงสร้างตาราง (Run First)
-- ===============================================================================

DROP TABLE IF EXISTS question_Structural;

CREATE TABLE question_Structural (
  id INT AUTO_INCREMENT PRIMARY KEY,
  question_text TEXT NOT NULL,
  choice_a VARCHAR(255) NOT NULL,
  choice_b VARCHAR(255) NOT NULL,
  choice_c VARCHAR(255) NOT NULL,
  choice_d VARCHAR(255) NOT NULL,
  answer CHAR(1) NOT NULL, -- 'a', 'b', 'c', 'd'
  set_no INT NOT NULL DEFAULT 1, -- 1=Level 1, 2=Level 2, 3=Level 3
  category VARCHAR(100) DEFAULT 'Structure'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

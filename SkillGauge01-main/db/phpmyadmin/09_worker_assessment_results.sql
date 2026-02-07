-- ===============================================================================
-- SkillGauge - Worker Assessment Results (สำหรับ phpMyAdmin)
-- ===============================================================================

CREATE TABLE IF NOT EXISTS worker_assessment_results (
  id CHAR(36) NOT NULL,
  worker_id INT UNSIGNED NOT NULL,
  round_id CHAR(36) NULL,
  session_id CHAR(36) NULL,
  category VARCHAR(120) NOT NULL DEFAULT 'structure',
  total_score INT UNSIGNED NOT NULL DEFAULT 0,
  total_questions INT UNSIGNED NOT NULL DEFAULT 0,
  passed TINYINT(1) NOT NULL DEFAULT 0,
  breakdown JSON NULL,
  finished_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  UNIQUE KEY uq_worker_assessment_once (worker_id, category),
  KEY idx_worker_assessment_round (round_id),
  KEY idx_worker_assessment_worker (worker_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

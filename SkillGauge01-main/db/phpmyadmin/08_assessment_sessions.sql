-- ===============================================================================
-- SkillGauge - Assessment Sessions (สำหรับ phpMyAdmin)
-- ===============================================================================

CREATE TABLE IF NOT EXISTS assessment_sessions (
  id CHAR(36) NOT NULL,
  round_id CHAR(36) NOT NULL,
  worker_id INT UNSIGNED NULL,
  user_id CHAR(36) NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'in_progress',
  started_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  finished_at DATETIME(6) NULL,
  last_seen_at DATETIME(6) NULL,
  question_count INT UNSIGNED NOT NULL DEFAULT 0,
  source VARCHAR(50) NULL,
  PRIMARY KEY (id),
  KEY idx_assessment_sessions_round (round_id),
  KEY idx_assessment_sessions_worker (worker_id),
  KEY idx_assessment_sessions_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS assessment_session_questions (
  session_id CHAR(36) NOT NULL,
  question_id VARCHAR(36) NOT NULL,
  display_order INT UNSIGNED NOT NULL,
  source_table VARCHAR(40) NOT NULL DEFAULT 'questions',
  PRIMARY KEY (session_id, question_id),
  KEY idx_assessment_session_questions_order (session_id, display_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

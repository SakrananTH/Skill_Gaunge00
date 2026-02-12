-- ===============================================================================
-- SkillGauge - Views for API
-- ===============================================================================

CREATE OR REPLACE VIEW v_assessment_session_questions_with_level AS
SELECT
  sq.session_id,
  sq.question_id,
  sq.display_order,
  sq.source_table,
  s.round_id,
  r.title AS round_title,
  r.category AS round_category,
  qs.question_text AS structural_question_text,
  qs.choice_a,
  qs.choice_b,
  qs.choice_c,
  qs.choice_d,
  qs.answer,
  qs.set_no AS level,
  q.text AS question_text,
  q.category AS question_category,
  q.difficulty AS question_difficulty
FROM assessment_session_questions sq
LEFT JOIN assessment_sessions s ON s.id = sq.session_id
LEFT JOIN assessment_rounds r ON r.id = s.round_id
LEFT JOIN question_Structural qs
  ON sq.source_table = 'question_Structural'
  AND qs.id = CAST(sq.question_id AS UNSIGNED)
LEFT JOIN questions q
  ON sq.source_table = 'questions'
  AND q.id = sq.question_id;

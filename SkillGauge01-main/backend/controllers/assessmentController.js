const AssessmentRound = require('../models/AssessmentRound');
const pool = require('../config/db');
const crypto = require('crypto');

const STRUCTURAL_SOURCE_TABLE = 'question_Structural';
const DEFAULT_SOURCE_TABLE = 'questions';

const normalizeSessionId = (value) => {
  if (!value) return null;
  const trimmed = String(value).trim();
  return trimmed ? trimmed : null;
};

const resolveSetNoFromDifficulty = (difficultyWeights = {}) => {
  if (difficultyWeights.easy === 100) return 1;
  if (difficultyWeights.medium === 100) return 2;
  if (difficultyWeights.hard === 100) return 3;
  return 1;
};

const resolveDifficultyLevelFromWeights = (difficultyWeights = {}) => {
  if (difficultyWeights.easy === 100) return 1;
  if (difficultyWeights.medium === 100) return 2;
  if (difficultyWeights.hard === 100) return 3;
  return null;
};

const buildSessionInsert = (id, roundId, workerId, userId, questionCount, source) => {
  return pool.query(
    `INSERT INTO assessment_sessions (
      id, round_id, worker_id, user_id, question_count, source
     ) VALUES (?, ?, ?, ?, ?, ?)`,
    [id, roundId, workerId || null, userId || null, questionCount, source || null]
  );
};

const loadSessionById = async (sessionId) => {
  const [rows] = await pool.query(
    `SELECT id, round_id, worker_id, user_id, status, question_count, source
       FROM assessment_sessions
      WHERE id = ?
      LIMIT 1`,
    [sessionId]
  );
  return rows[0] || null;
};

const loadSessionQuestions = async (sessionId) => {
  const [rows] = await pool.query(
    `SELECT question_id, display_order, source_table
       FROM assessment_session_questions
      WHERE session_id = ?
      ORDER BY display_order ASC`,
    [sessionId]
  );
  return rows;
};

const saveSessionQuestions = async (sessionId, questionIds, sourceTable) => {
  if (!questionIds.length) return;
  const values = questionIds.map((questionId, index) => [
    sessionId,
    String(questionId),
    index + 1,
    sourceTable
  ]);
  await pool.query(
    'INSERT INTO assessment_session_questions (session_id, question_id, display_order, source_table) VALUES ?',
    [values]
  );
};

const fetchStructuralQuestions = async (ids) => {
  if (!ids.length) return {};
  const placeholders = ids.map(() => '?').join(',');
  const [rows] = await pool.query(
    `SELECT id, question_text, choice_a, choice_b, choice_c, choice_d
       FROM question_Structural
      WHERE id IN (${placeholders})`,
    ids
  );
  const mapped = {};
  rows.forEach(row => {
    mapped[String(row.id)] = {
      id: String(row.id),
      text: row.question_text,
      choices: [row.choice_a, row.choice_b, row.choice_c, row.choice_d]
    };
  });
  return mapped;
};

const fetchQuestionBankQuestions = async (ids) => {
  if (!ids.length) return {};
  const placeholders = ids.map(() => '?').join(',');
  const [questionRows] = await pool.query(
    `SELECT id, text
       FROM questions
      WHERE id IN (${placeholders})`,
    ids
  );
  const [optionRows] = await pool.query(
    `SELECT question_id, text
       FROM question_options
      WHERE question_id IN (${placeholders})`,
    ids
  );

  const optionsByQuestion = {};
  optionRows.forEach(option => {
    const key = String(option.question_id);
    if (!optionsByQuestion[key]) {
      optionsByQuestion[key] = [];
    }
    optionsByQuestion[key].push(option.text);
  });

  const mapped = {};
  questionRows.forEach(row => {
    const key = String(row.id);
    mapped[key] = {
      id: key,
      text: row.text,
      choices: optionsByQuestion[key] || []
    };
  });

  return mapped;
};

/**
 * Controller: Assessment Rounds
 * จัดการ Business Logic สำหรับโครงสร้างข้อสอบ
 */

/**
 * ดึงรายการ Assessment Rounds ทั้งหมด
 * GET /api/admin/assessments/rounds
 * Query params: ?category=structure&status=active
 */
exports.getRounds = async (req, res) => {
  try {
    const { category, status, active } = req.query;
    
    const filters = {};
    if (category) filters.category = category;
    if (status) filters.status = status;
    if (active !== undefined) filters.active = active === 'true';

    const rounds = await AssessmentRound.findAll(filters);
    
    res.json({
      success: true,
      items: rounds,
      count: rounds.length
    });
  } catch (error) {
    console.error('getRounds error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

/**
 * ดึง Assessment Rounds สำหรับ Worker (เฉพาะที่ active)
 * GET /api/worker/assessments/rounds
 * Query params: ?category=structure
 */
exports.getWorkerRounds = async (req, res) => {
  try {
    const { category } = req.query;
    const filters = {
      status: 'active',
      active: true
    };
    if (category) {
      filters.category = category;
    }

    const rounds = await AssessmentRound.findAll(filters);
    res.json({
      success: true,
      items: rounds,
      count: rounds.length
    });
  } catch (error) {
    console.error('getWorkerRounds error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

/**
 * ดึง Assessment Round ตาม ID
 * GET /api/admin/assessments/rounds/:id
 */
exports.getRoundById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const round = await AssessmentRound.findById(id);
    
    if (!round) {
      return res.status(404).json({
        success: false,
        message: 'not_found'
      });
    }
    
    res.json({
      success: true,
      data: round
    });
  } catch (error) {
    console.error('getRoundById error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

/**
 * สร้าง Assessment Round ใหม่
 * POST /api/admin/assessments/rounds
 */
exports.createRound = async (req, res) => {
  try {
    const data = req.body;
    
    // Validation
    if (!data.category) {
      return res.status(400).json({
        success: false,
        message: 'invalid_category'
      });
    }
    
    if (!data.title) {
      return res.status(400).json({
        success: false,
        message: 'invalid_title'
      });
    }

    // ดึง userId จาก token (ถ้ามี middleware authentication)
    const userId = req.user?.id || req.body.userId || 'admin';
    
    const newRound = await AssessmentRound.create(data, userId);
    
    res.status(201).json({
      success: true,
      message: 'Round created successfully',
      data: newRound
    });
  } catch (error) {
    console.error('createRound error:', error);
    
    // Handle specific errors
    if (error.message.includes('Duplicate')) {
      return res.status(409).json({
        success: false,
        message: 'duplicate_title'
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

/**
 * อัปเดต Assessment Round
 * PUT /api/admin/assessments/rounds/:id
 */
exports.updateRound = async (req, res) => {
  try {
    const { id } = req.params;
    const data = req.body;
    
    // ตรวจสอบว่า Round มีอยู่หรือไม่
    const existing = await AssessmentRound.findById(id);
    if (!existing) {
      return res.status(404).json({
        success: false,
        message: 'not_found'
      });
    }

    // ดึง userId จาก token
    const userId = req.user?.id || req.body.userId || 'admin';
    
    const updatedRound = await AssessmentRound.update(id, data, userId);
    
    res.json({
      success: true,
      message: 'Round updated successfully',
      data: updatedRound
    });
  } catch (error) {
    console.error('updateRound error:', error);
    
    if (error.message === 'Round not found') {
      return res.status(404).json({
        success: false,
        message: 'not_found'
      });
    }
    
    if (error.message === 'No fields to update') {
      return res.status(400).json({
        success: false,
        message: 'No fields to update'
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

/**
 * ลบ Assessment Round (Soft delete)
 * DELETE /api/admin/assessments/rounds/:id
 */
exports.deleteRound = async (req, res) => {
  try {
    const { id } = req.params;
    
    // ตรวจสอบว่า Round มีอยู่หรือไม่
    const existing = await AssessmentRound.findById(id);
    if (!existing) {
      return res.status(404).json({
        success: false,
        message: 'not_found'
      });
    }

    // ดึง userId จาก token
    const userId = req.user?.id || req.body.userId || 'admin';
    
    await AssessmentRound.delete(id, userId);
    
    res.json({
      success: true,
      message: 'Round deleted successfully'
    });
  } catch (error) {
    console.error('deleteRound error:', error);
    
    if (error.message === 'Round not found') {
      return res.status(404).json({
        success: false,
        message: 'not_found'
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

/**
 * ดึงข้อสอบสำหรับ Worker ตาม Round ID และ Category
 * GET /api/worker/assessments/rounds/:id/questions
 * 
 * API นี้จะสุ่มข้อสอบตามโครงสร้างที่กำหนดไว้ใน Round
 * และคืนค่าข้อสอบให้ Worker ไปทำ
 */
exports.getQuestionsForWorker = async (req, res) => {
  try {
    const { id } = req.params;
    const sessionId = normalizeSessionId(req.query.sessionId || req.query.session_id);
    const workerId = req.query.workerId ? Number(req.query.workerId) : null;
    const userId = req.user?.id || req.query.userId || null;
    
    // ดึงข้อมูล Round
    const round = await AssessmentRound.findById(id);
    
    if (!round) {
      return res.status(404).json({
        success: false,
        message: 'not_found'
      });
    }

    if (!round.active || round.status !== 'active') {
      return res.status(403).json({
        success: false,
        message: 'Round is not active'
      });
    }

    // ตรวจสอบช่วงเวลา
    const now = new Date();
    if (round.startAt && new Date(round.startAt) > now) {
      return res.status(403).json({
        success: false,
        message: 'Round has not started yet'
      });
    }
    if (round.endAt && new Date(round.endAt) < now) {
      return res.status(403).json({
        success: false,
        message: 'Round has ended'
      });
    }

    let session = null;
    if (sessionId) {
      session = await loadSessionById(sessionId);
      if (session && session.round_id !== round.id) {
        return res.status(400).json({
          success: false,
          message: 'invalid_session_round'
        });
      }
    }

    const sourceTable = round.category === 'structure' ? STRUCTURAL_SOURCE_TABLE : DEFAULT_SOURCE_TABLE;
    const questionCount = Number(round.questionCount) || 60;

    if (!session) {
      const newSessionId = crypto.randomUUID();
      await buildSessionInsert(newSessionId, round.id, workerId, userId, questionCount, sourceTable);
      session = {
        id: newSessionId,
        round_id: round.id,
        question_count: questionCount,
        source: sourceTable
      };
    }

    await pool.query('UPDATE assessment_sessions SET last_seen_at = NOW(6) WHERE id = ?', [session.id]);

    let sessionQuestions = await loadSessionQuestions(session.id);
    if (!sessionQuestions.length) {
      if (sourceTable === STRUCTURAL_SOURCE_TABLE) {
        const difficultyLevel = resolveDifficultyLevelFromWeights(round.difficultyWeights || {});
        const fallbackSetNo = resolveSetNoFromDifficulty(round.difficultyWeights || {});

        let rows;
        if (difficultyLevel) {
          try {
            [rows] = await pool.query(
              'SELECT id FROM question_Structural WHERE difficulty_level = ? ORDER BY RAND() LIMIT ?',
              [difficultyLevel, questionCount]
            );
          } catch (error) {
            if (error?.code === 'ER_BAD_FIELD_ERROR') {
              [rows] = await pool.query(
                'SELECT id FROM question_Structural WHERE set_no = ? ORDER BY RAND() LIMIT ?',
                [fallbackSetNo, questionCount]
              );
            } else {
              throw error;
            }
          }
        } else {
          [rows] = await pool.query(
            'SELECT id FROM question_Structural ORDER BY RAND() LIMIT ?',
            [questionCount]
          );
        }

        const ids = rows.map(row => row.id);
        await saveSessionQuestions(session.id, ids, sourceTable);
      } else {
        const [rows] = await pool.query(
          'SELECT id FROM questions WHERE category = ? AND active = 1 ORDER BY RAND() LIMIT ?',
          [round.category, questionCount]
        );
        const ids = rows.map(row => row.id);
        await saveSessionQuestions(session.id, ids, sourceTable);
      }
      sessionQuestions = await loadSessionQuestions(session.id);
    }

    if (!sessionQuestions.length) {
      return res.status(404).json({
        success: false,
        message: 'no_questions_available'
      });
    }

    const idsBySource = sessionQuestions.reduce((acc, row) => {
      const key = row.source_table || DEFAULT_SOURCE_TABLE;
      if (!acc[key]) acc[key] = [];
      acc[key].push(String(row.question_id));
      return acc;
    }, {});

    const questionMap = {};
    if (idsBySource[STRUCTURAL_SOURCE_TABLE]) {
      Object.assign(questionMap, await fetchStructuralQuestions(idsBySource[STRUCTURAL_SOURCE_TABLE]));
    }
    const defaultIds = Object.keys(idsBySource)
      .filter(key => key !== STRUCTURAL_SOURCE_TABLE)
      .flatMap(key => idsBySource[key]);
    if (defaultIds.length) {
      Object.assign(questionMap, await fetchQuestionBankQuestions(defaultIds));
    }

    const questions = sessionQuestions
      .map(row => {
        const key = String(row.question_id);
        const mapped = questionMap[key];
        if (!mapped) return null;
        return {
          id: mapped.id,
          text: mapped.text,
          choices: mapped.choices,
          order: row.display_order
        };
      })
      .filter(Boolean);

    res.json({
      success: true,
      sessionId: session.id,
      round: {
        id: round.id,
        title: round.title,
        description: round.description,
        category: round.category,
        questionCount: round.questionCount,
        durationMinutes: round.durationMinutes,
        passingScore: round.passingScore,
        showScore: round.showScore,
        showAnswers: round.showAnswers,
        showBreakdown: round.showBreakdown
      },
      questions
    });
  } catch (error) {
    console.error('getQuestionsForWorker error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

/**
 * ตรวจสอบคำตอบและคำนวณคะแนน
 * POST /api/worker/assessments/rounds/:id/submit
 */
exports.submitAssessment = async (req, res) => {
  try {
    const { id } = req.params;
    const { answers, workerId, sessionId } = req.body;
    
    // ดึงข้อมูล Round
    const round = await AssessmentRound.findById(id);
    
    if (!round) {
      return res.status(404).json({
        success: false,
        message: 'not_found'
      });
    }

    // TODO: ตรวจคำตอบและคำนวณคะแนน
    // 1. เปรียบเทียบคำตอบกับเฉลย
    // 2. คำนวณคะแนนรวม
    // 3. คำนวณคะแนนแยกตามหมวดหมู่ย่อย (ถ้า showBreakdown = true)
    // 4. ตรวจสอบว่าผ่านหรือไม่ผ่านตาม criteria
    // 5. บันทึกผลลงฐานข้อมูล

    res.json({
      success: true,
      message: 'Assessment submission will be implemented in next phase',
      // TODO: เพิ่มผลการสอบ
      result: {
        roundId: id,
        workerId,
        sessionId,
        totalScore: 0,
        passed: false
      }
    });
  } catch (error) {
    console.error('submitAssessment error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

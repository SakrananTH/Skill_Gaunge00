require('dotenv').config();

const express = require('express');
const app = express();
const cors = require('cors');
const crypto = require('crypto');

app.use(express.json());
app.use(cors());

// 1. เชื่อมต่อ DB (Import pool)
const pool = require('./config/db');

// 2. โหลด Routes Authentication (Register/Login)
app.use('/api', require('./routes/auth'));

// 3. โหลด Routes Assessment Rounds (Admin)
app.use('/api/admin/assessments', require('./routes/assessmentRoutes'));

// 3.1 โหลด Routes Audit Logs (Admin)
app.use('/api/admin/audit-logs', require('./routes/auditLogRoutes'));

// 4. โหลด Routes Worker Assessments
app.use('/api/worker/assessments', require('./routes/workerAssessmentRoutes'));

// ----------------------------------------------------
// Helper Function
// ----------------------------------------------------
function uuidHex() {
  return crypto.randomBytes(16).toString('hex');
}

async function safeQuery(sql, params = []) {
  try {
    const [rows] = await pool.query(sql, params);
    return rows;
  } catch (err) {
    if (err?.code === 'ER_NO_SUCH_TABLE') {
      return [];
    }
    throw err;
  }
}

const workerStatusByUserId = new Map();

function parseWorkerId(value) {
  const parsed = Number.parseInt(String(value || '').trim(), 10);
  return Number.isFinite(parsed) ? parsed : null;
}

const toAnswerKey = (value) => {
  const mapping = ['a', 'b', 'c', 'd'];
  if (value === null || value === undefined) return null;
  if (typeof value === 'number' && Number.isFinite(value)) {
    return mapping[value] || null;
  }
  const trimmed = String(value).trim();
  if (trimmed === '') return null;
  if (/^[0-3]$/.test(trimmed)) {
    return mapping[Number(trimmed)] || null;
  }
  const normalized = trimmed.toLowerCase();
  return mapping.includes(normalized) ? normalized : null;
};

async function fetchWorkerAssessmentSummary(workerId) {
  const rows = await safeQuery(
    `SELECT id, worker_id, round_id, session_id, category, total_score, total_questions, passed, breakdown, finished_at
       FROM worker_assessment_results
      WHERE worker_id = ?
      ORDER BY finished_at DESC
      LIMIT 1`,
    [workerId]
  );
  const row = rows[0];
  if (!row) return null;
  let breakdown = null;
  if (row.breakdown) {
    try {
      breakdown = typeof row.breakdown === 'string' ? JSON.parse(row.breakdown) : row.breakdown;
    } catch (err) {
      breakdown = null;
    }
  }
  return {
    id: row.id,
    workerId: row.worker_id,
    roundId: row.round_id,
    sessionId: row.session_id,
    category: row.category,
    score: Number(row.total_score) || 0,
    totalQuestions: Number(row.total_questions) || 0,
    passed: Boolean(Number(row.passed)),
    breakdown: Array.isArray(breakdown) ? breakdown : [],
    finishedAt: row.finished_at
  };
}

// ----------------------------------------------------
// API: Get Questions (Structural) 
// (เก็บไว้เฉพาะดึงข้อสอบ แต่ลบ Submit/Result ออกแล้ว)
// ----------------------------------------------------
app.get('/api/questions/structural', async (req, res) => {
  try {
    const set_no = parseInt(req.query.set_no, 10) || 1;
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const per_page = Math.max(1, parseInt(req.query.per_page, 10) || 20);
    const difficultyParamRaw = req.query.difficulty_level ?? req.query.level ?? req.query.difficulty;
    const parsedDifficulty = Number.isFinite(Number(difficultyParamRaw))
      ? Number(difficultyParamRaw)
      : null;
    const difficultyMap = { easy: 1, medium: 2, hard: 3 };
    const normalizedDifficultyKey = typeof difficultyParamRaw === 'string'
      ? difficultyParamRaw.trim().toLowerCase()
      : '';
    const difficultyLevel = parsedDifficulty
      ? parsedDifficulty
      : (difficultyMap[normalizedDifficultyKey] || null);
    const sessionId = req.query.sessionId || null;
    const workerId = parseWorkerId(req.query.workerId);
    const userId = typeof req.query.userId === 'string' ? req.query.userId.trim() : null;
    const requestedRoundId = typeof req.query.roundId === 'string' ? req.query.roundId.trim() : null;

    let session = null;
    if (!sessionId) {
      // สุ่ม 60 ข้อและเก็บไว้ใน session
      const buildQuestionQuery = (includeSetNo) => {
        const filters = [];
        const params = [];
        if (includeSetNo) {
          filters.push('set_no = ?');
          params.push(set_no);
        }
        if (difficultyLevel) {
          filters.push('difficulty_level = ?');
          params.push(difficultyLevel);
        }
        const whereSql = filters.length ? ` WHERE ${filters.join(' AND ')}` : '';
        return {
          sql: `SELECT id FROM question_Structural${whereSql} ORDER BY RAND() LIMIT 60`,
          params
        };
      };

      let rows;
      try {
        const queryWithSet = buildQuestionQuery(true);
        [rows] = await pool.query(queryWithSet.sql, queryWithSet.params);
      } catch (err) {
        if (err?.code === 'ER_BAD_FIELD_ERROR') {
          const queryWithoutSet = buildQuestionQuery(false);
          [rows] = await pool.query(queryWithoutSet.sql, queryWithoutSet.params);
        } else {
          throw err;
        }
      }
      if (!rows.length) return res.status(404).json({ error: 'No questions found for set_no' });

      const qids = rows.map(r => r.id);
      const newSessionId = uuidHex();

      let roundId = requestedRoundId || null;
      if (!roundId) {
        const [roundRows] = await pool.query(
          `SELECT id
             FROM assessment_rounds
            WHERE category = 'structure'
              AND (status = 'active' OR status = 'draft')
            ORDER BY created_at DESC
            LIMIT 1`
        );
        roundId = roundRows[0]?.id || null;
      }

      if (!roundId) {
        return res.status(409).json({ error: 'No assessment round found for structure' });
      }

      const connection = await pool.getConnection();
      try {
        await connection.beginTransaction();
        await connection.query(
          `INSERT INTO assessment_sessions
             (id, round_id, worker_id, user_id, status, question_count, source)
           VALUES (?, ?, ?, ?, 'in_progress', ?, 'question_Structural')`,
          [newSessionId, roundId, workerId, userId, qids.length]
        );

        const values = qids.map((qid, index) => [newSessionId, String(qid), index + 1, 'question_Structural']);
        await connection.query(
          'INSERT INTO assessment_session_questions (session_id, question_id, display_order, source_table) VALUES ?',
          [values]
        );

        await connection.commit();
      } catch (err) {
        await connection.rollback();
        throw err;
      } finally {
        connection.release();
      }

      session = { id: newSessionId, question_ids: qids, round_id: roundId };
    } else {
      // โหลด Session เดิม
      const [sessRows] = await pool.query(
        `SELECT id FROM assessment_sessions WHERE id = ? LIMIT 1`,
        [sessionId]
      );
      if (!sessRows.length) return res.status(404).json({ error: 'Session not found' });

      const [qidRows] = await pool.query(
        `SELECT question_id
           FROM assessment_session_questions
          WHERE session_id = ?
          ORDER BY display_order ASC`,
        [sessionId]
      );
      const qids = qidRows.map(row => row.question_id);
      const [roundRows] = await pool.query(
        'SELECT round_id FROM assessment_sessions WHERE id = ? LIMIT 1',
        [sessionId]
      );
      session = { id: sessionId, question_ids: qids, round_id: roundRows[0]?.round_id || null };

      await pool.query(
        'UPDATE assessment_sessions SET last_seen_at = NOW(6) WHERE id = ? LIMIT 1',
        [sessionId]
      );
    }

    const total = session.question_ids.length;
    const totalPages = Math.max(1, Math.ceil(total / per_page));
    const pageIndex = Math.min(totalPages, page) - 1;
    const start = pageIndex * per_page;
    const end = Math.min(total, start + per_page);
    const pageIds = session.question_ids.slice(start, end);

    if (!pageIds.length) {
      return res.json({
        sessionId: session.id,
        page,
        per_page,
        total,
        totalPages,
        questions: []
      });
    }

    const placeholders = pageIds.map(() => '?').join(',');
    const [qrows] = await pool.query(
      `SELECT id, question_text, choice_a, choice_b, choice_c, choice_d
         FROM question_Structural WHERE id IN (${placeholders})`,
      pageIds
    );

    const qmap = {};
    qrows.forEach(r => { qmap[r.id] = r; });

    const questions = pageIds.map((id, idx) => {
      const r = qmap[id];
      return {
        id: r.id,
        question_no: start + idx + 1,
        text: r.question_text,
        choices: [r.choice_a, r.choice_b, r.choice_c, r.choice_d]
      };
    });

    res.json({
      sessionId: session.id,
      roundId: session.round_id || null,
      page,
      per_page,
      total,
      totalPages,
      questions
    });

  } catch (err) {
    console.error('GET /api/questions/structural error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ----------------------------------------------------
// API: Worker Assessment Summary
// ----------------------------------------------------
app.get('/api/worker/assessment/summary', async (req, res) => {
  try {
    const workerId = parseWorkerId(req.query.workerId);
    if (!workerId) {
      return res.status(400).json({ success: false, message: 'invalid_worker' });
    }
    const summary = await fetchWorkerAssessmentSummary(workerId);
    if (!summary) {
      return res.status(404).json({ success: false, message: 'not_found' });
    }
    res.json({ success: true, result: summary });
  } catch (err) {
    console.error('GET /api/worker/assessment/summary error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ----------------------------------------------------
// API: Admin Assessment Results
// ----------------------------------------------------
app.get('/api/admin/assessment-results', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.max(1, parseInt(req.query.limit, 10) || 10);
    const offset = (page - 1) * limit;
    const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
    const category = typeof req.query.category === 'string' ? req.query.category.trim() : '';
    const passed = typeof req.query.passed === 'string' ? req.query.passed.trim() : '';

    let whereClause = 'WHERE 1=1';
    const params = [];

    if (search) {
      whereClause += ' AND (w.full_name LIKE ? OR a.email LIKE ? OR CAST(r.worker_id AS CHAR) LIKE ? OR r.id LIKE ?)';
      const term = `%${search}%`;
      params.push(term, term, term, term);
    }

    if (category && category !== 'all') {
      whereClause += ' AND r.category = ?';
      params.push(category);
    }

    if (passed && passed !== 'all') {
      whereClause += ' AND r.passed = ?';
      params.push(passed === '1' ? 1 : 0);
    }

    const countRows = await safeQuery(
      `SELECT COUNT(*) AS total
         FROM worker_assessment_results r
         LEFT JOIN workers w ON w.id = r.worker_id
         LEFT JOIN worker_accounts a ON a.worker_id = w.id
        ${whereClause}`,
      params
    );
    const total = Number(countRows?.[0]?.total) || 0;

    const rows = await safeQuery(
      `SELECT r.id, r.worker_id, r.round_id, r.session_id, r.category, r.total_score, r.total_questions,
              r.passed, r.finished_at, w.full_name AS worker_name, a.email AS worker_email
         FROM worker_assessment_results r
         LEFT JOIN workers w ON w.id = r.worker_id
         LEFT JOIN worker_accounts a ON a.worker_id = w.id
        ${whereClause}
        ORDER BY r.finished_at DESC
        LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    res.json({ items: rows || [], total });
  } catch (err) {
    console.error('GET /api/admin/assessment-results error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// ----------------------------------------------------
// API: Worker Submit Score (persist results)
// ----------------------------------------------------
app.post('/api/worker/score', async (req, res) => {
  try {
    const { userId, answers, sessionId } = req.body || {};
    const workerId = parseWorkerId(userId);
    if (!sessionId) {
      return res.status(400).json({ success: false, message: 'missing_session' });
    }

    const [sessionRows] = await pool.query(
      'SELECT id, worker_id, round_id, status, question_count FROM assessment_sessions WHERE id = ? LIMIT 1',
      [sessionId]
    );
    const session = sessionRows[0];
    if (!session) {
      return res.status(404).json({ success: false, message: 'session_not_found' });
    }
    if (workerId && session.worker_id && Number(session.worker_id) !== workerId) {
      return res.status(403).json({ success: false, message: 'session_mismatch' });
    }
    const resolvedWorkerId = workerId || Number(session.worker_id) || null;
    if (!resolvedWorkerId) {
      return res.status(400).json({ success: false, message: 'missing_worker' });
    }

    const existing = await fetchWorkerAssessmentSummary(resolvedWorkerId);
    if (existing) {
      return res.status(409).json({ success: false, message: 'already_completed', result: existing });
    }

    const [roundRows] = await pool.query(
      'SELECT id, category, passingScore FROM assessment_rounds WHERE id = ? LIMIT 1',
      [session.round_id]
    );
    const round = roundRows[0] || null;
    const category = round?.category || 'structure';

    const [questionRows] = await pool.query(
      'SELECT question_id FROM assessment_session_questions WHERE session_id = ? ORDER BY display_order ASC',
      [sessionId]
    );
    const questionIds = questionRows.map(row => Number(row.question_id)).filter(id => Number.isFinite(id));
    if (!questionIds.length) {
      return res.status(404).json({ success: false, message: 'no_questions' });
    }

    const placeholders = questionIds.map(() => '?').join(',');
    const [answerRows] = await pool.query(
      `SELECT id, answer, category
         FROM question_Structural
        WHERE id IN (${placeholders})`,
      questionIds
    );

    const answerMap = new Map();
    answerRows.forEach(row => {
      answerMap.set(String(row.id), {
        answer: String(row.answer || '').toLowerCase(),
        category: row.category || 'structure'
      });
    });

    const breakdownByCategory = new Map();
    let totalScore = 0;
    questionIds.forEach((qid) => {
      const key = String(qid);
      const meta = answerMap.get(key);
      if (!meta) return;
      const selected = answers ? toAnswerKey(answers[key]) : null;
      const isCorrect = selected && selected === meta.answer;
      if (isCorrect) totalScore += 1;
      const bucket = breakdownByCategory.get(meta.category) || { correct: 0, total: 0 };
      bucket.total += 1;
      if (isCorrect) bucket.correct += 1;
      breakdownByCategory.set(meta.category, bucket);
    });

    const totalQuestions = Number(session.question_count) || questionIds.length;
    const breakdown = Array.from(breakdownByCategory.entries()).map(([label, stats]) => ({
      label,
      correct: stats.correct,
      total: stats.total,
      percentage: stats.total ? Math.round((stats.correct / stats.total) * 100) : 0
    }));

    const passed = round?.passingScore
      ? totalScore >= Number(round.passingScore)
      : totalScore >= Math.ceil(totalQuestions * 0.7);

    const resultId = crypto.randomUUID ? crypto.randomUUID() : uuidHex();
    await pool.query(
      `INSERT INTO worker_assessment_results
        (id, worker_id, round_id, session_id, category, total_score, total_questions, passed, breakdown, finished_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(6))`,
      [
        resultId,
        resolvedWorkerId,
        session.round_id,
        sessionId,
        category,
        totalScore,
        totalQuestions,
        passed ? 1 : 0,
        JSON.stringify(breakdown)
      ]
    );

    await pool.query(
      'UPDATE assessment_sessions SET status = ?, finished_at = NOW(6) WHERE id = ? LIMIT 1',
      ['completed', sessionId]
    );

    res.json({
      success: true,
      result: {
        id: resultId,
        workerId: resolvedWorkerId,
        roundId: session.round_id,
        sessionId,
        category,
        score: totalScore,
        totalQuestions,
        passed,
        breakdown,
        finishedAt: new Date().toISOString()
      }
    });
  } catch (err) {
    console.error('POST /api/worker/score error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ----------------------------------------------------
// Worker Profile & Tasks (Real Data)
// ----------------------------------------------------
app.get('/api/worker/profile', async (req, res) => {
  try {
    const userId = typeof req.query.userId === 'string' ? req.query.userId.trim() : '';
    const workerId = parseWorkerId(req.query.workerId);
    const email = typeof req.query.email === 'string' ? req.query.email.trim() : '';

    if (workerId) {
      const rows = await safeQuery(
        `SELECT w.id, w.full_name, w.phone, w.role_code, w.province, w.district, w.subdistrict, w.postal_code,
                w.current_address, a.email
           FROM workers w
           LEFT JOIN worker_accounts a ON a.worker_id = w.id
          WHERE w.id = ?
          LIMIT 1`,
        [workerId]
      );
      if (!rows.length) return res.status(404).json({ message: 'Worker not found' });
      const row = rows[0];
      return res.json({
        id: row.id,
        name: row.full_name,
        email: row.email,
        phone: row.phone,
        role: row.role_code || 'worker'
      });
    }

    if (userId) {
      const rows = await safeQuery(
        `SELECT id, first_name, last_name, phone_number, email, role_code
           FROM dbuser
          WHERE id = ?
          LIMIT 1`,
        [userId]
      );
      if (!rows.length) return res.status(404).json({ message: 'User not found' });
      const row = rows[0];
      return res.json({
        id: row.id,
        name: `${row.first_name || ''} ${row.last_name || ''}`.trim(),
        email: row.email,
        phone: row.phone_number,
        role: row.role_code || 'worker'
      });
    }

    if (email) {
      const rows = await safeQuery(
        `SELECT w.id, w.full_name, w.phone, w.role_code, a.email
           FROM worker_accounts a
           INNER JOIN workers w ON w.id = a.worker_id
          WHERE LOWER(a.email) = LOWER(?)
          LIMIT 1`,
        [email]
      );
      if (!rows.length) return res.status(404).json({ message: 'Worker not found' });
      const row = rows[0];
      return res.json({
        id: row.id,
        name: row.full_name,
        email: row.email,
        phone: row.phone,
        role: row.role_code || 'worker'
      });
    }

    return res.status(400).json({ message: 'userId, workerId, or email is required' });
  } catch (err) {
    console.error('GET /api/worker/profile error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

app.get('/api/worker/status', async (req, res) => {
  try {
    const userId = typeof req.query.userId === 'string' ? req.query.userId.trim() : '';
    const workerId = parseWorkerId(req.query.workerId);

    if (workerId) {
      const rows = await safeQuery(`SELECT payload FROM worker_profiles WHERE worker_id = ? LIMIT 1`, [workerId]);
      if (!rows.length) return res.json({ status: 'idle' });
      const payload = rows[0]?.payload;
      const parsed = payload ? JSON.parse(payload) : {};
      return res.json({ status: parsed.availability || 'idle' });
    }

    if (userId) {
      return res.json({ status: workerStatusByUserId.get(userId) || 'idle' });
    }

    return res.status(400).json({ message: 'userId or workerId is required' });
  } catch (err) {
    console.error('GET /api/worker/status error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

app.put('/api/worker/status', async (req, res) => {
  try {
    const { userId, workerId, status } = req.body || {};
    const normalizedStatus = status === 'online' ? 'online' : 'idle';
    const numericWorkerId = parseWorkerId(workerId);

    if (numericWorkerId) {
      const payload = JSON.stringify({ availability: normalizedStatus, updatedAt: new Date().toISOString() });
      await safeQuery(
        `INSERT INTO worker_profiles (worker_id, payload)
         VALUES (?, ?)
         ON DUPLICATE KEY UPDATE payload = VALUES(payload)`,
        [numericWorkerId, payload]
      );
      return res.json({ status: normalizedStatus });
    }

    if (userId) {
      workerStatusByUserId.set(userId, normalizedStatus);
      return res.json({ status: normalizedStatus });
    }

    return res.status(400).json({ message: 'userId or workerId is required' });
  } catch (err) {
    console.error('PUT /api/worker/status error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

app.get('/api/worker/tasks', async (req, res) => {
  try {
    const userId = typeof req.query.userId === 'string' ? req.query.userId.trim() : '';
    if (!userId) return res.json([]);

    const rows = await safeQuery(
      `SELECT t.id, t.title, t.status, t.due_date,
              p.name AS project_name, s.name AS site_name
         FROM tasks t
         LEFT JOIN projects p ON p.id = t.project_id
         LEFT JOIN sites s ON s.id = t.site_id
        WHERE t.assignee_user_id = ?
        ORDER BY t.created_at DESC
        LIMIT 50`,
      [userId]
    );

    const result = rows.map(row => ({
      id: row.id,
      project: row.project_name || row.title,
      location: row.site_name || '-',
      foreman: null,
      date: row.due_date ? new Date(row.due_date).toLocaleDateString('th-TH') : '-',
      status: row.status
    }));

    res.json(result);
  } catch (err) {
    console.error('GET /api/worker/tasks error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

app.post('/api/worker/tasks/:id/accept', async (req, res) => {
  try {
    const taskId = req.params.id;
    const result = await safeQuery(
      `UPDATE tasks SET status = 'in-progress', updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [taskId]
    );
    if (!result?.affectedRows) {
      return res.status(404).json({ message: 'Task not found' });
    }
    res.json({ id: taskId, status: 'in-progress' });
  } catch (err) {
    console.error('POST /api/worker/tasks/:id/accept error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

app.post('/api/worker/tasks/:id/submit', async (req, res) => {
  try {
    const taskId = req.params.id;
    const result = await safeQuery(
      `UPDATE tasks SET status = 'submitted', updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [taskId]
    );
    if (!result?.affectedRows) {
      return res.status(404).json({ message: 'Task not found' });
    }
    res.json({ id: taskId, status: 'submitted' });
  } catch (err) {
    console.error('POST /api/worker/tasks/:id/submit error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

app.get('/api/worker/history', async (req, res) => {
  try {
    const userId = typeof req.query.userId === 'string' ? req.query.userId.trim() : '';
    if (!userId) return res.json([]);

    const rows = await safeQuery(
      `SELECT t.id, t.title, t.status, t.due_date,
              p.name AS project_name, s.name AS site_name
         FROM tasks t
         LEFT JOIN projects p ON p.id = t.project_id
         LEFT JOIN sites s ON s.id = t.site_id
        WHERE t.assignee_user_id = ?
          AND t.status IN ('done', 'submitted')
        ORDER BY t.updated_at DESC
        LIMIT 100`,
      [userId]
    );

    const result = rows.map(row => ({
      id: row.id,
      project: row.project_name || row.title,
      location: row.site_name || '-',
      date: row.due_date ? new Date(row.due_date).toLocaleDateString('th-TH') : '-',
      status: row.status
    }));

    res.json(result);
  } catch (err) {
    console.error('GET /api/worker/history error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// ----------------------------------------------------
// Project Manager API (Projects & Tasks)
// ----------------------------------------------------

app.get('/api/pm/projects', async (req, res) => {
  try {
    // 1. Get Projects
    const projects = await safeQuery(
      `SELECT id, name AS projectName, status, created_at FROM projects ORDER BY created_at DESC`
    );

    // 2. Get Tasks for each project
    for (const p of projects) {
        const tasks = await safeQuery(
            `SELECT t.id, t.title AS taskName, t.status, t.priority, t.due_date, t.milp_condition, t.description AS taskDetail,
                    t.site_id, s.name AS location,
                    t.assignee_user_id
             FROM tasks t
             LEFT JOIN sites s ON s.id = t.site_id
             WHERE t.project_id = ?`,
            [p.id]
        );

        p.tasks = [];
        for (const t of tasks) {
            const taskObj = { ...t, assigned_workers: [] };
            if (t.assignee_user_id) {
                // Try to find in workers or users
                const workers = await safeQuery(
                    `SELECT id, full_name AS name, 'Worker' AS level FROM workers WHERE id = ?
                     UNION
                     SELECT id, CONCAT(first_name, ' ', last_name) AS name, 'User' AS level FROM users WHERE id = ?`,
                    [t.assignee_user_id, t.assignee_user_id]
                );
                if (workers.length > 0) {
                     taskObj.assigned_workers.push(workers[0]);
                     // Safe check for level/role
                     if (!taskObj.assigned_workers[0].name) taskObj.assigned_workers[0].name = 'Unknown';
                }
            }
            taskObj.taskType = 'General'; 
            p.tasks.push(taskObj);
        }
        
        p.projectType = 'Construction';
        p.location = p.tasks[0]?.location || 'Multiple Sites';
    }

    res.json(projects);
  } catch (err) {
    console.error('GET /api/pm/projects error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

app.post('/api/pm/tasks', async (req, res) => {
    try {
        const { projectId, taskName, description, assigneeId, dueDate, priority } = req.body;
        const taskId = uuidHex(); 
        
        await pool.query(
            `INSERT INTO tasks (id, project_id, title, description, assignee_user_id, due_date, priority)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
             [taskId, projectId, taskName, description, assigneeId, dueDate, priority || 'medium']
        );
        res.json({ id: taskId, status: 'success' });
    } catch (err) {
        console.error('POST /api/pm/tasks error:', err);
        res.status(500).json({ message: 'Server error' });
    }
});

// ----------------------------------------------------
// Admin API: Question Bank
// ----------------------------------------------------
app.get('/api/question-structural/all', async (req, res) => {
  try {
    const rows = await safeQuery(
      `SELECT 
         id, 
         question_text, 
         choice_a, 
         choice_b, 
         choice_c, 
         choice_d, 
         UPPER(answer) as answer, 
         set_no as difficulty_level,
         category as skill_type
       FROM question_Structural
       ORDER BY id ASC`
    );
     // Add mock timestamps since table doesn't have them
    const result = rows.map(r => ({
        ...r,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
    }));
    res.json(result);
  } catch (err) {
    console.error('GET /api/question-structural/all error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// ----------------------------------------------------
// Start Server
// ----------------------------------------------------
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`API running on port ${PORT}`));

app.get('/', (req, res) => res.send('API is running'));
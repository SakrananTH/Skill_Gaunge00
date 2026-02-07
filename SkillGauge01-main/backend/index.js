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

// ----------------------------------------------------
// API: Get Questions (Structural) 
// (เก็บไว้เฉพาะดึงข้อสอบ แต่ลบ Submit/Result ออกแล้ว)
// ----------------------------------------------------
app.get('/api/questions/structural', async (req, res) => {
  try {
    const set_no = parseInt(req.query.set_no, 10) || 1;
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const per_page = Math.max(1, parseInt(req.query.per_page, 10) || 20);
    const sessionId = req.query.sessionId || null;

    let session = null;
    if (!sessionId) {
      // สุ่ม 60 ข้อ
      const [rows] = await pool.query(
        'SELECT id FROM question_Structural WHERE set_no = ? ORDER BY RAND() LIMIT 60',
        [set_no]
      );
      if (!rows.length) return res.status(404).json({ error: 'No questions found for set_no' });

      const qids = rows.map(r => r.id);
      const newSessionId = uuidHex();
      await pool.query(
        'INSERT INTO exam_sessions (id, set_no, question_ids) VALUES (?, ?, ?)',
        [newSessionId, set_no, JSON.stringify(qids)]
      );
      session = { id: newSessionId, question_ids: qids };
    } else {
      // โหลด Session เดิม
      const [sessRows] = await pool.query('SELECT id, question_ids FROM exam_sessions WHERE id = ? LIMIT 1', [sessionId]);
      if (!sessRows.length) return res.status(404).json({ error: 'Session not found' });
      session = sessRows[0];
      try {
        session.question_ids = typeof session.question_ids === 'string' ? JSON.parse(session.question_ids) : session.question_ids;
      } catch (e) {
        return res.status(500).json({ error: 'Invalid session data' });
      }
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
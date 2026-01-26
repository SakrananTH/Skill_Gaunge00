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

// ----------------------------------------------------
// Helper Function
// ----------------------------------------------------
function uuidHex() {
  return crypto.randomBytes(16).toString('hex');
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
// Start Server
// ----------------------------------------------------
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`API running on port ${PORT}`));

app.get('/', (req, res) => res.send('API is running'));
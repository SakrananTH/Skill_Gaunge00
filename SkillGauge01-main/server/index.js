import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { randomUUID } from 'crypto';
import fs from 'fs';
import path from 'path';
import multer from 'multer';
import { fileURLToPath } from 'url';
import { z } from 'zod';
import { env } from './config/env.js';
import authRoutes from './routes/authRoutes.js';
import adminRoleRoutes from './routes/adminRoleRoutes.js';
import pmRoleRoutes from './routes/pmRoleRoutes.js';
import wkRoleRoutes from './routes/wkRoleRoutes.js';
import fmRoleRoutes from './routes/fmRoleRoutes.js';
import { requireAuth, authorizeRoles } from './middlewares/auth.js';
import { buildUpdateClause, query, queryOne, execute, withTransaction, ensureAuditLogSchema } from './utils/db.js';
import { workerRegistrationSchema } from './schemas/userSchemas.js';
import { signupSchema } from './schemas/authSchemas.js';
import { workerService } from './services/workerService.js';
import { userService } from './services/userService.js';
import { toNullableString, getTradeLabel } from './utils/helpers.js';
import bcrypt from 'bcryptjs';
import {
  loadThaiAddressDataset,
  searchThaiAddressRecords,
  getAddressMeta
} from './services/thaiAddressService.js';

const app = express();
const serverDir = path.dirname(fileURLToPath(import.meta.url));
const uploadsDir = path.join(serverDir, 'uploads');
const workerSubmissionUploadsDir = path.join(uploadsDir, 'worker-submissions');

fs.mkdirSync(workerSubmissionUploadsDir, { recursive: true });

const workerSubmissionStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, workerSubmissionUploadsDir),
  filename: (_req, file, cb) => {
    const extension = path.extname(file.originalname || '').toLowerCase();
    cb(null, `${randomUUID()}${extension}`);
  }
});

const workerSubmissionUpload = multer({
  storage: workerSubmissionStorage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const mime = String(file.mimetype || '').toLowerCase();
    if (mime.startsWith('image/')) return cb(null, true);
    cb(new Error('invalid_file_type'));
  }
});

app.use(cors({
  origin: env.CORS_ORIGIN,
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json({ limit: '1mb' }));
app.use('/uploads', express.static(uploadsDir));

loadThaiAddressDataset().catch((error) => {
  console.warn('[addresses] Initial dataset load failed', error?.message || error);
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'skillgauge-api' });
});

app.post('/api/auth/signup', async (req, res) => {
  try {
    const payload = signupSchema.parse(req.body ?? {});
    const user = await userService.createSignupUser(payload, req);
    res.status(201).json({ user });
  } catch (error) {
    if (error?.issues) {
      return res.status(400).json({ message: 'Invalid input', errors: error.issues });
    }
    if (error?.status && error?.message) {
      return res.status(error.status).json({ message: error.message });
    }
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

app.get('/api/admin/audit-logs', requireAuth, authorizeRoles('admin'), async (req, res) => {
  try {
    await ensureAuditLogSchema();
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit, 10) || 10));
    const offset = (page - 1) * limit;
    const search = String(req.query.search || '').trim();
    const startDate = String(req.query.startDate || '').trim();
    const endDate = String(req.query.endDate || '').trim();

    const filters = [];
    const values = [];

    if (search) {
      const like = `%${search}%`;
      filters.push(
        '(a.action LIKE ? OR CAST(a.details AS CHAR) LIKE ? OR u.full_name LIKE ? OR u.phone LIKE ? OR u.email LIKE ?)'
      );
      values.push(like, like, like, like, like);
    }

    if (startDate) {
      filters.push('DATE(a.created_at) >= ?');
      values.push(startDate);
    }

    if (endDate) {
      filters.push('DATE(a.created_at) <= ?');
      values.push(endDate);
    }

    const whereClause = filters.length ? `WHERE ${filters.join(' AND ')}` : '';

    const countRows = await query(
      `SELECT COUNT(*) AS total
       FROM audit_logs a
       LEFT JOIN users u ON u.id = a.actor_user_id
       ${whereClause}`,
      values
    );
    const total = Number(countRows[0]?.total ?? 0);

    const rows = await query(
      `SELECT a.id, a.created_at, a.action, a.details, a.ip_address,
              u.full_name, u.phone, u.email
       FROM audit_logs a
       LEFT JOIN users u ON u.id = a.actor_user_id
       ${whereClause}
       ORDER BY a.created_at DESC
       LIMIT ${limit} OFFSET ${offset}`,
      values
    );

    const items = rows.map((row) => {
      let details = row.details ?? '';
      if (typeof details === 'string') {
        try {
          details = JSON.parse(details);
        } catch {
          // keep string if not valid JSON
        }
      }

      const detailsUserName = details && typeof details === 'object'
        ? (details.user_name || details.full_name || details.username || null)
        : null;

      const detailsRole = details && typeof details === 'object' && Array.isArray(details.roles)
        ? details.roles.join(',')
        : null;

      const normalizedAction = (() => {
        const actionValue = String(row.action || '').toUpperCase();
        if (actionValue === 'LOGIN' || actionValue === 'LOGIN_SUCCESS') {
          return 'เข้าสู่ระบบ';
        }
        return row.action;
      })();

      return {
        id: row.id,
        timestamp: row.created_at,
        user: row.full_name || row.phone || row.email || detailsUserName || 'System',
        role: detailsRole || '-',
        action: normalizedAction,
        details,
        ip: row.ip_address || '-',
        status: 'success'
      };
    });

    res.json({ items, total });
  } catch (error) {
    if (error?.code === 'ER_NO_SUCH_TABLE') {
      return res.json({ items: [], total: 0 });
    }
    console.error('Fetch audit logs failed', error);
    res.status(500).json({ message: 'Server error' });
  }
});

app.get('/api/admin/assessment-results', requireAuth, authorizeRoles('admin'), async (req, res) => {
  try {
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit, 10) || 10));
    const offset = (page - 1) * limit;
    const search = String(req.query.search || '').trim();
    const category = String(req.query.category || '').trim();
    const passed = String(req.query.passed || '').trim();

    const filters = [];
    const values = [];
    const practicalCompletedExpr = `EXISTS (
      SELECT 1
      FROM foreman_assessments fa
      WHERE fa.worker_id = r.worker_id
        AND fa.percent IS NOT NULL
    )`;
    const resolvedPassedExpr = `CASE WHEN ${practicalCompletedExpr} THEN r.passed ELSE NULL END`;

    if (search) {
      const like = `%${search}%`;
      filters.push('(w.full_name LIKE ? OR a.email LIKE ? OR CAST(w.id AS CHAR) LIKE ?)');
      values.push(like, like, like);
    }

    if (category && category !== 'all') {
      filters.push('r.category = ?');
      values.push(category);
    }

    if (passed && passed !== 'all') {
      filters.push(`${resolvedPassedExpr} = ?`);
      values.push(passed === '1' ? 1 : 0);
    }

    const whereClause = filters.length ? `WHERE ${filters.join(' AND ')}` : '';

    const countRows = await query(
      `SELECT COUNT(*) AS total
       FROM worker_assessment_results r
       LEFT JOIN workers w ON w.id = r.worker_id
       LEFT JOIN worker_accounts a ON a.worker_id = r.worker_id
       ${whereClause}`,
      values
    );
    const total = Number(countRows[0]?.total ?? 0);

    const rows = await query(
      `SELECT r.id, r.worker_id, r.category, r.total_score, r.total_questions, r.passed, r.finished_at,
              ${practicalCompletedExpr} AS practical_completed,
              ${resolvedPassedExpr} AS resolved_passed,
              w.full_name AS worker_name,
              a.email AS worker_email
       FROM worker_assessment_results r
       LEFT JOIN workers w ON w.id = r.worker_id
       LEFT JOIN worker_accounts a ON a.worker_id = r.worker_id
       ${whereClause}
       ORDER BY r.finished_at DESC
       LIMIT ${limit} OFFSET ${offset}`,
      values
    );
    const items = rows.map((row) => {
      const practicalCompleted = Boolean(Number(row.practical_completed));
      const resolvedPassed = row.resolved_passed === null || row.resolved_passed === undefined
        ? null
        : Boolean(Number(row.resolved_passed));

      return {
        ...row,
        practicalCompleted,
        resultReady: practicalCompleted,
        passed: practicalCompleted ? resolvedPassed : null
      };
    });

    res.json({ items, total });
  } catch (error) {
    if (error?.code === 'ER_NO_SUCH_TABLE') {
      return res.json({ items: [], total: 0 });
    }
    console.error('Fetch assessment results failed', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// ---------------------------------------------------------------------------
// Admin worker registration endpoints (accept nested payloads from UI)
// ---------------------------------------------------------------------------
const workerTableColumns = new Set();
const workerAccountColumns = new Set();

async function refreshWorkerTableColumns() {
  const workerColumns = await query('SHOW COLUMNS FROM workers');
  const accountColumns = await query('SHOW COLUMNS FROM worker_accounts');
  workerTableColumns.clear();
  workerAccountColumns.clear();
  workerColumns.forEach((column) => workerTableColumns.add(column.Field));
  accountColumns.forEach((column) => workerAccountColumns.add(column.Field));
}

async function requireWorkerTables() {
  if (!workerTableColumns.size || !workerAccountColumns.size) {
    await refreshWorkerTableColumns();
  }
}

async function promoteWorkerIfPassed(workerId, passed, connection) {
  if (!passed) return;
  const normalizedWorkerId = Number(workerId);
  if (!Number.isFinite(normalizedWorkerId)) return;

  await execute(
    `UPDATE workers
     SET employment_status = 'permanent'
     WHERE id = ?
       AND (employment_status IS NULL OR employment_status = '' OR employment_status = 'active' OR employment_status = 'probation')`,
    [normalizedWorkerId],
    connection
  );
}

function filterObjectByColumns(payload, columnsSet) {
  const output = {};
  if (!payload || !columnsSet) return output;
  Object.entries(payload).forEach(([key, value]) => {
    if (columnsSet.has(key) && value !== undefined) {
      output[key] = value;
    }
  });
  return output;
}

function normalizeEmail(email) {
  const value = toNullableString(email);
  return value ? value.toLowerCase() : null;
}

function sanitizeProfileForStorage(payload, email) {
  return {
    personal: payload.personal ?? {},
    identity: payload.identity ?? {},
    address: payload.address ?? {},
    employment: payload.employment ?? {},
    credentials: {
      email: email || payload.credentials?.email || '',
      password: '',
      confirmPassword: ''
    }
  };
}

function inferAssessmentLevelFromTitle(title) {
  if (!title) return null;
  const normalized = String(title).toLowerCase();
  const match = normalized.match(/\b(?:lv|level)\s*([1-3])\b/i) || normalized.match(/ระดับ\s*([1-3])/i);
  if (!match) return null;
  const level = Number(match[1]);
  return Number.isFinite(level) ? level : null;
}

function resolveNumericWorkerId(req) {
  const candidates = [req.query?.workerId, req.user?.worker_id, req.query?.userId, req.user?.id];
  for (const candidate of candidates) {
    const workerId = Number(candidate);
    if (Number.isFinite(workerId)) {
      return workerId;
    }
  }
  return null;
}

async function resolveWorkerIdFromRequest(req) {
  const directWorkerId = resolveNumericWorkerId(req);
  if (Number.isFinite(directWorkerId)) return directWorkerId;

  const userIdCandidates = [req.query?.userId, req.user?.id]
    .map((value) => (value == null ? '' : String(value).trim()))
    .filter(Boolean);

  for (const userId of userIdCandidates) {
    try {
      const userRow = await queryOne(
        `SELECT id, full_name, email, phone
         FROM users
         WHERE id = ?
         LIMIT 1`,
        [userId]
      );
      if (!userRow) continue;

      if (userRow.email) {
        const accountRow = await queryOne(
          `SELECT worker_id
           FROM worker_accounts
           WHERE LOWER(email) = LOWER(?)
           LIMIT 1`,
          [userRow.email]
        );
        const mappedFromEmail = Number(accountRow?.worker_id);
        if (Number.isFinite(mappedFromEmail)) return mappedFromEmail;
      }

      if (userRow.phone) {
        const workerRow = await queryOne(
          `SELECT id
           FROM workers
           WHERE phone = ?
           LIMIT 1`,
          [userRow.phone]
        );
        const mappedFromPhone = Number(workerRow?.id);
        if (Number.isFinite(mappedFromPhone)) return mappedFromPhone;
      }

      if (userRow.full_name) {
        const workerRow = await queryOne(
          `SELECT id
           FROM workers
           WHERE full_name = ?
           ORDER BY id DESC
           LIMIT 1`,
          [userRow.full_name]
        );
        const mappedFromName = Number(workerRow?.id);
        if (Number.isFinite(mappedFromName)) return mappedFromName;
      }
    } catch (error) {
      if (error?.code === 'ER_NO_SUCH_TABLE' || error?.code === 'ER_BAD_FIELD_ERROR') {
        return null;
      }
      throw error;
    }
  }

  const jwtFullName = String(req.user?.full_name || '').trim();
  if (jwtFullName) {
    try {
      const workerRow = await queryOne(
        `SELECT w.id
         FROM workers w
         LEFT JOIN task_worker_assignments twa ON twa.worker_id = w.id
         WHERE w.full_name = ?
         GROUP BY w.id
         ORDER BY COUNT(twa.id) DESC, w.id DESC
         LIMIT 1`,
        [jwtFullName]
      );
      const mappedFromJwtName = Number(workerRow?.id);
      if (Number.isFinite(mappedFromJwtName)) return mappedFromJwtName;
    } catch (error) {
      if (error?.code === 'ER_NO_SUCH_TABLE' || error?.code === 'ER_BAD_FIELD_ERROR') {
        return null;
      }
      throw error;
    }
  }

  return null;
}

function inferAssessmentLevelFromRound(round) {
  if (!round || typeof round !== 'object') return null;

  const parseJsonLike = (value) => {
    if (!value) return null;
    if (typeof value === 'object') return value;
    if (typeof value !== 'string') return null;
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === 'object' ? parsed : null;
    } catch (_) {
      return null;
    }
  };

  const criteria = parseJsonLike(round.criteria);
  const weights = parseJsonLike(round.difficulty_weights);

  const criteriaTarget = String(criteria?.targetLevel || '').toLowerCase();
  if (criteriaTarget === 'easy') return 1;
  if (criteriaTarget === 'medium') return 2;
  if (criteriaTarget === 'hard') return 3;

  const easy = Number(weights?.easy);
  const medium = Number(weights?.medium);
  const hard = Number(weights?.hard);
  if (easy === 100) return 1;
  if (medium === 100) return 2;
  if (hard === 100) return 3;

  if (Number.isFinite(easy) || Number.isFinite(medium) || Number.isFinite(hard)) {
    const normalizedEasy = Number.isFinite(easy) ? easy : 0;
    const normalizedMedium = Number.isFinite(medium) ? medium : 0;
    const normalizedHard = Number.isFinite(hard) ? hard : 0;

    if (normalizedEasy > normalizedMedium && normalizedEasy > normalizedHard) return 1;
    if (normalizedMedium > normalizedEasy && normalizedMedium > normalizedHard) return 2;
    if (normalizedHard > normalizedEasy && normalizedHard > normalizedMedium) return 3;
  }

  return inferAssessmentLevelFromTitle(round.title);
}

async function inferAssessmentLevelFromSession(sessionId, connection) {
  const normalizedSessionId = String(sessionId || '').trim();
  if (!normalizedSessionId) return null;

  try {
    const row = await queryOne(
      `SELECT q.set_no AS set_no, COUNT(*) AS cnt
       FROM assessment_session_questions sq
       JOIN question_Structural q ON q.id = sq.question_id
       WHERE sq.session_id = ?
       GROUP BY q.set_no
       ORDER BY cnt DESC, q.set_no ASC
       LIMIT 1`,
      [normalizedSessionId],
      connection
    );

    const level = Number(row?.set_no);
    return Number.isFinite(level) && level >= 1 ? Math.trunc(level) : null;
  } catch (error) {
    if (error?.code === 'ER_NO_SUCH_TABLE' || error?.code === 'ER_BAD_TABLE_ERROR') {
      return null;
    }
    throw error;
  }
}

async function ensureForemanAssessmentSchema(connection) {
  await execute(
    `CREATE TABLE IF NOT EXISTS foreman_assessments (
      id CHAR(36) NOT NULL,
      worker_id INT UNSIGNED NOT NULL,
      foreman_user_id CHAR(36) NULL,
      criteria_json LONGTEXT NOT NULL,
      total_score INT NOT NULL,
      max_score INT NOT NULL,
      percent DECIMAL(5,2) NOT NULL,
      grade VARCHAR(50) NOT NULL,
      comment TEXT NULL,
      created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
      PRIMARY KEY (id),
      KEY idx_foreman_assessments_worker (worker_id),
      KEY idx_foreman_assessments_created (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    [],
    connection
  );
}

async function ensureForemanReportSchema(connection) {
  await execute(
    `CREATE TABLE IF NOT EXISTS foreman_reports (
      id CHAR(36) NOT NULL,
      foreman_user_id CHAR(36) NULL,
      project_id CHAR(36) NOT NULL,
      project_name VARCHAR(255) NULL,
      report_type VARCHAR(20) NOT NULL,
      report_date DATE NOT NULL,
      work_done TEXT NOT NULL,
      problems TEXT NULL,
      attachment_name VARCHAR(255) NULL,
      created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
      PRIMARY KEY (id),
      KEY idx_foreman_reports_project (project_id),
      KEY idx_foreman_reports_created (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    [],
    connection
  );
}

async function ensureWorkerTaskSubmissionSchema(connection) {
  await execute(
    `CREATE TABLE IF NOT EXISTS worker_task_submissions (
      id CHAR(36) NOT NULL,
      task_id CHAR(36) NOT NULL,
      worker_id INT UNSIGNED NOT NULL,
      description TEXT NULL,
      photo VARCHAR(255) NULL,
      submitted_at DATETIME(6) NOT NULL,
      created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
      updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
      PRIMARY KEY (id),
      UNIQUE KEY uniq_worker_task_submissions_task_worker (task_id, worker_id),
      KEY idx_worker_task_submissions_worker (worker_id),
      KEY idx_worker_task_submissions_submitted (submitted_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    [],
    connection
  );
}

async function fetchLatestAssessmentSummary(workerId, connection) {
  try {
    const row = await queryOne(
      `SELECT r.total_score, r.total_questions, r.passed, r.finished_at, r.session_id,
              ar.title AS round_title, ar.criteria, ar.difficulty_weights
       FROM worker_assessment_results r
       LEFT JOIN assessment_rounds ar ON ar.id = r.round_id
       WHERE r.worker_id = ?
       ORDER BY r.finished_at DESC
       LIMIT 1`,
      [workerId],
      connection
    );
    if (!row) return null;
    const scoreValue = row.total_score ?? null;
    const score = scoreValue === null || scoreValue === undefined ? null : Number(scoreValue);
    const totalQuestionsValue = row.total_questions ?? null;
    const totalQuestions = totalQuestionsValue === null || totalQuestionsValue === undefined
      ? null
      : Number(totalQuestionsValue);
    const passedValue = row.passed;
    const passed = passedValue !== null && passedValue !== undefined
      ? Boolean(Number(passedValue))
      : null;
    const sessionLevel = await inferAssessmentLevelFromSession(row.session_id, connection);
    const roundLevel = sessionLevel ?? inferAssessmentLevelFromRound({
      title: row.round_title,
      criteria: row.criteria,
      difficulty_weights: row.difficulty_weights
    });
    return { score, passed, totalScore: score, totalQuestions, roundLevel };
  } catch (error) {
    if (error?.code === 'ER_NO_SUCH_TABLE') return null;
    console.warn('Fetch assessment summary failed', error?.code || error?.message || error);
    return null;
  }
}

async function fetchLatestForemanAssessment(workerId, connection) {
  try {
    await ensureForemanAssessmentSchema(connection);
    const row = await queryOne(
      `SELECT total_score, max_score, percent, grade, created_at
       FROM foreman_assessments
       WHERE worker_id = ?
       ORDER BY created_at DESC
       LIMIT 1`,
      [workerId],
      connection
    );
    if (!row) return null;
    return {
      totalScore: row.total_score ?? null,
      maxScore: row.max_score ?? null,
      percent: row.percent ?? null,
      grade: row.grade ?? null,
      createdAt: row.created_at ?? null
    };
  } catch (error) {
    if (error?.code === 'ER_NO_SUCH_TABLE') return null;
    console.warn('Fetch foreman assessment failed', error?.code || error?.message || error);
    return null;
  }
}

async function getWorkerResponseById(workerId, connection) {
  const row = await queryOne(
    `SELECT w.*, a.email AS account_email, a.password_hash AS account_password_hash
     FROM workers w
     LEFT JOIN worker_accounts a ON a.worker_id = w.id
     WHERE w.id = ?
     LIMIT 1`,
    [workerId],
    connection
  );
  if (!row) return null;
  const profilePayload = await workerService.fetchWorkerProfile(connection, workerId);
  const assessmentSummary = await fetchLatestAssessmentSummary(workerId, connection);
  const foremanAssessmentSummary = await fetchLatestForemanAssessment(workerId, connection);
  return workerService.mapWorkerRowToResponse(row, profilePayload, assessmentSummary, foremanAssessmentSummary);
}

async function getAllWorkerResponses(connection) {
  const rows = await query(
    `SELECT w.*, a.email AS account_email, a.password_hash AS account_password_hash
     FROM workers w
     LEFT JOIN worker_accounts a ON a.worker_id = w.id
     ORDER BY w.created_at DESC`,
    [],
    connection
  );
  const results = [];
  for (const row of rows) {
    const profilePayload = await workerService.fetchWorkerProfile(connection, row.id);
    const assessmentSummary = await fetchLatestAssessmentSummary(row.id, connection);
    const foremanAssessmentSummary = await fetchLatestForemanAssessment(row.id, connection);
    results.push(workerService.mapWorkerRowToResponse(row, profilePayload, assessmentSummary, foremanAssessmentSummary));
  }
  return results;
}

app.get('/api/admin/workers', requireAuth, authorizeRoles('admin', 'project_manager', 'pm'), async (_req, res) => {
  try {
    await requireWorkerTables();
    const items = await getAllWorkerResponses();
    res.json({ items });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

app.get('/api/admin/workers/:id', requireAuth, authorizeRoles('admin', 'project_manager', 'pm'), async (req, res) => {
  try {
    const workerId = Number(req.params.id);
    if (!Number.isFinite(workerId)) return res.status(400).json({ message: 'invalid_id' });

    await requireWorkerTables();
    const worker = await getWorkerResponseById(workerId);
    if (!worker) return res.status(404).json({ message: 'not_found' });
    res.json(worker);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

app.get('/api/worker/profile', requireAuth, authorizeRoles('worker', 'wk'), async (req, res) => {
  try {
    const workerId = await resolveWorkerIdFromRequest(req);
    if (!Number.isFinite(workerId)) return res.status(400).json({ message: 'invalid_id' });

    await requireWorkerTables();
    const worker = await getWorkerResponseById(workerId);
    if (!worker) return res.status(404).json({ message: 'not_found' });
    res.json(worker);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

app.post('/api/admin/workers', requireAuth, authorizeRoles('admin'), async (req, res) => {
  try {
    await requireWorkerTables();

    if (!workerTableColumns.has('id')) {
      return res.status(500).json({ message: 'workers_table_missing_id' });
    }
    if (!workerAccountColumns.has('worker_id') || !workerAccountColumns.has('email') || !workerAccountColumns.has('password_hash')) {
      return res.status(500).json({ message: 'worker_accounts_table_missing_columns' });
    }

    const parsed = workerRegistrationSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return res.status(400).json({ message: 'Invalid input', errors: parsed.error.issues });
    }

    const payload = parsed.data;
    const normalizedRole = String(payload.employment?.role ?? '').trim().toLowerCase();
    const normalizedTradeType = String(payload.employment?.tradeType ?? '').trim().toLowerCase();

    if (normalizedRole === 'worker' && !normalizedTradeType) {
      return res.status(400).json({ message: 'missing_trade_type' });
    }

    payload.employment.role = normalizedRole || payload.employment.role;
    payload.employment.tradeType = normalizedTradeType || (normalizedRole && normalizedRole !== 'worker' ? 'structure' : payload.employment.tradeType);

    const normalizedNationalId = String(payload.personal?.nationalId ?? '').trim();
    if (!/^\d{13}$/.test(normalizedNationalId)) {
      return res.status(400).json({ message: 'invalid_national_id_length' });
    }
    payload.personal.nationalId = normalizedNationalId;

    const normalizedEmail = normalizeEmail(payload.credentials?.email);
    const password = payload.credentials?.password;
    const rawPhone = String(payload.address?.phone ?? '').trim();

    if (!normalizedEmail) {
      return res.status(400).json({ message: 'invalid_email' });
    }
    if (!password) {
      return res.status(400).json({ message: 'password_required' });
    }
    if (!/^0\d{9}$/.test(rawPhone)) {
      return res.status(400).json({ message: 'invalid_phone' });
    }
    payload.address.phone = rawPhone;

    const workerData = workerService.buildWorkerDataFromPayload(payload);
    if (!workerData.national_id) {
      return res.status(400).json({ message: 'missing_national_id' });
    }
    if (!workerData.full_name) {
      return res.status(400).json({ message: 'missing_full_name' });
    }

    const duplicateNational = await queryOne(
      'SELECT id FROM workers WHERE national_id = ? LIMIT 1',
      [workerData.national_id]
    );
    if (duplicateNational) {
      return res.status(409).json({ message: 'duplicate_national_id' });
    }

    const duplicateEmail = await queryOne(
      'SELECT worker_id FROM worker_accounts WHERE LOWER(email) = ? LIMIT 1',
      [normalizedEmail]
    );
    if (duplicateEmail) {
      return res.status(409).json({ message: 'duplicate_email' });
    }

    const filteredWorkerData = filterObjectByColumns(workerData, workerTableColumns);
    const workerColumns = Object.keys(filteredWorkerData);
    if (!workerColumns.length) {
      return res.status(500).json({ message: 'worker_columns_unavailable' });
    }

    const workerSql = `INSERT INTO workers (${workerColumns.join(', ')}) VALUES (${workerColumns.map(() => '?').join(', ')})`;
    const workerValues = workerColumns.map(column => filteredWorkerData[column]);
    const passwordHash = await bcrypt.hash(password, 10);

    const created = await withTransaction(async (connection) => {
      const workerResult = await execute(workerSql, workerValues, connection);
      const workerId = workerResult.insertId;
      if (!workerId) throw new Error('worker_insert_failed');

      const accountData = filterObjectByColumns(
        { worker_id: workerId, email: normalizedEmail, password_hash: passwordHash },
        workerAccountColumns
      );
      const accountColumns = Object.keys(accountData);
      if (!accountColumns.length) throw new Error('worker_account_columns_unavailable');

      const accountSql = `INSERT INTO worker_accounts (${accountColumns.join(', ')}) VALUES (${accountColumns.map(() => '?').join(', ')})`;
      const accountValues = accountColumns.map(column => accountData[column]);
      await execute(accountSql, accountValues, connection);

      const profilePayload = sanitizeProfileForStorage(payload, normalizedEmail);
      await workerService.saveWorkerProfile(connection, workerId, profilePayload);

      const workerResponse = await getWorkerResponseById(workerId, connection);
      if (!workerResponse) throw new Error('worker_fetch_failed');
      return workerResponse;
    });

    res.status(201).json(created);
  } catch (error) {
    if (error?.message === 'worker_insert_failed' || error?.message === 'worker_account_columns_unavailable') {
      console.error(error);
      return res.status(500).json({ message: 'Server error' });
    }
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

app.put('/api/admin/workers/:id', requireAuth, authorizeRoles('admin'), async (req, res) => {
  try {
    const workerId = Number(req.params.id);
    if (!Number.isFinite(workerId)) return res.status(400).json({ message: 'invalid_id' });

    await requireWorkerTables();

    if (!workerTableColumns.has('id')) {
      return res.status(500).json({ message: 'workers_table_missing_id' });
    }
    if (!workerAccountColumns.has('worker_id') || !workerAccountColumns.has('email')) {
      return res.status(500).json({ message: 'worker_accounts_table_missing_columns' });
    }

    const exists = await queryOne('SELECT id FROM workers WHERE id = ? LIMIT 1', [workerId]);
    if (!exists) return res.status(404).json({ message: 'not_found' });

    const parsed = workerRegistrationSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return res.status(400).json({ message: 'Invalid input', errors: parsed.error.issues });
    }

    const payload = parsed.data;
    const normalizedRole = String(payload.employment?.role ?? '').trim().toLowerCase();
    const normalizedTradeType = String(payload.employment?.tradeType ?? '').trim().toLowerCase();

    if (normalizedRole === 'worker' && !normalizedTradeType) {
      return res.status(400).json({ message: 'missing_trade_type' });
    }

    payload.employment.role = normalizedRole || payload.employment.role;
    payload.employment.tradeType = normalizedTradeType || (normalizedRole && normalizedRole !== 'worker' ? 'structure' : payload.employment.tradeType);

    const normalizedNationalId = String(payload.personal?.nationalId ?? '').trim();
    if (!/^\d{13}$/.test(normalizedNationalId)) {
      return res.status(400).json({ message: 'invalid_national_id_length' });
    }
    payload.personal.nationalId = normalizedNationalId;

    const normalizedEmail = normalizeEmail(payload.credentials?.email);
    const password = payload.credentials?.password;
    const rawPhone = String(payload.address?.phone ?? '').trim();

    if (!normalizedEmail) {
      return res.status(400).json({ message: 'invalid_email' });
    }
    if (!/^0\d{9}$/.test(rawPhone)) {
      return res.status(400).json({ message: 'invalid_phone' });
    }
    payload.address.phone = rawPhone;

    const workerData = workerService.buildWorkerDataFromPayload(payload, { forUpdate: true });
    const filteredWorkerData = filterObjectByColumns(workerData, workerTableColumns);
    const workerClause = buildUpdateClause(filteredWorkerData);

    const accountUpdates = filterObjectByColumns({ email: normalizedEmail }, workerAccountColumns);
    const accountClause = buildUpdateClause(accountUpdates);

    const duplicateNational = await queryOne(
      'SELECT id FROM workers WHERE national_id = ? AND id <> ? LIMIT 1',
      [workerData.national_id, workerId]
    );
    if (duplicateNational) {
      return res.status(409).json({ message: 'duplicate_national_id' });
    }

    const duplicateEmail = await queryOne(
      'SELECT worker_id FROM worker_accounts WHERE LOWER(email) = ? AND worker_id <> ? LIMIT 1',
      [normalizedEmail, workerId]
    );
    if (duplicateEmail) {
      return res.status(409).json({ message: 'duplicate_email' });
    }

    await withTransaction(async (connection) => {
      if (workerClause.sets.length) {
        await execute(
          `UPDATE workers SET ${workerClause.sets.join(', ')} WHERE id = ?`,
          [...workerClause.values, workerId],
          connection
        );
      }

      if (accountClause.sets.length) {
        await execute(
          `UPDATE worker_accounts SET ${accountClause.sets.join(', ')} WHERE worker_id = ?`,
          [...accountClause.values, workerId],
          connection
        );
      }

      if (password) {
        const passwordHash = await bcrypt.hash(password, 10);
        await execute(
          'UPDATE worker_accounts SET password_hash = ? WHERE worker_id = ?',
          [passwordHash, workerId],
          connection
        );
      }

      const profilePayload = sanitizeProfileForStorage(payload, normalizedEmail);
      await workerService.saveWorkerProfile(connection, workerId, profilePayload);
    });

    const updated = await getWorkerResponseById(workerId);
    if (!updated) return res.status(404).json({ message: 'not_found' });
    res.json(updated);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

app.patch('/api/admin/workers/:id/status', requireAuth, authorizeRoles('admin'), async (req, res) => {
  try {
    const workerId = Number(req.params.id);
    if (!Number.isFinite(workerId)) return res.status(400).json({ message: 'invalid_id' });
    const statusValue = String(req.body?.status || '').trim();
    if (!statusValue) return res.status(400).json({ message: 'missing_status' });

    await requireWorkerTables();
    if (!workerTableColumns.has('employment_status')) {
      return res.status(500).json({ message: 'workers_table_missing_status' });
    }

    await execute('UPDATE workers SET employment_status = ? WHERE id = ?', [statusValue, workerId]);
    const updated = await getWorkerResponseById(workerId);
    if (!updated) return res.status(404).json({ message: 'not_found' });
    res.json(updated);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

app.patch('/api/admin/workers/:id/assessment-access', requireAuth, authorizeRoles('admin'), async (req, res) => {
  try {
    const workerId = Number(req.params.id);
    if (!Number.isFinite(workerId)) return res.status(400).json({ message: 'invalid_id' });
    const enabled = Boolean(req.body?.enabled);

    const profilePayload = await workerService.fetchWorkerProfile(null, workerId);
    const nextPayload = profilePayload && typeof profilePayload === 'object'
      ? JSON.parse(JSON.stringify(profilePayload))
      : { personal: {}, identity: {}, address: {}, employment: {}, credentials: {} };

    nextPayload.employment = nextPayload.employment || {};
    nextPayload.employment.assessmentEnabled = enabled;

    await workerService.saveWorkerProfile(null, workerId, nextPayload);
    const updated = await getWorkerResponseById(workerId);
    if (!updated) return res.status(404).json({ message: 'not_found' });
    res.json(updated);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

app.delete('/api/admin/workers/:id', requireAuth, authorizeRoles('admin'), async (req, res) => {
  try {
    const workerId = Number(req.params.id);
    if (!Number.isFinite(workerId)) return res.status(400).json({ message: 'invalid_id' });

    await requireWorkerTables();
    const exists = await queryOne('SELECT id FROM workers WHERE id = ? LIMIT 1', [workerId]);
    if (!exists) return res.status(404).json({ message: 'not_found' });

    await withTransaction(async (connection) => {
      await execute('DELETE FROM worker_accounts WHERE worker_id = ?', [workerId], connection);
      await execute('DELETE FROM worker_profiles WHERE worker_id = ?', [workerId], connection);
      await execute('DELETE FROM workers WHERE id = ?', [workerId], connection);
    });

    res.json({ message: 'Deleted' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// ---------------------------------------------------------------------------
// Admin quizzes
// ---------------------------------------------------------------------------
const quizListQuerySchema = z.object({
  status: z.string().max(30).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
  search: z.string().max(120).trim().optional()
});

app.get('/api/admin/quizzes', requireAuth, authorizeRoles('admin'), async (req, res) => {
  try {
    const params = quizListQuerySchema.parse(req.query ?? {});
    const filters = [];
    const values = [];

    if (params.status) {
      filters.push('status = ?');
      values.push(params.status);
    }
    if (params.search) {
      const like = `%${params.search}%`;
      filters.push('(title LIKE ? OR category LIKE ?)');
      values.push(like, like);
    }

    const whereClause = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
    const countRows = await query(
      `SELECT COUNT(*) AS total FROM quizzes ${whereClause}`,
      values
    );
    const total = Number(countRows[0]?.total ?? 0);

    const items = await query(
      `SELECT * FROM quizzes ${whereClause}
       ORDER BY created_at DESC
       LIMIT ${params.limit} OFFSET ${params.offset}`,
      values
    );

    res.json({ items, total, limit: params.limit, offset: params.offset });
  } catch (error) {
    if (error?.issues) return res.status(400).json({ message: 'Invalid query', errors: error.issues });
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

app.post('/api/admin/quizzes/:id/approve', requireAuth, authorizeRoles('admin'), async (req, res) => {
  try {
    const quizId = String(req.params.id || '').trim();
    if (!quizId) return res.status(400).json({ message: 'invalid_id' });
    const result = await execute(
      `UPDATE quizzes SET status = 'approved', approved_by = ?, approved_at = NOW(6), rejected_reason = NULL
       WHERE id = ?`,
      [req.user?.id || null, quizId]
    );
    if (!result.affectedRows) return res.status(404).json({ message: 'not_found' });
    const updated = await queryOne('SELECT * FROM quizzes WHERE id = ? LIMIT 1', [quizId]);
    res.json(updated || { message: 'approved' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

app.post('/api/admin/quizzes/:id/reject', requireAuth, authorizeRoles('admin'), async (req, res) => {
  try {
    const quizId = String(req.params.id || '').trim();
    if (!quizId) return res.status(400).json({ message: 'invalid_id' });
    const reason = toNullableString(req.body?.reason) || null;
    const result = await execute(
      `UPDATE quizzes SET status = 'rejected', rejected_reason = ?
       WHERE id = ?`,
      [reason, quizId]
    );
    if (!result.affectedRows) return res.status(404).json({ message: 'not_found' });
    const updated = await queryOne('SELECT * FROM quizzes WHERE id = ? LIMIT 1', [quizId]);
    res.json(updated || { message: 'rejected' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// ---------------------------------------------------------------------------
// Projects and tasks
// ---------------------------------------------------------------------------
const uuidSchema = z.string().uuid();
const taskStatusEnum = z.enum(['todo', 'in-progress', 'done']);
const taskPriorityEnum = z.enum(['low', 'medium', 'high']);

const projectListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
  status: z.string().max(30).optional(),
  search: z.string().max(120).trim().optional()
});

app.get('/api/projects', requireAuth, authorizeRoles('admin', 'project_manager', 'pm'), async (req, res) => {
  try {
    const params = projectListQuerySchema.parse(req.query ?? {});
    const filters = [];
    const values = [];

    if (params.status) {
      filters.push('p.status = ?');
      values.push(params.status);
    }
    if (params.search) {
      const like = `%${params.search}%`;
      filters.push('(p.name LIKE ?)');
      values.push(like);
    }

    const whereClause = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
    const countRows = await query(
      `SELECT COUNT(*) AS total FROM projects p ${whereClause}`,
      values
    );
    const total = Number(countRows[0]?.total ?? 0);
    const items = await query(
      `SELECT p.id, p.name, p.status, p.owner_user_id, p.created_at, p.updated_at
       FROM projects p ${whereClause}
       ORDER BY p.created_at DESC
       LIMIT ${params.limit} OFFSET ${params.offset}`,
      values
    );

    res.json({ total, limit: params.limit, offset: params.offset, items });
  } catch (error) {
    if (error?.issues) return res.status(400).json({ message: 'Invalid query', errors: error.issues });
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

app.get('/api/pm/projects', requireAuth, authorizeRoles('project_manager', 'pm', 'admin'), async (req, res) => {
  try {
    const params = projectListQuerySchema.parse(req.query ?? {});
    const filters = [];
    const values = [];

    if (params.status) {
      filters.push('p.status = ?');
      values.push(params.status);
    }
    if (params.search) {
      const like = `%${params.search}%`;
      filters.push('(p.name LIKE ?)');
      values.push(like);
    }

    const whereClause = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
    const items = await query(
      `SELECT p.id, p.name, p.status, p.owner_user_id, p.created_at, p.updated_at
       FROM projects p ${whereClause}
       ORDER BY p.created_at DESC
       LIMIT ${params.limit} OFFSET ${params.offset}`,
      values
    );
    res.json(items);
  } catch (error) {
    if (error?.issues) return res.status(400).json({ message: 'Invalid query', errors: error.issues });
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

const createProjectSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  project_name: z.string().min(1).max(255).optional(),
  projectName: z.string().min(1).max(255).optional(),
  status: z.enum(['active', 'completed', 'archived']).optional(),
  owner_user_id: uuidSchema.optional(),
  description: z.string().optional(),
  project_description: z.string().optional(),
  project_type: z.string().max(120).optional(),
  site_address: z.string().max(255).optional(),
  latitude: z.coerce.number().optional(),
  longitude: z.coerce.number().optional(),
  start_date: z.string().optional(),
  end_date: z.string().optional()
}).refine(data => data.name || data.project_name || data.projectName, { message: 'name_required' });

app.post('/api/projects', requireAuth, authorizeRoles('admin', 'project_manager', 'pm'), async (req, res) => {
  try {
    const payload = createProjectSchema.parse(req.body ?? {});
    const projectId = randomUUID();
    const name = payload.name || payload.project_name || payload.projectName;
    const description = payload.description || payload.project_description || null;
    const ownerCandidate = payload.owner_user_id || req.user?.id || null;
    let ownerUserId = null;

    if (ownerCandidate) {
      const existingOwner = await queryOne('SELECT id FROM users WHERE id = ? LIMIT 1', [ownerCandidate]);
      ownerUserId = existingOwner?.id || null;
    }

    await execute(
      `INSERT INTO projects
        (id, name, owner_user_id, status, project_type, site_address, latitude, longitude, start_date, end_date, description)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        projectId,
        name,
        ownerUserId,
        payload.status || 'active',
        payload.project_type || null,
        payload.site_address || null,
        Number.isFinite(payload.latitude) ? payload.latitude : null,
        Number.isFinite(payload.longitude) ? payload.longitude : null,
        payload.start_date || null,
        payload.end_date || null,
        description
      ]
    );
    res.status(201).json({ id: projectId, name });
  } catch (error) {
    if (error?.issues) return res.status(400).json({ message: 'Invalid input', errors: error.issues });

    // Handle invalid user ID (FK violation) - likely stale token
    if (error?.code === 'ER_NO_REFERENCED_ROW_2' && (error?.message?.includes('fk_projects_owner') || error?.sqlMessage?.includes('fk_projects_owner') || error?.message?.includes('projects_ibfk_1'))) {
       return res.status(401).json({ message: 'ข้อมูลผู้ใช้งานไม่ถูกต้องหรือเซสชันหมดอายุ กรุณาออกจากระบบแล้วเข้าใหม่' });
    }

    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

app.delete('/api/projects/:id', requireAuth, authorizeRoles('admin', 'project_manager', 'pm'), async (req, res) => {
  try {
    const projectId = req.params.id;
    if (!uuidSchema.safeParse(projectId).success) return res.status(400).json({ message: 'invalid_id' });
    const result = await execute('DELETE FROM projects WHERE id = ?', [projectId]);
    if (!result.affectedRows) return res.status(404).json({ message: 'not_found' });
    res.json({ message: 'deleted' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

app.get('/api/projects/:id', requireAuth, authorizeRoles('admin', 'project_manager', 'pm'), async (req, res) => {
  try {
    const projectId = req.params.id;
    if (!uuidSchema.safeParse(projectId).success) return res.status(400).json({ message: 'invalid_id' });
    const project = await queryOne(
      `SELECT id, name, status, owner_user_id, project_type, site_address, latitude, longitude,
              start_date, end_date, description, created_at, updated_at
       FROM projects WHERE id = ? LIMIT 1`,
      [projectId]
    );
    if (!project) return res.status(404).json({ message: 'not_found' });
    res.json(project);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

const taskListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
  status: taskStatusEnum.optional(),
  project_id: uuidSchema.optional(),
  assignee_id: uuidSchema.optional(),
  search: z.string().max(120).trim().optional()
});

app.get('/api/tasks', requireAuth, authorizeRoles('admin', 'project_manager', 'pm'), async (req, res) => {
  try {
    const params = taskListQuerySchema.parse(req.query ?? {});
    const filters = [];
    const values = [];

    if (params.status) { filters.push('t.status = ?'); values.push(params.status); }
    if (params.project_id) { filters.push('t.project_id = ?'); values.push(params.project_id); }
    if (params.assignee_id) { filters.push('t.assignee_user_id = ?'); values.push(params.assignee_id); }
    if (params.search) {
      const like = `%${params.search}%`;
      filters.push('(t.title LIKE ? OR p.name LIKE ?)');
      values.push(like, like);
    }

    const whereClause = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
    const countRows = await query(
      `SELECT COUNT(*) AS total FROM tasks t JOIN projects p ON p.id = t.project_id ${whereClause}`,
      values
    );
    const total = Number(countRows[0]?.total ?? 0);

    const items = await query(
      `SELECT
         t.id,
         t.title,
         t.description,
         t.category,
         t.required_level,
         t.required_workers,
         t.status,
         t.priority,
         t.due_date,
         t.project_id,
         p.name AS project_name,
         t.site_id,
         s.name AS site_name,
         t.assignee_user_id,
         COALESCE(u.full_name, twa_summary.assigned_worker_names) AS assignee_name,
         twa_summary.first_assigned_at AS assigned_at
       FROM tasks t
       JOIN projects p ON p.id = t.project_id
       LEFT JOIN sites s ON s.id = t.site_id
       LEFT JOIN users u ON u.id = t.assignee_user_id
       LEFT JOIN (
         SELECT
           twa.task_id,
           GROUP_CONCAT(DISTINCT COALESCE(w.full_name, CONCAT('Worker#', twa.worker_id)) SEPARATOR ', ') AS assigned_worker_names,
           MIN(twa.assigned_at) AS first_assigned_at
         FROM task_worker_assignments twa
         LEFT JOIN workers w ON w.id = twa.worker_id
         GROUP BY twa.task_id
       ) twa_summary ON twa_summary.task_id = t.id
       ${whereClause}
       ORDER BY t.due_date ASC, t.title ASC
       LIMIT ${params.limit} OFFSET ${params.offset}`,
      values
    );

    res.json({ total, limit: params.limit, offset: params.offset, items });
  } catch (error) {
    if (error?.issues) return res.status(400).json({ message: 'Invalid query', errors: error.issues });
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

const createTaskSchema = z.object({
  title: z.string().min(1).max(200),
  project_id: uuidSchema,
  site_id: uuidSchema.optional(),
  priority: taskPriorityEnum.default('medium'),
  status: taskStatusEnum.default('todo'),
  assignee_user_id: uuidSchema.optional(),
  due_date: z.coerce.date().optional(),
  worker_ids: z.array(z.coerce.number().int().positive()).optional(),
  assignment_type: z.string().max(50).optional(),
  description: z.string().optional(),
  category: z.string().max(120).optional(),
  required_level: z.coerce.number().int().min(0).optional(),
  required_workers: z.coerce.number().int().min(0).optional()
});

app.post('/api/tasks', requireAuth, authorizeRoles('admin', 'project_manager', 'pm'), async (req, res) => {
  try {
    const payload = createTaskSchema.parse(req.body ?? {});
    const taskId = randomUUID();
    const workerIds = Array.isArray(payload.worker_ids) ? payload.worker_ids : [];
    const assignmentType = payload.assignment_type || 'general';

    const task = await withTransaction(async (connection) => {
      await execute(
        `INSERT INTO tasks
          (id, project_id, site_id, title, description, category, required_level, required_workers,
           priority, status, assignee_user_id, due_date)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          taskId,
          payload.project_id,
          payload.site_id || null,
          payload.title,
          payload.description || null,
          payload.category || null,
          payload.required_level ?? null,
          payload.required_workers ?? null,
          payload.priority,
          payload.status,
          payload.assignee_user_id || null,
          payload.due_date ? payload.due_date.toISOString().slice(0, 10) : null
        ],
        connection
      );

      for (const workerId of workerIds) {
        await execute(
          `INSERT INTO task_worker_assignments (id, task_id, worker_id, assignment_type, assigned_by_user_id)
           VALUES (?, ?, ?, ?, ?)`,
          [randomUUID(), taskId, workerId, assignmentType, req.user?.id || null],
          connection
        );
      }

      return queryOne(
        `SELECT t.id, t.title, t.description, t.category, t.required_level, t.required_workers,
          t.status, t.priority, t.due_date, t.project_id, p.name AS project_name,
          t.site_id, s.name AS site_name, t.assignee_user_id, u.full_name AS assignee_name
         FROM tasks t
         JOIN projects p ON p.id = t.project_id
         LEFT JOIN sites s ON s.id = t.site_id
         LEFT JOIN users u ON u.id = t.assignee_user_id
         WHERE t.id = ?`,
        [taskId],
        connection
      );
    });

    res.status(201).json(task);
  } catch (error) {
    if (error?.issues) return res.status(400).json({ message: 'Invalid input', errors: error.issues });
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

app.get('/api/tasks/:id', requireAuth, authorizeRoles('admin', 'project_manager', 'pm'), async (req, res) => {
  try {
    const taskId = req.params.id;
    if (!uuidSchema.safeParse(taskId).success) return res.status(400).json({ message: 'invalid id' });
    const task = await queryOne(
      `SELECT t.id, t.title, t.description, t.category, t.required_level, t.required_workers,
              t.status, t.priority, t.due_date, t.project_id, p.name AS project_name,
              t.site_id, s.name AS site_name, t.assignee_user_id, u.full_name AS assignee_name
       FROM tasks t
       JOIN projects p ON p.id = t.project_id
       LEFT JOIN sites s ON s.id = t.site_id
       LEFT JOIN users u ON u.id = t.assignee_user_id
       WHERE t.id = ?`,
      [taskId]
    );
    if (!task) return res.status(404).json({ message: 'not_found' });
    res.json(task);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

const updateTaskSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  project_id: uuidSchema.optional(),
  site_id: uuidSchema.optional().nullable(),
  description: z.string().optional().nullable(),
  category: z.string().max(120).optional().nullable(),
  required_level: z.coerce.number().int().min(0).optional().nullable(),
  required_workers: z.coerce.number().int().min(0).optional().nullable(),
  priority: taskPriorityEnum.optional(),
  status: taskStatusEnum.optional(),
  assignee_user_id: uuidSchema.optional().nullable(),
  due_date: z.coerce.date().optional().nullable()
}).refine(data => Object.keys(data).length > 0, { message: 'No fields to update' });

app.put('/api/tasks/:id', requireAuth, authorizeRoles('admin', 'project_manager', 'pm'), async (req, res) => {
  try {
    const taskId = req.params.id;
    if (!uuidSchema.safeParse(taskId).success) return res.status(400).json({ message: 'invalid id' });
    const payload = updateTaskSchema.parse(req.body ?? {});

    const updateData = {
      title: payload.title,
      project_id: payload.project_id,
      site_id: payload.site_id === undefined ? undefined : (payload.site_id || null),
      description: payload.description === undefined ? undefined : (payload.description || null),
      category: payload.category === undefined ? undefined : (payload.category || null),
      required_level: payload.required_level === undefined ? undefined : payload.required_level,
      required_workers: payload.required_workers === undefined ? undefined : payload.required_workers,
      priority: payload.priority,
      status: payload.status,
      assignee_user_id: payload.assignee_user_id === undefined ? undefined : (payload.assignee_user_id || null),
      due_date: payload.due_date === undefined ? undefined : (payload.due_date ? payload.due_date.toISOString().slice(0, 10) : null)
    };

    const clause = buildUpdateClause(updateData);
    if (!clause.sets.length) return res.status(400).json({ message: 'nothing_to_update' });

    const sql = `UPDATE tasks SET ${clause.sets.join(', ')}, updated_at = NOW(6) WHERE id = ?`;
    const result = await execute(sql, [...clause.values, taskId]);
    if (!result.affectedRows) return res.status(404).json({ message: 'not_found' });

    const task = await queryOne(
          `SELECT t.id, t.title, t.description, t.category, t.required_level, t.required_workers,
            t.status, t.priority, t.due_date, t.project_id, p.name AS project_name,
            t.site_id, s.name AS site_name, t.assignee_user_id, u.full_name AS assignee_name
       FROM tasks t
       JOIN projects p ON p.id = t.project_id
       LEFT JOIN sites s ON s.id = t.site_id
       LEFT JOIN users u ON u.id = t.assignee_user_id
       WHERE t.id = ?`,
      [taskId]
    );

    res.json(task);
  } catch (error) {
    if (error?.issues) return res.status(400).json({ message: 'Invalid input', errors: error.issues });
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

app.delete('/api/tasks/:id', requireAuth, authorizeRoles('admin', 'project_manager', 'pm'), async (req, res) => {
  try {
    const taskId = req.params.id;
    if (!uuidSchema.safeParse(taskId).success) return res.status(400).json({ message: 'invalid id' });
    const result = await execute('DELETE FROM tasks WHERE id = ?', [taskId]);
    if (!result.affectedRows) return res.status(404).json({ message: 'not_found' });
    res.status(204).send();
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// ---------------------------------------------------------------------------
// Dashboard metrics
// ---------------------------------------------------------------------------
app.get('/api/dashboard/project-task-counts', requireAuth, authorizeRoles('project_manager', 'admin', 'pm'), async (_req, res) => {
  try {
    const rows = await query(
      `SELECT
         p.id AS project_id,
         p.name AS project_name,
         p.project_type,
         COUNT(DISTINCT t.id) AS tasks_total,
         COUNT(DISTINCT CASE WHEN (t.status = 'todo' AND (twa.status IS NULL OR twa.status != 'completed') AND fa.id IS NULL) THEN t.id END) AS tasks_todo,
         COUNT(DISTINCT CASE WHEN (t.status = 'in-progress' AND (twa.status IS NULL OR twa.status != 'completed') AND fa.id IS NULL) THEN t.id END) AS tasks_in_progress,
         COUNT(DISTINCT CASE WHEN (t.status = 'done' OR twa.status = 'completed' OR fa.id IS NOT NULL) THEN t.id END) AS tasks_done
       FROM projects p
       LEFT JOIN tasks t ON t.project_id = p.id
       LEFT JOIN task_worker_assignments twa ON twa.task_id = t.id AND twa.assignment_type = 'practical_assessment'
       LEFT JOIN foreman_assessments fa ON twa.worker_id = fa.worker_id AND fa.percent IS NOT NULL
       GROUP BY p.id, p.name, p.project_type
       ORDER BY p.name`
    );
    res.json(rows.map(row => {
        // Fallback calculation in JS if needed, but SQL should handle it
        const done = Number(row.tasks_done ?? 0);
        const total = Number(row.tasks_total ?? 0);
        // If done > total (due to multiple workers/assessments per task?), clamp it?
        // Actually, with COUNT(DISTINCT t.id), we are counting TASKS.
        // But the conditions inside COUNT need to be careful.
        // Logic: A task is done if:
        // 1. It is marked done in tasks table
        // 2. OR it has a practical assessment assignment that is completed
        // 3. OR it has a practical assessment assignment assigned to a worker who has been assessed (fa.id IS NOT NULL)
        
        return {
          project_id: row.project_id,
          project_name: row.project_name,
          project_type: row.project_type,
          tasks_total: total,
          tasks_todo: Number(row.tasks_todo ?? 0),
          tasks_in_progress: Number(row.tasks_in_progress ?? 0),
          tasks_done: done
        };
    }));
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

app.get('/api/dashboard/practical-testing-count', requireAuth, authorizeRoles('project_manager', 'admin', 'pm'), async (_req, res) => {
  try {
    const rows = await query(
      `SELECT COUNT(DISTINCT twa.worker_id) AS count
       FROM task_worker_assignments twa
       JOIN tasks t ON t.id = twa.task_id
       WHERE twa.assignment_type = 'practical_assessment'
         AND twa.status IN ('todo', 'assigned', 'accepted', 'in-progress')
         AND t.status IN ('todo', 'in-progress')
         AND twa.worker_id NOT IN (
           SELECT DISTINCT fa.worker_id
           FROM foreman_assessments fa
           WHERE fa.percent IS NOT NULL
         )`
    );
    const workerRows = await query(
      `SELECT DISTINCT twa.worker_id
       FROM task_worker_assignments twa
       JOIN tasks t ON t.id = twa.task_id
       WHERE twa.assignment_type = 'practical_assessment'
         AND twa.status IN ('todo', 'assigned', 'accepted', 'in-progress')
         AND t.status IN ('todo', 'in-progress')
         AND twa.worker_id NOT IN (
           SELECT DISTINCT fa.worker_id
           FROM foreman_assessments fa
           WHERE fa.percent IS NOT NULL
         )`
    );
    res.json({
      count: Number(rows[0]?.count ?? 0),
      worker_ids: workerRows
        .map((row) => Number(row.worker_id))
        .filter((id) => Number.isFinite(id))
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// ---------------------------------------------------------------------------
// Worker tasks and assessments
// ---------------------------------------------------------------------------
app.get('/api/worker/tasks', requireAuth, authorizeRoles('worker', 'wk'), async (req, res) => {
  try {
    let workerId = await resolveWorkerIdFromRequest(req);
    await ensureForemanAssessmentSchema();

    if (!Number.isFinite(workerId)) {
      const jwtFullName = String(req.user?.full_name || '').trim();
      if (jwtFullName) {
        const fallbackWorker = await queryOne(
          `SELECT w.id
           FROM workers w
           LEFT JOIN task_worker_assignments twa ON twa.worker_id = w.id
           WHERE REPLACE(TRIM(w.full_name), ' ', '') = REPLACE(TRIM(?), ' ', '')
              OR w.full_name LIKE ?
           GROUP BY w.id
           ORDER BY COUNT(twa.id) DESC, w.id DESC
           LIMIT 1`,
          [jwtFullName, `%${jwtFullName}%`]
        );
        const mappedId = Number(fallbackWorker?.id);
        if (Number.isFinite(mappedId)) workerId = mappedId;
      }
    }

    if (!Number.isFinite(workerId)) return res.json([]);

    const rows = await query(
      `SELECT
         t.id AS task_id,
         t.title,
         t.description,
         t.category,
         t.project_id,
         t.due_date,
         p.name AS project_name,
         s.name AS site_name,
         twa.assignment_type,
         twa.assigned_by_user_id,
         twa.assigned_at,
         u.full_name AS assigned_by_name,
         wf.full_name AS assigned_by_worker_name,
         CASE
           WHEN twa.status = 'submitted'
                AND EXISTS (
                  SELECT 1
                  FROM foreman_assessments fa
                  WHERE fa.worker_id = twa.worker_id
                )
             THEN 'completed'
           ELSE twa.status
         END AS assignment_status
       FROM task_worker_assignments twa
       JOIN tasks t ON t.id = twa.task_id
       JOIN projects p ON p.id = t.project_id
       LEFT JOIN sites s ON s.id = t.site_id
       LEFT JOIN users u ON u.id = twa.assigned_by_user_id
       LEFT JOIN workers wf ON twa.assigned_by_user_id REGEXP '^[0-9]+$'
                           AND wf.id = CAST(twa.assigned_by_user_id AS UNSIGNED)
       WHERE twa.worker_id = ?
       ORDER BY twa.assigned_at DESC`,
      [workerId]
    );

    const items = rows.map(row => ({
      id: row.task_id,
      project_id: row.project_id,
      task_title: row.title,
      project: row.project_name || '',
      location: row.site_name || row.title || '',
      description_detail: row.description || '',
      category: row.category || '',
      assignment_type: row.assignment_type || 'general',
      foreman: row.assigned_by_name || row.assigned_by_worker_name || '-',
      date: row.due_date
        ? String(row.due_date).slice(0, 10)
        : (row.assigned_at ? String(row.assigned_at).slice(0, 10) : ''),
      status: row.assignment_status || 'assigned'
    }));

    res.json(items);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

app.post('/api/worker/tasks/:id/accept', requireAuth, authorizeRoles('worker', 'wk'), async (req, res) => {
  try {
    const taskId = req.params.id;
    const workerId = await resolveWorkerIdFromRequest(req);
    if (!Number.isFinite(workerId)) return res.status(400).json({ message: 'invalid_id' });

    const result = await execute(
      `UPDATE task_worker_assignments SET status = 'accepted', started_at = NOW(6)
       WHERE task_id = ? AND worker_id = ? AND status IN ('assigned', 'todo')`,
      [taskId, workerId]
    );
    if (!result.affectedRows) return res.status(404).json({ message: 'not_found' });
    res.json({ message: 'accepted' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

app.post('/api/worker/tasks/:id/submit', requireAuth, authorizeRoles('worker', 'wk'), workerSubmissionUpload.single('photo'), async (req, res) => {
  try {
    const taskId = req.params.id;
    const workerId = await resolveWorkerIdFromRequest(req);
    if (!Number.isFinite(workerId)) return res.status(400).json({ message: 'invalid_id' });

    const descriptionText = typeof req.body?.description === 'string'
      ? req.body.description.trim().slice(0, 4000)
      : null;
    const uploadedPhotoPath = req.file?.filename
      ? `/uploads/worker-submissions/${req.file.filename}`
      : null;
    const photoName = uploadedPhotoPath || (typeof req.body?.photo === 'string'
      ? req.body.photo.trim().slice(0, 255)
      : null);
    const submittedAtInput = req.body?.submittedAt ? new Date(req.body.submittedAt) : new Date();
    const submittedAt = Number.isNaN(submittedAtInput.getTime()) ? new Date() : submittedAtInput;

    const currentAssignment = await queryOne(
      `SELECT status FROM task_worker_assignments WHERE task_id = ? AND worker_id = ? LIMIT 1`,
      [taskId, workerId]
    );
    if (!currentAssignment) return res.status(404).json({ message: 'not_found' });

    const currentStatus = String(currentAssignment.status || '').toLowerCase();
    if (currentStatus === 'approved' || currentStatus === 'completed') {
      return res.status(409).json({ message: 'state_locked', status: currentAssignment.status });
    }

    let updateResult = null;

    await withTransaction(async (connection) => {
      await ensureWorkerTaskSubmissionSchema(connection);

      updateResult = await execute(
        `UPDATE task_worker_assignments SET status = 'submitted', completed_at = NOW(6)
         WHERE task_id = ? AND worker_id = ?`,
        [taskId, workerId],
        connection
      );

      await execute(
        `INSERT INTO worker_task_submissions
           (id, task_id, worker_id, description, photo, submitted_at)
         VALUES (?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           description = VALUES(description),
           photo = COALESCE(VALUES(photo), photo),
           submitted_at = VALUES(submitted_at),
           updated_at = CURRENT_TIMESTAMP(6)`,
        [
          randomUUID(),
          taskId,
          workerId,
          descriptionText || null,
          photoName || null,
          submittedAt
        ],
        connection
      );
    });

    if (!updateResult?.affectedRows) return res.status(404).json({ message: 'not_found' });
    res.json({ message: 'submitted' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

app.get('/api/worker/history', requireAuth, authorizeRoles('worker', 'wk'), async (req, res) => {
  try {
    const workerId = await resolveWorkerIdFromRequest(req);
    if (!Number.isFinite(workerId)) return res.status(400).json({ message: 'invalid_id' });

    const rows = await query(
      `SELECT
         t.id AS task_id,
         t.title,
         t.due_date,
         p.name AS project_name,
         s.name AS site_name,
         twa.status AS assignment_status,
         twa.completed_at
       FROM task_worker_assignments twa
       JOIN tasks t ON t.id = twa.task_id
       JOIN projects p ON p.id = t.project_id
       LEFT JOIN sites s ON s.id = t.site_id
       WHERE twa.worker_id = ?
       ORDER BY COALESCE(twa.completed_at, t.due_date) DESC`,
      [workerId]
    );

    const items = rows.map(row => ({
      id: row.task_id,
      project: row.project_name || '',
      location: row.site_name || row.title || '',
      date: (row.completed_at || row.due_date) ? String(row.completed_at || row.due_date).slice(0, 10) : '',
      status: row.assignment_status || 'submitted'
    }));

    res.json(items);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

app.get('/api/worker/assessment/summary', requireAuth, authorizeRoles('worker', 'wk'), async (req, res) => {
  try {
    const workerId = await resolveWorkerIdFromRequest(req);
    if (!Number.isFinite(workerId)) return res.status(400).json({ message: 'invalid_id' });

    const row = await queryOne(
      `SELECT id, round_id, session_id, total_score, total_questions, passed, finished_at, category, breakdown
       FROM worker_assessment_results
       WHERE worker_id = ?
       ORDER BY finished_at DESC
       LIMIT 1`,
      [workerId]
    );
    if (!row) return res.status(404).json({ message: 'not_found' });

    const practicalRow = await queryOne(
      `SELECT percent
       FROM foreman_assessments
       WHERE worker_id = ?
       ORDER BY created_at DESC
       LIMIT 1`,
      [workerId]
    );

    let roundRow = null;
    if (row.round_id) {
      roundRow = await queryOne(
        `SELECT id, title, passing_score, question_count, criteria, difficulty_weights
         FROM assessment_rounds
         WHERE id = ?
         LIMIT 1`,
        [row.round_id]
      );
    }
    const { scoreWeights, passThreshold } = resolveScoringConfig(roundRow);
    const sessionLevel = await inferAssessmentLevelFromSession(row.session_id);
    const inferredRoundLevel = sessionLevel ?? inferAssessmentLevelFromRound(roundRow);
    const roundLevel = row.round_id
      ? inferredRoundLevel
      : (Boolean(row.passed) ? 1 : null);

    let breakdown = [];
    let details = [];
    let wrongAnswers = [];
    if (row.breakdown) {
      if (typeof row.breakdown === 'object') {
        if (Array.isArray(row.breakdown)) {
          breakdown = row.breakdown;
        } else {
          breakdown = Array.isArray(row.breakdown.items)
            ? row.breakdown.items
            : (Array.isArray(row.breakdown.breakdown) ? row.breakdown.breakdown : []);
          details = Array.isArray(row.breakdown.details) ? row.breakdown.details : [];
          wrongAnswers = Array.isArray(row.breakdown.wrongAnswers) ? row.breakdown.wrongAnswers : [];
        }
      }
      else if (typeof row.breakdown === 'string') {
        try {
          const parsed = JSON.parse(row.breakdown);
          if (Array.isArray(parsed)) {
            breakdown = parsed;
          } else {
            breakdown = Array.isArray(parsed?.items)
              ? parsed.items
              : (Array.isArray(parsed?.breakdown) ? parsed.breakdown : []);
            details = Array.isArray(parsed?.details) ? parsed.details : [];
            wrongAnswers = Array.isArray(parsed?.wrongAnswers) ? parsed.wrongAnswers : [];
          }
        } catch (e) {}
      }
    }

    if (!wrongAnswers.length && details.length) {
      wrongAnswers = details.filter(item => item?.isCorrect === false);
    }

    const questionNoById = new Map();
    const allowedSessionQuestionIds = new Set();
    if (row.session_id) {
      try {
        const sessionQuestionRows = await query(
          `SELECT question_id, display_order
           FROM assessment_session_questions
           WHERE session_id = ?
           ORDER BY display_order ASC`,
          [row.session_id]
        );
        for (const sessionRow of sessionQuestionRows) {
          const key = String(sessionRow.question_id ?? '').trim();
          const order = Number(sessionRow.display_order);
          if (key) {
            allowedSessionQuestionIds.add(key);
          }
          if (key && Number.isFinite(order) && order > 0) {
            questionNoById.set(key, Math.trunc(order));
          }
        }
      } catch (sessionError) {
        if (sessionError?.code !== 'ER_NO_SUCH_TABLE' && sessionError?.code !== 'ER_BAD_TABLE_ERROR') {
          throw sessionError;
        }
      }
    }

    const summaryItems = [...details, ...wrongAnswers].filter(Boolean);
    const hasMissingCorrect = summaryItems.some(item => {
      const hasCorrectAnswer = item?.correctAnswer !== null && item?.correctAnswer !== undefined && item?.correctAnswer !== '';
      const hasCorrectIndex = item?.correctIndex !== null && item?.correctIndex !== undefined && item?.correctIndex !== '';
      return !hasCorrectAnswer && !hasCorrectIndex;
    });

    if (hasMissingCorrect) {
      const numericQuestionIds = Array.from(new Set(
        summaryItems
          .map(item => Number(item?.questionId))
          .filter(value => Number.isFinite(value))
      ));

      if (numericQuestionIds.length) {
        const answerPlaceholders = numericQuestionIds.map(() => '?').join(', ');
        const answerRows = await query(
          `SELECT id, answer
           FROM question_Structural
           WHERE id IN (${answerPlaceholders})`,
          numericQuestionIds
        );

        const letterToIndex = { a: 0, b: 1, c: 2, d: 3 };
        const answerById = new Map(
          answerRows.map(row => [
            String(row.id),
            {
              correctAnswer: String(row.answer || '').toLowerCase(),
              correctIndex: letterToIndex[String(row.answer || '').toLowerCase()] ?? null
            }
          ])
        );

        const enrichCorrect = (item, fallbackIndex) => {
          if (!item || typeof item !== 'object') return item;
          const key = String(item.questionId ?? '');
          const fallback = answerById.get(key);
          const next = { ...item };

          const missingAnswer = next.correctAnswer === null || next.correctAnswer === undefined || next.correctAnswer === '';
          const missingIndex = next.correctIndex === null || next.correctIndex === undefined || next.correctIndex === '';

          if (fallback) {
            if (missingAnswer && fallback.correctAnswer) next.correctAnswer = fallback.correctAnswer;
            if (missingIndex && Number.isFinite(fallback.correctIndex)) next.correctIndex = fallback.correctIndex;
          }

          const mappedNo = key && questionNoById.has(key) ? questionNoById.get(key) : null;
          if (Number.isFinite(mappedNo) && mappedNo > 0) {
            next.questionNo = mappedNo;
          } else if (!(Number.isFinite(Number(next.questionNo)) && Number(next.questionNo) > 0)) {
            next.questionNo = fallbackIndex + 1;
          }

          return next;
        };

        details = details.map((item, index) => enrichCorrect(item, index));
        wrongAnswers = wrongAnswers.map((item, index) => enrichCorrect(item, index));
      }
    }

    const indexToAnswer = ['a', 'b', 'c', 'd'];
    const answerToIndex = { a: 0, b: 1, c: 2, d: 3 };

    const normalizeIndex = (rawIndex, rawAnswer) => {
      if (rawIndex !== null && rawIndex !== undefined && rawIndex !== '' && Number.isFinite(Number(rawIndex))) {
        return Math.trunc(Number(rawIndex));
      }
      const answer = String(rawAnswer || '').trim().toLowerCase();
      if (Object.prototype.hasOwnProperty.call(answerToIndex, answer)) {
        return answerToIndex[answer];
      }
      return null;
    };

    details = details.map((item, index) => {
      const key = String(item?.questionId ?? '').trim();
      const selectedIndex = normalizeIndex(item?.selectedIndex, item?.selectedAnswer);
      const correctIndex = normalizeIndex(item?.correctIndex, item?.correctAnswer);
      const selectedAnswer = item?.selectedAnswer || (Number.isFinite(selectedIndex) ? (indexToAnswer[selectedIndex] || null) : null);
      const correctAnswer = item?.correctAnswer || (Number.isFinite(correctIndex) ? (indexToAnswer[correctIndex] || null) : null);
      const mappedNo = key && questionNoById.has(key) ? questionNoById.get(key) : null;
      const questionNo = Number.isFinite(mappedNo) && mappedNo > 0
        ? mappedNo
        : (Number.isFinite(Number(item?.questionNo)) && Number(item.questionNo) > 0 ? Math.trunc(Number(item.questionNo)) : index + 1);
      const isCorrect = Number.isFinite(selectedIndex) && Number.isFinite(correctIndex) && selectedIndex === correctIndex;

      return {
        ...item,
        questionNo,
        selectedIndex,
        correctIndex,
        selectedAnswer,
        correctAnswer,
        isCorrect
      };
    });

    if (allowedSessionQuestionIds.size > 0) {
      details = details.filter((item) => {
        const key = String(item?.questionId ?? '').trim();
        if (!key) return false;
        if (allowedSessionQuestionIds.has(key)) return true;
        const numericKey = Number(key);
        return Number.isFinite(numericKey) && allowedSessionQuestionIds.has(String(numericKey));
      });
    }

    wrongAnswers = details
      .filter(item => item?.isCorrect === false)
      .sort((left, right) => Number(left?.questionNo || 0) - Number(right?.questionNo || 0));

    const roundQuestionCount = Number(roundRow?.question_count ?? 0);
    const persistedTotalQuestions = Number(row.total_questions ?? 0);
    const fallbackTotalQuestions = roundQuestionCount > 0 ? roundQuestionCount : persistedTotalQuestions;
    const detailsCorrectCount = details.filter(item => item?.isCorrect === true).length;
    const resolvedTotalQuestions = fallbackTotalQuestions > 0
      ? fallbackTotalQuestions
      : (details.length > 0 ? details.length : persistedTotalQuestions);
    const resolvedScore = (wrongAnswers.length > 0 && resolvedTotalQuestions > 0)
      ? Math.max(0, resolvedTotalQuestions - wrongAnswers.length)
      : (resolvedTotalQuestions > 0
          ? Math.min(detailsCorrectCount, resolvedTotalQuestions)
          : Number(row.total_score ?? 0));
    const hasPracticalAssessment = practicalRow?.percent !== null && practicalRow?.percent !== undefined;
    const practicalPercent = hasPracticalAssessment ? Number(practicalRow.percent) : 0;
    const resolvedTheoryPercent = resolvedTotalQuestions > 0
      ? (resolvedScore / resolvedTotalQuestions) * 100
      : 0;
    const resolvedWeighted = computeWeightedAssessment({
      theoryPercent: resolvedTheoryPercent,
      practicalPercent,
      scoreWeights,
      passThreshold
    });

    const persistedScore = Number(row.total_score ?? 0);
    const persistedTotal = Number(row.total_questions ?? 0);
    const persistedPassed = Boolean(row.passed);
    const resolvedPassed = hasPracticalAssessment ? resolvedWeighted.passed : null;
    const shouldSyncAggregates =
      persistedScore !== resolvedScore ||
      persistedTotal !== resolvedTotalQuestions ||
      (hasPracticalAssessment && persistedPassed !== resolvedWeighted.passed);

    if (shouldSyncAggregates) {
      if (hasPracticalAssessment) {
        await execute(
          `UPDATE worker_assessment_results
           SET total_score = ?, total_questions = ?, passed = ?, breakdown = ?, updated_at = NOW(6)
           WHERE id = ?`,
          [
            resolvedScore,
            resolvedTotalQuestions,
            resolvedWeighted.passed ? 1 : 0,
            JSON.stringify({
              items: breakdown,
              details,
              wrongAnswers
            }),
            row.id
          ]
        );
      } else {
        await execute(
          `UPDATE worker_assessment_results
           SET total_score = ?, total_questions = ?, breakdown = ?, updated_at = NOW(6)
           WHERE id = ?`,
          [
            resolvedScore,
            resolvedTotalQuestions,
            JSON.stringify({
              items: breakdown,
              details,
              wrongAnswers
            }),
            row.id
          ]
        );
      }
    }

    await promoteWorkerIfPassed(workerId, hasPracticalAssessment && resolvedWeighted.passed);

    res.json({
      result: {
        score: resolvedScore,
        totalQuestions: resolvedTotalQuestions,
        passed: resolvedPassed,
        theoryPercent: resolvedWeighted.theoryPercent,
        practicalPercent: hasPracticalAssessment ? resolvedWeighted.practicalPercent : null,
        combinedPercent: hasPracticalAssessment ? resolvedWeighted.combinedPercent : null,
        passingScorePct: passThreshold,
        scoreWeights,
        roundLevel,
        roundQuestionCount: roundQuestionCount > 0 ? roundQuestionCount : null,
        practicalCompleted: hasPracticalAssessment,
        resultReady: hasPracticalAssessment,
        category: row.category || null,
        breakdown,
        details,
        wrongAnswers
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

app.get('/api/worker/practical-result', requireAuth, authorizeRoles('worker', 'wk'), async (req, res) => {
  try {
    const workerId = await resolveWorkerIdFromRequest(req);
    if (!Number.isFinite(workerId)) return res.status(400).json({ message: 'invalid_id' });

    const latestTheoryRow = await queryOne(
      `SELECT round_id
       FROM worker_assessment_results
       WHERE worker_id = ?
       ORDER BY finished_at DESC
       LIMIT 1`,
      [workerId]
    );

    let roundRow = null;
    if (latestTheoryRow?.round_id) {
      roundRow = await queryOne(
        `SELECT id, passing_score, criteria
         FROM assessment_rounds
         WHERE id = ?
         LIMIT 1`,
        [latestTheoryRow.round_id]
      );
    }

    const { scoreWeights } = resolveScoringConfig(roundRow);
    const practicalWeight = Number.isFinite(Number(scoreWeights?.practical))
      ? Number(scoreWeights.practical)
      : 30;

    const practicalRow = await queryOne(
      `SELECT fa.percent,
              fa.grade,
              fa.comment,
              fa.created_at,
              fa.foreman_user_id,
              fa.criteria_json,
              u.full_name AS assessor_name
       FROM foreman_assessments fa
       LEFT JOIN users u ON u.id = fa.foreman_user_id
       WHERE fa.worker_id = ?
       ORDER BY fa.created_at DESC
       LIMIT 1`,
      [workerId]
    );

    if (!practicalRow) {
      return res.json({
        hasResult: false,
        result: null,
        practicalWeight
      });
    }

    const practicalPercent = Number(practicalRow.percent || 0);
    const weightedContributionPercent = Number(((practicalPercent * practicalWeight) / 100).toFixed(2));
    let criteriaScores = {};
    if (practicalRow.criteria_json && typeof practicalRow.criteria_json === 'object') {
      criteriaScores = practicalRow.criteria_json;
    } else if (typeof practicalRow.criteria_json === 'string' && practicalRow.criteria_json.trim()) {
      try {
        const parsedCriteria = JSON.parse(practicalRow.criteria_json);
        if (parsedCriteria && typeof parsedCriteria === 'object') {
          criteriaScores = parsedCriteria;
        }
      } catch (error) {
        criteriaScores = {};
      }
    }
    let assessorName = practicalRow.assessor_name || null;
    if (!assessorName && practicalRow.foreman_user_id) {
      const numericForemanId = Number(practicalRow.foreman_user_id);
      if (Number.isFinite(numericForemanId)) {
        const foremanWorkerRow = await queryOne(
          `SELECT full_name
           FROM workers
           WHERE id = ?
           LIMIT 1`,
          [numericForemanId]
        );
        assessorName = foremanWorkerRow?.full_name || null;
      }
    }
    if (!assessorName) {
      assessorName = practicalRow.foreman_user_id ? `รหัส ${practicalRow.foreman_user_id}` : 'ไม่ระบุ';
    }

    res.json({
      hasResult: true,
      practicalWeight,
      result: {
        practicalPercent,
        weightedContributionPercent,
        grade: practicalRow.grade || null,
        comment: practicalRow.comment || null,
        assessedAt: practicalRow.created_at || null,
        assessorName,
        assessorId: practicalRow.foreman_user_id || null,
        criteriaScores
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(6)
});

app.post('/api/foreman/change-password', requireAuth, authorizeRoles('foreman', 'fm'), async (req, res) => {
  try {
    const payload = changePasswordSchema.parse(req.body ?? {});
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: 'unauthorized' });

    const user = await queryOne(
      'SELECT id, password_hash FROM users WHERE id = ? LIMIT 1',
      [userId]
    );
    if (!user || !user.password_hash) return res.status(404).json({ message: 'not_found' });

    const match = await bcrypt.compare(payload.currentPassword, user.password_hash);
    if (!match) return res.status(400).json({ message: 'invalid_current_password' });

    const newHash = await bcrypt.hash(payload.newPassword, 10);
    await execute(
      'UPDATE users SET password_hash = ?, updated_at = NOW(6) WHERE id = ?',
      [newHash, userId]
    );

    res.json({ message: 'password_updated' });
  } catch (error) {
    if (error?.issues) return res.status(400).json({ message: 'Invalid input', errors: error.issues });
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

const foremanAssessmentSchema = z.object({
  worker_id: z.coerce.number().int().positive(),
  criteria: z.record(z.number().int().min(1).max(4)),
  comment: z.string().max(2000).optional().nullable(),
  total_score: z.number().int().nonnegative(),
  max_score: z.number().int().positive(),
  percent: z.number().min(0).max(100),
  grade: z.string().max(50)
});

const foremanReportSchema = z.object({
  date: z.string().min(1),
  reportType: z.string().max(20),
  projectId: z.string().min(1),
  projectName: z.string().max(255).optional().nullable(),
  workDone: z.string().min(1),
  problems: z.string().optional().nullable(),
  attachment: z.string().max(255).optional().nullable()
});

app.get('/api/foreman/pending-workers', requireAuth, authorizeRoles('foreman', 'admin', 'project_manager', 'pm'), async (_req, res) => {
  try {
    await requireWorkerTables();
    await ensureForemanAssessmentSchema();
    await ensureWorkerTaskSubmissionSchema();

    const rows = await query(
      `SELECT
         p.worker_id AS id,
         w.full_name,
         w.trade_type,
         p.pending_at,
         p.task_id,
         t.title AS task_title,
         wts.description AS submission_description,
         wts.photo AS submission_photo,
         wts.submitted_at AS submission_submitted_at,
         war.total_score AS theory_total_score,
         war.total_questions AS theory_total_questions,
         war.session_id AS session_id
       FROM (
         SELECT x.worker_id, x.task_id, x.pending_at
         FROM (
           SELECT
             twa.worker_id,
             twa.task_id,
             COALESCE(wts.submitted_at, twa.completed_at, twa.assigned_at) AS pending_at,
             ROW_NUMBER() OVER (
               PARTITION BY twa.worker_id
               ORDER BY COALESCE(wts.submitted_at, twa.completed_at, twa.assigned_at) DESC, twa.assigned_at DESC
             ) AS rn
           FROM task_worker_assignments twa
           LEFT JOIN worker_task_submissions wts
             ON wts.task_id = twa.task_id AND wts.worker_id = twa.worker_id
           WHERE twa.assignment_type = 'practical_assessment'
             AND twa.status = 'submitted'
             AND twa.worker_id NOT IN (SELECT worker_id FROM foreman_assessments)
         ) x
         WHERE x.rn = 1
       ) p
       JOIN workers w ON w.id = p.worker_id
       JOIN tasks t ON t.id = p.task_id
       LEFT JOIN worker_task_submissions wts
         ON wts.task_id = p.task_id AND wts.worker_id = p.worker_id
       LEFT JOIN (
         SELECT latest.worker_id, latest.total_score, latest.total_questions, latest.session_id
         FROM (
           SELECT
             r.worker_id,
             r.total_score,
             r.total_questions,
             r.session_id,
             ROW_NUMBER() OVER (
               PARTITION BY r.worker_id
               ORDER BY COALESCE(r.finished_at, r.updated_at, r.created_at) DESC
             ) AS rn
           FROM worker_assessment_results r
           WHERE r.category = 'structure'
         ) latest
         WHERE latest.rn = 1
       ) war ON war.worker_id = p.worker_id
       ORDER BY p.pending_at DESC`
    );

    const items = await Promise.all(rows.map(async (row) => {
      let theoryLevel = null;
      if (row.session_id) {
         theoryLevel = await inferAssessmentLevelFromSession(row.session_id);
      }

      return {
      id: row.id,
      name: row.full_name || 'ไม่ระบุ',
      roleName: getTradeLabel(row.trade_type) || row.trade_type || 'ช่างทั่วไป',
      role_name: getTradeLabel(row.trade_type) || row.trade_type || 'ช่างทั่วไป',
      date: row.pending_at ? String(row.pending_at).slice(0, 10) : '',
      taskId: row.task_id || null,
      taskTitle: row.task_title || null,
      theory: {
        score: row.theory_total_score ?? null,
        totalQuestions: row.theory_total_questions ?? null,
        level: theoryLevel
      },
      submission: {
        description: row.submission_description || null,
        photo: row.submission_photo || null,
        submittedAt: row.submission_submitted_at || row.pending_at || null
      }
    };
    }));

    res.json({ items });
  } catch (error) {
    if (error?.code === 'ER_NO_SUCH_TABLE') {
      return res.json({ items: [] });
    }
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

app.post('/api/foreman/assessments', requireAuth, authorizeRoles('foreman', 'admin', 'project_manager', 'pm'), async (req, res) => {
  try {
    const payload = foremanAssessmentSchema.parse(req.body ?? {});

    await requireWorkerTables();
    const workerRow = await queryOne('SELECT id FROM workers WHERE id = ? LIMIT 1', [payload.worker_id]);
    if (!workerRow) return res.status(404).json({ message: 'not_found' });

    const assessmentId = randomUUID();
    const criteriaJson = JSON.stringify(payload.criteria ?? {});

    await withTransaction(async (connection) => {
      await ensureForemanAssessmentSchema(connection);
      await execute(
        `INSERT INTO foreman_assessments
          (id, worker_id, foreman_user_id, criteria_json, total_score, max_score, percent, grade, comment)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          assessmentId,
          payload.worker_id,
          req.user?.id || null,
          criteriaJson,
          payload.total_score,
          payload.max_score,
          payload.percent,
          payload.grade,
          payload.comment ?? null
        ],
        connection
      );

      // Mark practical submitted tasks as completed so they disappear from pending list
      
      // First, get the task_ids that will be completed
      const tasksToComplete = await query(
        `SELECT task_id FROM task_worker_assignments 
         WHERE worker_id = ? 
           AND assignment_type = 'practical_assessment' 
           AND status = 'submitted'`,
        [payload.worker_id],
        connection
      );

      const practicalUpdateResult = await execute(
        `UPDATE task_worker_assignments
         SET status = 'completed', completed_at = NOW(6)
         WHERE worker_id = ?
           AND assignment_type = 'practical_assessment'
           AND status = 'submitted'`,
        [payload.worker_id],
        connection
      );
      
      // Update parent tasks status to 'done'
      if (tasksToComplete.length > 0) {
        const taskIds = tasksToComplete.map(t => t.task_id);
        if (taskIds.length > 0) {
           // Construct placeholders like (?,?,?)
           const placeholders = taskIds.map(() => '?').join(',');
           await execute(
             `UPDATE tasks SET status = 'done' WHERE id IN (${placeholders})`,
             taskIds,
             connection
           );
        }
      }

      // Fallback for legacy rows that were submitted but assignment_type is not practical_assessment
      if (!Number(practicalUpdateResult?.affectedRows || 0)) {
        // Get fallback task ids
        const fallbackTasks = await query(
           `SELECT task_id FROM task_worker_assignments 
            WHERE worker_id = ? AND status = 'submitted'`,
           [payload.worker_id],
           connection
        );
        
        await execute(
          `UPDATE task_worker_assignments
           SET status = 'completed', completed_at = NOW(6)
           WHERE worker_id = ?
             AND status = 'submitted'`,
          [payload.worker_id],
          connection
        );
        
        // Update parent tasks for fallback
        if (fallbackTasks.length > 0) {
            const fbTaskIds = fallbackTasks.map(t => t.task_id);
            if (fbTaskIds.length > 0) {
               const placeholders = fbTaskIds.map(() => '?').join(',');
               await execute(
                 `UPDATE tasks SET status = 'done' WHERE id IN (${placeholders})`,
                 fbTaskIds,
                 connection
               );
            }
        }
      }
    });

    const latestTheoryRow = await queryOne(
      `SELECT id, round_id, total_score, total_questions
       FROM worker_assessment_results
       WHERE worker_id = ? AND category = 'structure'
       ORDER BY finished_at DESC
       LIMIT 1`,
      [payload.worker_id]
    );

    if (latestTheoryRow) {
      let roundRow = null;
      if (latestTheoryRow.round_id) {
        roundRow = await queryOne(
          `SELECT id, passing_score, criteria
           FROM assessment_rounds
           WHERE id = ?
           LIMIT 1`,
          [latestTheoryRow.round_id]
        );
      }
      const { scoreWeights, passThreshold } = resolveScoringConfig(roundRow);
      const theoryPercent = Number(latestTheoryRow.total_questions) > 0
        ? (Number(latestTheoryRow.total_score || 0) / Number(latestTheoryRow.total_questions)) * 100
        : 0;
      const weighted = computeWeightedAssessment({
        theoryPercent,
        practicalPercent: Number(payload.percent || 0),
        scoreWeights,
        passThreshold
      });
      await execute(
        `UPDATE worker_assessment_results
         SET passed = ?, updated_at = NOW(6)
         WHERE id = ?`,
        [weighted.passed ? 1 : 0, latestTheoryRow.id]
      );
      await promoteWorkerIfPassed(payload.worker_id, weighted.passed);
    }

    res.status(201).json({ id: assessmentId });
  } catch (error) {
    if (error?.issues) return res.status(400).json({ message: 'Invalid input', errors: error.issues });
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

app.get('/api/foreman/projects', requireAuth, authorizeRoles('foreman', 'admin', 'project_manager', 'pm'), async (req, res) => {
  try {
    // If user is foreman, get projects they are member of
    let querySql = `SELECT id, name FROM projects ORDER BY created_at DESC LIMIT 200`;
    let params = [];
    
    if (req.user && (req.user.role === 'foreman' || req.user.roles?.includes('foreman'))) {
       querySql = `
         SELECT p.id, p.name 
         FROM projects p
         JOIN project_members pm ON p.id = pm.project_id
         WHERE pm.user_id = ?
         ORDER BY p.created_at DESC
       `;
       params = [req.user.id];
    }
    
    // Fallback: If no projects found for foreman, maybe return all? user requested "projects overseen"
    // Ideally only assigned projects. Let's return empty if none.
    
    const rows = await query(querySql, params);
    
    // If no rows and it's a foreman, try to get projects where they are owner too (just in case)
    if (rows.length === 0 && params.length > 0) {
        const ownerRows = await query(`SELECT id, name FROM projects WHERE owner_user_id = ?`, params);
        res.json({ items: ownerRows.map(row => ({ id: row.id, name: row.name })) });
        return;
    }

    res.json({ items: rows.map(row => ({ id: row.id, name: row.name })) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

app.get('/api/foreman/assessed-workers', requireAuth, authorizeRoles('foreman', 'admin', 'project_manager', 'pm'), async (req, res) => {
  try {
    const userId = req.user.id;
    try {
      await query('SELECT 1 FROM foreman_assessments LIMIT 1');
    } catch (e) {
       return res.json({ items: [] });
    }

    const rows = await query(
      `SELECT fa.id, fa.worker_id, fa.percent, fa.grade, fa.created_at, w.full_name, w.trade_type
       FROM foreman_assessments fa
       JOIN workers w ON fa.worker_id = w.id
       WHERE fa.foreman_user_id = ?
       ORDER BY fa.created_at DESC`,
      [userId]
    );

    const items = rows.map(row => ({
      id: row.id,
      workerId: row.worker_id,
      name: row.full_name,
      roleName: getTradeLabel(row.trade_type) || row.trade_type || 'ช่างทั่วไป',
      score: row.percent,
      grade: row.grade,
      date: row.created_at
    }));

    res.json({ items });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

app.delete('/api/foreman/assessments/:id', requireAuth, authorizeRoles('foreman', 'admin', 'project_manager'), async (req, res) => {
  try {
    const assessmentId = req.params.id;
    const userId = req.user.id;
    const userRole = req.user.role;

    // Verify ownership or admin
    const assessment = await queryOne('SELECT id, worker_id, foreman_user_id FROM foreman_assessments WHERE id = ?', [assessmentId]);

    if (!assessment) {
      return res.status(404).json({ message: 'Assessment not found' });
    }

    if (userRole === 'foreman' && assessment.foreman_user_id !== userId) {
      return res.status(403).json({ message: 'Unauthorized' });
    }
    
    await withTransaction(async (connection) => {
        await execute('DELETE FROM foreman_assessments WHERE id = ?', [assessmentId], connection);
        // Reset passed status if needed? 
        // Logic: If foreman assessment is gone, they are not "passed" in the combined sense.
        // But we won't touch worker_assessment_results 'passed' column here blindly, 
        // although setting it to 0 is safer than leaving it 1 if they passed practical.
        // Let's set it to 0.
        await execute('UPDATE worker_assessment_results SET passed = 0 WHERE worker_id = ? AND category = "structure"', [assessment.worker_id], connection);
    });

    res.json({ message: 'Assessment deleted' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

app.post('/api/foreman/reports', requireAuth, authorizeRoles('foreman', 'admin', 'project_manager', 'pm'), async (req, res) => {
  try {
    const payload = foremanReportSchema.parse(req.body ?? {});

    const projectRow = await queryOne('SELECT id, name FROM projects WHERE id = ? LIMIT 1', [payload.projectId]);
    if (!projectRow) return res.status(404).json({ message: 'project_not_found' });

    const reportId = randomUUID();
    const projectName = payload.projectName || projectRow.name || null;

    await withTransaction(async (connection) => {
      await ensureForemanReportSchema(connection);
      await execute(
        `INSERT INTO foreman_reports
          (id, foreman_user_id, project_id, project_name, report_type, report_date, work_done, problems, attachment_name)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          reportId,
          req.user?.id || null,
          payload.projectId,
          projectName,
          payload.reportType,
          payload.date,
          payload.workDone,
          payload.problems ?? null,
          payload.attachment ?? null
        ],
        connection
      );
    });

    res.status(201).json({ id: reportId });
  } catch (error) {
    if (error?.issues) return res.status(400).json({ message: 'Invalid input', errors: error.issues });
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

const parseJsonField = (value) => {
  if (value === null || value === undefined) return null;
  if (typeof value === 'object') return value;
  if (typeof value !== 'string') return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
};

const DEFAULT_SCORE_WEIGHTS = { exam: 70, practical: 30 };
const DEFAULT_PASS_THRESHOLD = 70;

const normalizeScoreWeights = (criteria) => {
  const rawExam = Number(criteria?.scoreWeights?.exam);
  const rawPractical = Number(criteria?.scoreWeights?.practical);
  let exam = Number.isFinite(rawExam) ? Math.max(0, Math.min(100, rawExam)) : DEFAULT_SCORE_WEIGHTS.exam;
  let practical = Number.isFinite(rawPractical) ? Math.max(0, Math.min(100, rawPractical)) : DEFAULT_SCORE_WEIGHTS.practical;
  if (exam + practical !== 100) {
    practical = Math.max(0, 100 - exam);
  }
  return { exam, practical };
};

const resolveScoringConfig = (roundRow) => {
  const criteria = parseJsonField(roundRow?.criteria);
  const scoreWeights = normalizeScoreWeights(criteria);
  const criteriaPassThreshold = Number(criteria?.passThreshold);
  const roundPassingScore = Number(roundRow?.passing_score);
  const passThreshold = Number.isFinite(criteriaPassThreshold)
    ? Math.max(0, Math.min(100, criteriaPassThreshold))
    : (Number.isFinite(roundPassingScore) ? Math.max(0, Math.min(100, roundPassingScore)) : DEFAULT_PASS_THRESHOLD);
  return { scoreWeights, passThreshold };
};

const computeWeightedAssessment = ({ theoryPercent, practicalPercent, scoreWeights, passThreshold }) => {
  const safeTheoryPercent = Number.isFinite(Number(theoryPercent)) ? Math.max(0, Math.min(100, Number(theoryPercent))) : 0;
  const safePracticalPercent = Number.isFinite(Number(practicalPercent)) ? Math.max(0, Math.min(100, Number(practicalPercent))) : 0;
  const examWeight = Number(scoreWeights?.exam ?? DEFAULT_SCORE_WEIGHTS.exam);
  const practicalWeight = Number(scoreWeights?.practical ?? DEFAULT_SCORE_WEIGHTS.practical);
  const combinedPercent = (safeTheoryPercent * examWeight / 100) + (safePracticalPercent * practicalWeight / 100);
  const safePassThreshold = Number.isFinite(Number(passThreshold)) ? Number(passThreshold) : DEFAULT_PASS_THRESHOLD;
  return {
    theoryPercent: Math.round(safeTheoryPercent * 100) / 100,
    practicalPercent: Math.round(safePracticalPercent * 100) / 100,
    combinedPercent: Math.round(combinedPercent * 100) / 100,
    passed: combinedPercent >= safePassThreshold
  };
};

app.get('/api/assessments/rounds/active', requireAuth, authorizeRoles('worker', 'wk', 'project_manager', 'pm', 'admin'), async (req, res) => {
  try {
    const category = String(req.query.category || '').trim().toLowerCase();
    const hasCategory = category.length > 0;
    const rows = await query(
      `SELECT id, title, category, description, question_count, passing_score, duration_minutes,
              start_at, end_at, frequency_months, show_score, show_answers, show_breakdown,
              subcategory_quotas, difficulty_weights, criteria, status, active
       FROM assessment_rounds
       WHERE (${hasCategory ? 'LOWER(category) = ? AND' : ''} (status = 'active' OR status IS NULL OR active = 1))
       ORDER BY (status = 'active') DESC, active DESC, created_at DESC`,
      hasCategory ? [category] : []
    );
    const parsedRows = rows.map(row => ({
      ...row,
      subcategory_quotas: parseJsonField(row.subcategory_quotas),
      difficulty_weights: parseJsonField(row.difficulty_weights),
      criteria: parseJsonField(row.criteria)
    }));
    res.json({ items: parsedRows });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

app.get('/api/worker/assessments/rounds', requireAuth, authorizeRoles('worker', 'wk'), async (req, res) => {
  try {
    const category = String(req.query.category || '').trim().toLowerCase();
    const hasCategory = category.length > 0;
    const rows = await query(
      `SELECT id, title, category, description, question_count, passing_score, duration_minutes,
              start_at, end_at, frequency_months, show_score, show_answers, show_breakdown,
              subcategory_quotas, difficulty_weights, criteria, status, active
       FROM assessment_rounds
       WHERE (${hasCategory ? 'LOWER(category) = ? AND' : ''} (status = 'active' OR status IS NULL OR active = 1))
       ORDER BY (status = 'active') DESC, active DESC, created_at DESC`,
      hasCategory ? [category] : []
    );
    const parsedRows = rows.map(row => ({
      ...row,
      subcategory_quotas: parseJsonField(row.subcategory_quotas),
      difficulty_weights: parseJsonField(row.difficulty_weights),
      criteria: parseJsonField(row.criteria)
    }));
    res.json({ items: parsedRows });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

app.get('/api/questions/structural', requireAuth, authorizeRoles('worker', 'wk'), async (req, res) => {
  try {
    const setNo = Number(req.query.set_no || 1);
    const requestedLimit = Number(req.query.limit || 0);
    const sessionId = String(req.query.sessionId || '').trim();

     const round = await queryOne(
      `SELECT id, title, question_count, passing_score, duration_minutes, start_at, end_at,
              frequency_months, show_score, show_answers, show_breakdown,
            subcategory_quotas, difficulty_weights, criteria, status, active
       FROM assessment_rounds
       WHERE LOWER(category) = 'structure' AND (status = 'active' OR status IS NULL OR active = 1)
       ORDER BY (status = 'active') DESC, active DESC, created_at DESC
       LIMIT 1`
    );

    const roundQuestionCount = Number(round?.question_count ?? 0);
    const resolvedLimit = Number.isFinite(requestedLimit) && requestedLimit > 0
      ? requestedLimit
      : (roundQuestionCount > 0 ? roundQuestionCount : 60);
    const limit = Math.min(200, Math.max(1, Number.isFinite(resolvedLimit) ? Math.trunc(resolvedLimit) : 60));

    let activeSessionId = sessionId || randomUUID();
    
    // Determine setNo (Level) from Round Config
    let targetSetNo = Number.isFinite(setNo) ? Math.trunc(setNo) : 1;
    if (round?.difficulty_weights) {
      try {
        const weights = typeof round.difficulty_weights === 'string'
          ? JSON.parse(round.difficulty_weights)
          : round.difficulty_weights;
        
        if (weights && typeof weights === 'object') {
          // Prioritize by highest weight or if explicit 100%
          const easy = Number(weights.easy || 0);
          const medium = Number(weights.medium || 0);
          const hard = Number(weights.hard || 0);
          
          if (easy > medium && easy > hard) targetSetNo = 1;
          else if (medium > easy && medium > hard) targetSetNo = 2;
          else if (hard > easy && hard > medium) targetSetNo = 3;
          // If equal or mixed, fallback to targetSetNo (likely 1 or query param)
        }
      } catch (e) {
        console.error('Error parsing difficulty weights', e);
      }
    }

    if (!sessionId && round?.id) {
      const rawWorkerId = req.query.workerId || req.query.userId || req.user?.id || null;
      const workerId = Number(rawWorkerId);
      try {
        await execute(
          `INSERT INTO assessment_sessions (id, round_id, worker_id, status, question_count, source)
           VALUES (?, ?, ?, 'in_progress', ?, 'question_Structural')`,
          [activeSessionId, round.id, Number.isFinite(workerId) ? workerId : null, limit]
        );
      } catch (sessionInsertError) {
        if (sessionInsertError?.code === 'ER_BAD_FIELD_ERROR' || sessionInsertError?.code === 'ER_NO_SUCH_TABLE') {
          try {
            await execute(
              `INSERT INTO assessment_sessions (id, round_id, worker_id, status, question_count)
               VALUES (?, ?, ?, 'in_progress', ?)`,
              [activeSessionId, round.id, Number.isFinite(workerId) ? workerId : null, limit]
            );
          } catch (fallbackInsertError) {
            console.warn('assessment_sessions insert fallback failed', fallbackInsertError?.code || fallbackInsertError?.message || fallbackInsertError);
          }
        } else {
          throw sessionInsertError;
        }
      }
    }

    let questions = [];
    try {
      const safeSetNo = targetSetNo;
      let rows = await query(
        `SELECT id, question_text, choice_a, choice_b, choice_c, choice_d
         FROM question_Structural
         WHERE set_no = ?
         ORDER BY RAND()
         LIMIT ${limit}`,
        [safeSetNo]
      );

      if (rows.length < limit) {
        const missing = Math.max(0, Math.trunc(limit - rows.length));
        const ids = rows.map(row => row.id).filter(id => id !== null && id !== undefined);
        const extraRows = ids.length
          ? await query(
              `SELECT id, question_text, choice_a, choice_b, choice_c, choice_d
               FROM question_Structural
               WHERE set_no = ? AND id NOT IN (${ids.map(() => '?').join(',')})
               ORDER BY RAND()
               LIMIT ${missing}`,
              [safeSetNo, ...ids]
            )
          : await query(
              `SELECT id, question_text, choice_a, choice_b, choice_c, choice_d
               FROM question_Structural
               WHERE set_no = ?
               ORDER BY RAND()
               LIMIT ${missing}`,
              [safeSetNo]
            );
        rows = rows.concat(extraRows);
      }

      questions = rows.map(row => ({
        id: row.id,
        text: row.question_text,
        choices: [row.choice_a, row.choice_b, row.choice_c, row.choice_d]
      }));
    } catch (error) {
      if (error?.code === 'ER_BAD_FIELD_ERROR') {
        const rows = await query(
          `SELECT id, question_text, choice_a, choice_b, choice_c, choice_d
           FROM question_Structural
           ORDER BY RAND()
           LIMIT ?`,
          [limit]
        );
        questions = rows.map(row => ({
          id: row.id,
          text: row.question_text,
          choices: [row.choice_a, row.choice_b, row.choice_c, row.choice_d]
        }));
      } else if (error?.code !== 'ER_NO_SUCH_TABLE') {
        throw error;
      }
    }

    if (!questions.length) {
      let fallbackRows = await query(
        `SELECT q.id,
                q.text,
                JSON_ARRAYAGG(qo.text ORDER BY qo.id) AS choices
         FROM questions q
         LEFT JOIN question_options qo ON qo.question_id = q.id
         WHERE q.category = 'structure'
         GROUP BY q.id
         ORDER BY RAND()
         LIMIT ?`,
        [limit]
      );
      if (!fallbackRows.length) {
        fallbackRows = await query(
          `SELECT q.id,
                  q.text,
                  JSON_ARRAYAGG(qo.text ORDER BY qo.id) AS choices
           FROM questions q
           LEFT JOIN question_options qo ON qo.question_id = q.id
           GROUP BY q.id
           ORDER BY RAND()
           LIMIT ?`,
          [limit]
        );
      }
      questions = fallbackRows.map(row => {
        let choices = row.choices;
        if (typeof choices === 'string') {
          try {
            choices = JSON.parse(choices);
          } catch {
            choices = [];
          }
        }
        return {
          id: row.id,
          text: row.text,
          choices: Array.isArray(choices) ? choices.filter(item => item !== null) : []
        };
      });
    }

    res.json({
      questions,
      total: questions.length,
      round: round ? {
        id: round.id,
        title: round.title,
        questionCount: round.question_count,
        durationMinutes: round.duration_minutes,
        passingScore: round.passing_score,
        subcategoryQuotas: parseJsonField(round.subcategory_quotas),
        difficultyWeights: parseJsonField(round.difficulty_weights),
        criteria: parseJsonField(round.criteria)
      } : null,
      sessionId: activeSessionId
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

app.post('/api/worker/score', requireAuth, authorizeRoles('worker', 'wk'), async (req, res) => {
  try {
    const workerId = Number(req.body?.userId || req.user?.id);
    const sessionId = String(req.body?.sessionId || '').trim();
    const answers = req.body?.answers || {};
    if (!Number.isFinite(workerId)) return res.status(400).json({ message: 'invalid_id' });
    if (!sessionId) return res.status(400).json({ message: 'missing_session' });

    const sessionRound = await queryOne(
      `SELECT s.round_id, ar.passing_score, ar.criteria
       FROM assessment_sessions s
       LEFT JOIN assessment_rounds ar ON ar.id = s.round_id
       WHERE s.id = ?
       LIMIT 1`,
      [sessionId]
    );
    const roundId = sessionRound?.round_id || null;
    const { scoreWeights, passThreshold } = resolveScoringConfig(sessionRound);

    const existing = await queryOne(
      `SELECT id, round_id, total_score, total_questions, passed, finished_at
       FROM worker_assessment_results
       WHERE worker_id = ? AND category = 'structure'
       LIMIT 1`,
      [workerId]
    );

    const rawAnswerEntries = Object.entries(answers || {});
    let answerEntries = rawAnswerEntries;

    try {
      const sessionQuestions = await query(
        `SELECT question_id
         FROM assessment_session_questions
         WHERE session_id = ?`,
        [sessionId]
      );

      const allowedQuestionIds = new Set(
        (sessionQuestions || [])
          .map((row) => String(row?.question_id ?? '').trim())
          .filter(Boolean)
      );

      if (allowedQuestionIds.size > 0) {
        answerEntries = rawAnswerEntries.filter(([key]) => {
          const normalizedKey = String(key || '').trim();
          if (!normalizedKey) return false;
          if (allowedQuestionIds.has(normalizedKey)) return true;
          const numericKey = Number(normalizedKey);
          return Number.isFinite(numericKey) && allowedQuestionIds.has(String(numericKey));
        });
      }
    } catch (sessionQuestionError) {
      if (sessionQuestionError?.code !== 'ER_NO_SUCH_TABLE' && sessionQuestionError?.code !== 'ER_BAD_TABLE_ERROR') {
        throw sessionQuestionError;
      }
    }

    const numericIds = [];
    const stringIds = [];
    for (const [key] of answerEntries) {
      const numeric = Number(key);
      if (Number.isFinite(numeric)) {
        numericIds.push(numeric);
      } else {
        stringIds.push(String(key));
      }
    }
    if (!numericIds.length && !stringIds.length) return res.status(400).json({ message: 'no_answers' });

    let answerMap = new Map();
    let useOptionFallback = false;

    if (numericIds.length) {
      try {
        const idPlaceholders = numericIds.map(() => '?').join(', ');
        const questionRows = await query(
          `SELECT id, answer FROM question_Structural WHERE id IN (${idPlaceholders})`,
          numericIds
        );
        answerMap = new Map(questionRows.map(row => [Number(row.id), String(row.answer || '').toLowerCase()]));
        if (!answerMap.size) useOptionFallback = true;
      } catch (error) {
        if (error?.code === 'ER_NO_SUCH_TABLE' || error?.code === 'ER_BAD_FIELD_ERROR') {
          useOptionFallback = true;
        } else {
          throw error;
        }
      }
    }

    const optionCorrectIndex = new Map();
    if (useOptionFallback || stringIds.length) {
      const optionIds = stringIds.length ? stringIds : numericIds.map(String);
      if (optionIds.length) {
        const optionPlaceholders = optionIds.map(() => '?').join(', ');
        const optionRows = await query(
          `SELECT question_id, id, is_correct
           FROM question_options
           WHERE question_id IN (${optionPlaceholders})
           ORDER BY question_id, id`,
          optionIds
        );
        const grouped = new Map();
        for (const row of optionRows) {
          const key = String(row.question_id);
          const entry = grouped.get(key) || [];
          entry.push({ id: row.id, isCorrect: Boolean(row.is_correct) });
          grouped.set(key, entry);
        }
        for (const [key, options] of grouped.entries()) {
          const correctIndex = options.findIndex(option => option.isCorrect);
          if (correctIndex >= 0) {
            optionCorrectIndex.set(key, correctIndex);
          }
        }
      }
    }

    const indexToAnswer = ['a', 'b', 'c', 'd'];
    let correct = 0;
    const details = [];

    for (const [key, value] of answerEntries) {
      const selectedIndex = Number(value);
      if (!Number.isFinite(selectedIndex)) continue;

      let correctIndex = null;
      const numericKey = Number(key);
      const isNumericKey = Number.isFinite(numericKey);

      if (isNumericKey && !useOptionFallback) {
        const correctAnswer = answerMap.get(numericKey);
        if (correctAnswer) {
          const resolvedIndex = indexToAnswer.indexOf(String(correctAnswer).toLowerCase());
          if (resolvedIndex >= 0) {
            correctIndex = resolvedIndex;
          }
        }
      } else {
        const fallbackCorrectIndex = optionCorrectIndex.get(String(key));
        if (Number.isFinite(fallbackCorrectIndex)) {
          correctIndex = Number(fallbackCorrectIndex);
        }
      }

      const isCorrect = Number.isFinite(correctIndex) && selectedIndex === correctIndex;
      if (isCorrect) {
        correct += 1;
      }

      const selectedAnswer = Number.isFinite(selectedIndex)
        ? (indexToAnswer[selectedIndex] || null)
        : null;
      const correctAnswer = Number.isFinite(correctIndex)
        ? (indexToAnswer[Number(correctIndex)] || null)
        : null;
      
      details.push({
        questionId: key,
        questionNo: details.length + 1,
        isCorrect,
        selectedIndex,
        selectedAnswer,
        correctIndex,
        correctAnswer
      });
    }

    const totalQuestions = answerEntries.length;
    const percent = totalQuestions ? (correct / totalQuestions) * 100 : 0;
    const practicalRow = await queryOne(
      `SELECT percent
       FROM foreman_assessments
       WHERE worker_id = ?
       ORDER BY created_at DESC
       LIMIT 1`,
      [workerId]
    );
    const weighted = computeWeightedAssessment({
      theoryPercent: percent,
      practicalPercent: Number(practicalRow?.percent ?? 0),
      scoreWeights,
      passThreshold
    });
    const hasPracticalAssessment = practicalRow?.percent !== null && practicalRow?.percent !== undefined;
    const passed = hasPracticalAssessment ? weighted.passed : false;
    const resultId = existing?.id || randomUUID();
    
    // Create breakdown for frontend visualization
    const breakdown = [
      { 
        label: 'structure', 
        total: totalQuestions, 
        correct: correct, 
        percentage: Math.round(percent) 
      }
    ];

    const wrongAnswers = details
      .filter(item => item?.isCorrect === false)
      .map(item => ({
        questionId: item.questionId,
        questionNo: item.questionNo,
        selectedIndex: item.selectedIndex,
        selectedAnswer: item.selectedAnswer,
        correctIndex: item.correctIndex,
        correctAnswer: item.correctAnswer,
        isCorrect: false
      }));

    const breakdownPayload = {
      items: breakdown,
      details,
      wrongAnswers
    };

    if (existing) {
      await execute(
        `UPDATE worker_assessment_results
         SET round_id = ?, session_id = ?, total_score = ?, total_questions = ?, passed = ?, breakdown = ?, finished_at = NOW(6), updated_at = NOW(6)
         WHERE id = ?`,
        [roundId, sessionId, correct, totalQuestions, passed ? 1 : 0, JSON.stringify(breakdownPayload), resultId]
      );
    } else {
      await execute(
        `INSERT INTO worker_assessment_results
         (id, worker_id, round_id, session_id, category, total_score, total_questions, passed, breakdown, finished_at, created_at, updated_at)
         VALUES (?, ?, ?, ?, 'structure', ?, ?, ?, ?, NOW(6), NOW(6), NOW(6))`,
        [resultId, workerId, roundId, sessionId, correct, totalQuestions, passed ? 1 : 0, JSON.stringify(breakdownPayload)]
      );
    }

    await execute(
      `UPDATE assessment_sessions SET status = 'finished', finished_at = NOW(6)
       WHERE id = ?`,
      [sessionId]
    );

    await promoteWorkerIfPassed(workerId, passed);

    res.json({
      success: true,
      result: {
        id: resultId,
        workerId,
        sessionId,
        score: correct,
        totalQuestions,
        passed: hasPracticalAssessment ? passed : null,
        theoryPercent: weighted.theoryPercent,
        practicalPercent: hasPracticalAssessment ? weighted.practicalPercent : null,
        combinedPercent: hasPracticalAssessment ? weighted.combinedPercent : null,
        passingScorePct: passThreshold,
        scoreWeights,
        practicalCompleted: hasPracticalAssessment,
        resultReady: hasPracticalAssessment,
        breakdown,
        details,
        wrongAnswers,
        finishedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// ---------------------------------------------------------------------------
// Read-only admin lookups
// ---------------------------------------------------------------------------
app.get('/api/admin/departments', requireAuth, authorizeRoles('admin'), async (_req, res) => {
  try {
    const rows = await query('SELECT * FROM departments ORDER BY name');
    res.json({ items: rows });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

app.get('/api/admin/trade-types', requireAuth, authorizeRoles('admin'), async (_req, res) => {
  try {
    const rows = await query('SELECT * FROM trade_types ORDER BY name');
    res.json({ items: rows });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

app.get('/api/admin/subcategories', requireAuth, authorizeRoles('admin'), async (_req, res) => {
  try {
    const rows = await query('SELECT * FROM subcategories ORDER BY category, display_order');
    res.json({ items: rows });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

app.get('/api/admin/project-members', requireAuth, authorizeRoles('admin'), async (_req, res) => {
  try {
    const rows = await query('SELECT * FROM project_members ORDER BY joined_at DESC');
    res.json({ items: rows });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

app.get('/api/admin/assessment-answers', requireAuth, authorizeRoles('admin'), async (_req, res) => {
  try {
    const rows = await query('SELECT * FROM assessment_answers');
    res.json({ items: rows });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

app.get('/api/admin/training-records', requireAuth, authorizeRoles('admin'), async (_req, res) => {
  try {
    const rows = await query('SELECT * FROM training_records ORDER BY training_date DESC');
    res.json({ items: rows });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

const handleAddressLookup = (req, res) => {
  const fieldRaw = typeof req.query.field === 'string' ? req.query.field.toLowerCase() : '';
  const queryRaw = typeof req.query.query === 'string' ? req.query.query.trim() : '';

  const provinceFilter = typeof req.query.province === 'string' ? req.query.province : '';
  const districtFilter = typeof req.query.district === 'string' ? req.query.district : '';
  const subdistrictFilter = typeof req.query.subdistrict === 'string' ? req.query.subdistrict : '';

  const limitParam = Array.isArray(req.query.limit) ? req.query.limit[0] : req.query.limit;
  const limitValue = Number.parseInt(typeof limitParam === 'string' ? limitParam : '', 10);

  const searchResults = searchThaiAddressRecords({
    field: fieldRaw,
    query: queryRaw,
    provinceFilter,
    districtFilter,
    subdistrictFilter,
    limit: Number.isNaN(limitValue) ? undefined : limitValue
  }).map((record) => ({
    province: record.province,
    district: record.district,
    subdistrict: record.subdistrict,
    zipcode: record.zipcode,
    latitude: record.latitude,
    longitude: record.longitude
  }));

  const meta = getAddressMeta();

  res.json({
    query: queryRaw,
    field: fieldRaw,
    results: searchResults,
    meta: {
      total: searchResults.length,
      datasetLoaded: meta.datasetLoaded,
      lastLoadedAt: meta.lastLoadedAt ? meta.lastLoadedAt.toISOString() : null,
      loadError: meta.loadError ? String(meta.loadError.message || meta.loadError) : null
    }
  });
};

app.get('/api/lookups/address', handleAddressLookup);
app.get('/api/lookups/addresses', handleAddressLookup);

app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoleRoutes);
app.use('/api/pm', pmRoleRoutes);
app.use('/api/wk', wkRoleRoutes);
app.use('/api/fm', fmRoleRoutes);

app.listen(env.PORT, () => {
  console.log(`API running on http://localhost:${env.PORT}`);
});

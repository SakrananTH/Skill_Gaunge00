import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';
import { readFile } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { z } from 'zod';

// Refactored Modules
import { env } from './config/env.js';
import { pool } from './config/database.js';
import { ROLE_LABELS, TRADE_LABELS, ADMIN_BYPASS } from './config/constants.js';
import { 
  execute, query, queryOne, withTransaction, buildUpdateClause, writeAuditLog 
} from './utils/db.js';
import { 
  normalizePhoneTH, uuidSchema, getRequestIp, getRoleLabel, getTradeLabel, 
  toNullableString, parseDateValue, parseDateTimeInput, toISODateString,
  parseAgeValue, parseExperienceYears
} from './utils/helpers.js';
import { 
  requireAuth, authorizeRoles, hasRole, getTokenFromHeader, canAccessUser 
} from './middlewares/auth.js';
import { loadThaiAddressDataset, searchThaiAddressRecords } from './services/thaiAddressService.js';
import addressRoutes from './routes/addressRoutes.js';
import authRoutes from './routes/authRoutes.js';
import adminRoutes from './routes/adminRoutes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

loadThaiAddressDataset();

const app = express();
app.use(cors({ origin: env.CORS_ORIGIN, credentials: true, allowedHeaders: ['Content-Type', 'Authorization'] }));
app.use(express.json());

// Mount New Routes
app.use('/api/lookups', addressRoutes);
app.use('/api/auth', authRoutes); // Includes signup, login
app.use('/api/admin', adminRoutes); // Includes users, workers

// ---------------------------------------------------------------------------
// Legacy / Remaining Logic
// ---------------------------------------------------------------------------


/* Removed broken legacy address code */


/* 
  Legacy code removed - use addressRoutes instead.
*/


/* Utility helpers removed - imported from ./utils */


let workerTableColumns = new Set();
let workerAccountColumns = new Set();
let workerProfilesTableExists = false;
let workerProfilesWorkerIdIsNumeric = false;

async function refreshWorkerMetadata() {
  try {
    const columns = await query('SHOW COLUMNS FROM workers');
    workerTableColumns = new Set(columns.map(column => column.Field));
  } catch (error) {
    console.warn('Unable to inspect workers table', error?.code || error?.message || error);
  }

  try {
    const columns = await query('SHOW COLUMNS FROM worker_accounts');
    workerAccountColumns = new Set(columns.map(column => column.Field));
  } catch (error) {
    console.warn('Unable to inspect worker_accounts table', error?.code || error?.message || error);
  }

  try {
    await execute(
      `CREATE TABLE IF NOT EXISTS worker_profiles (
        worker_id INT NOT NULL PRIMARY KEY,
        payload LONGTEXT NOT NULL,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
    );
    try {
      const profileColumns = await query('SHOW COLUMNS FROM worker_profiles');
      const workerIdColumn = profileColumns.find(column => column.Field === 'worker_id');
      const workerIdType = workerIdColumn?.Type?.toLowerCase() || '';
      workerProfilesWorkerIdIsNumeric = workerIdType.includes('int');
      workerProfilesTableExists = true;
    } catch (error) {
      workerProfilesWorkerIdIsNumeric = false;
      workerProfilesTableExists = false;
      console.warn('Unable to inspect worker_profiles table', error?.code || error?.message || error);
    }
  } catch (error) {
    workerProfilesTableExists = false;
    console.warn('Unable to ensure worker_profiles table', error?.code || error?.message || error);
  }
}

refreshWorkerMetadata().catch(error => {
  console.warn('Worker metadata bootstrap failed', error?.code || error?.message || error);
});

function filterObjectByColumns(data, columnSet) {
  return Object.fromEntries(
    Object.entries(data).filter(([column, value]) => columnSet.has(column) && value !== undefined)
  );
}

async function saveWorkerProfile(connection, workerId, payload) {
  if (!workerProfilesTableExists) return;
  if (workerProfilesWorkerIdIsNumeric && !Number.isInteger(Number(workerId))) return;
  try {
    const serialized = JSON.stringify(payload ?? {});
    await execute(
      `INSERT INTO worker_profiles (worker_id, payload) VALUES (?, ?)
       ON DUPLICATE KEY UPDATE payload = VALUES(payload), updated_at = CURRENT_TIMESTAMP`,
      [workerId, serialized],
      connection
    );
  } catch (error) {
    if (error?.code === 'ER_NO_SUCH_TABLE') {
      workerProfilesTableExists = false;
      return;
    }
    throw error;
  }
}

async function fetchWorkerProfile(connection, workerId) {
  if (!workerProfilesTableExists) return null;
  if (workerProfilesWorkerIdIsNumeric && !Number.isInteger(Number(workerId))) return null;
  try {
    const row = await queryOne('SELECT payload FROM worker_profiles WHERE worker_id = ? LIMIT 1', [workerId], connection);
    if (!row?.payload) return null;
    try {
      return JSON.parse(row.payload);
    } catch (error) {
      console.warn('Unable to parse worker profile payload', error);
      return null;
    }
  } catch (error) {
    if (error?.code === 'ER_NO_SUCH_TABLE') {
      workerProfilesTableExists = false;
      return null;
    }
    throw error;
  }
}

/* getColumn and toISODateString removed - imported */


function buildWorkerProfileFromRow(row, fallbackProfile) {
  const profile = typeof fallbackProfile === 'object' && fallbackProfile
    ? JSON.parse(JSON.stringify(fallbackProfile))
    : { personal: {}, identity: {}, address: {}, employment: {}, credentials: {} };

  profile.personal = {
    nationalId: toNullableString(getColumn(row, 'national_id', 'nationalId')) || profile.personal?.nationalId || '',
    fullName: toNullableString(getColumn(row, 'full_name', 'fullName')) || profile.personal?.fullName || '',
    birthDate: toISODateString(getColumn(row, 'birth_date', 'birthDate')) || profile.personal?.birthDate || '',
    age:
      getColumn(row, 'age') !== undefined && getColumn(row, 'age') !== null
        ? Number(getColumn(row, 'age'))
        : profile.personal?.age ?? ''
  };

  profile.identity = {
    issueDate: toISODateString(getColumn(row, 'card_issue_date', 'issueDate')) || profile.identity?.issueDate || '',
    expiryDate: toISODateString(getColumn(row, 'card_expiry_date', 'expiryDate')) || profile.identity?.expiryDate || ''
  };

  profile.address = {
    phone: toNullableString(getColumn(row, 'phone', 'Phone')) || profile.address?.phone || '',
    addressOnId:
      toNullableString(getColumn(row, 'address_on_id', 'addressOnId')) || profile.address?.addressOnId || '',
    province: toNullableString(getColumn(row, 'province', 'Province')) || profile.address?.province || '',
    district: toNullableString(getColumn(row, 'district', 'District')) || profile.address?.district || '',
    subdistrict:
      toNullableString(getColumn(row, 'subdistrict', 'Subdistrict')) || profile.address?.subdistrict || '',
    postalCode:
      toNullableString(getColumn(row, 'postal_code', 'PostalCode')) || profile.address?.postalCode || '',
    currentAddress:
      toNullableString(getColumn(row, 'current_address', 'currentAddress')) || profile.address?.currentAddress || ''
  };

  profile.employment = {
    role: toNullableString(getColumn(row, 'role_code', 'role', 'Role')) || profile.employment?.role || '',
    tradeType:
      toNullableString(getColumn(row, 'trade_type', 'tradeType')) || profile.employment?.tradeType || '',
    experienceYears:
      getColumn(row, 'experience_years', 'experienceYears') !== undefined &&
      getColumn(row, 'experience_years', 'experienceYears') !== null
        ? String(getColumn(row, 'experience_years', 'experienceYears'))
        : profile.employment?.experienceYears || '',
    assessmentEnabled: Boolean(profile.employment?.assessmentEnabled)
  };

  profile.credentials = {
    email:
      toNullableString(getColumn(row, 'account_email', 'email')) || profile.credentials?.email || '',
    password: '',
    confirmPassword: '',
    passwordHash:
      toNullableString(getColumn(row, 'account_password_hash', 'password_hash')) ||
      profile.credentials?.passwordHash || ''
  };

  return profile;
}

function inferAssessmentLevelFromTitle(title) {
  if (!title) return null;
  const normalized = String(title).toLowerCase();
  const match = normalized.match(/\b(?:lv|level)\s*([1-3])\b/i) || normalized.match(/ระดับ\s*([1-3])/i);
  if (!match) return null;
  const level = Number(match[1]);
  return Number.isFinite(level) ? level : null;
}

function normalizeAssessmentSummary(row) {
  if (!row) return { score: null, passed: null, totalScore: null, totalQuestions: null, roundTitle: null, roundLevel: null };
  const totalScore = row.total_score ?? row.totalScore ?? null;
  const totalQuestions = row.total_questions ?? row.totalQuestions ?? null;
  const scorePercent = totalScore !== null && totalQuestions
    ? Math.round((Number(totalScore) / Number(totalQuestions)) * 100)
    : (row.score === null || row.score === undefined ? null : Number(row.score));
  const passingScorePctRaw = row.round_passing_score ?? row.passing_score ?? null;
  const passingScorePct = passingScorePctRaw === null || passingScorePctRaw === undefined
    ? 70
    : Number(passingScorePctRaw);
  const requiredCorrect = totalQuestions !== null && totalQuestions !== undefined
    ? Math.ceil(Number(totalQuestions) * (passingScorePct / 100))
    : null;
  const derivedPassed = (totalScore !== null && totalQuestions !== null && requiredCorrect !== null)
    ? Number(totalScore) >= requiredCorrect
    : null;
  const roundTitle = row.round_title ?? row.roundTitle ?? null;
  const roundLevel = inferAssessmentLevelFromTitle(roundTitle);
  return { score: scorePercent, passed: derivedPassed, totalScore, totalQuestions, roundTitle, roundLevel };
}

function normalizeForemanAssessmentSummary(row) {
  if (!row) return null;
  return {
    totalScore: row.total_score ?? row.totalScore ?? null,
    maxScore: row.max_score ?? row.maxScore ?? null,
    percent: row.percent ?? row.percentScore ?? null,
    grade: row.grade ?? null,
    createdAt: row.created_at ?? row.createdAt ?? null
  };
}

async function fetchLatestAssessmentSummaries(userIds, connection) {
  const ids = Array.isArray(userIds) ? userIds.map(id => String(id)).filter(Boolean) : [];
  if (!ids.length) return new Map();
  try {
    await ensureAssessmentSessionSchemaReady(connection);
    await ensureAssessmentResultSchemaReady(connection);
    const placeholders = ids.map(() => '?').join(',');
    const rows = await query(
      `SELECT r.worker_id, r.total_score, r.total_questions, r.passed, r.finished_at,
              ar.passing_score AS round_passing_score, ar.title AS round_title
       FROM worker_assessment_results r
       LEFT JOIN assessment_rounds ar ON ar.id = r.round_id
       WHERE r.worker_id IN (${placeholders})
       ORDER BY r.finished_at DESC`,
      ids,
      connection
    );

    const summaryByUser = new Map();
    for (const row of rows) {
      const key = String(row.worker_id);
      if (!summaryByUser.has(key)) {
        summaryByUser.set(key, normalizeAssessmentSummary(row));
      }
    }
    return summaryByUser;
  } catch (error) {
    if (error?.code === 'ER_NO_SUCH_TABLE') return new Map();
    console.warn('Unable to read assessment summaries', error?.code || error?.message || error);
    return new Map();
  }
}

async function fetchLatestAssessmentSummary(userId, connection) {
  const summaries = await fetchLatestAssessmentSummaries([userId], connection);
  return summaries.get(String(userId)) || null;
}

async function fetchLatestForemanAssessments(workerIds, connection) {
  const ids = Array.isArray(workerIds) ? workerIds.map(id => String(id)).filter(Boolean) : [];
  if (!ids.length) return new Map();
  try {
    await ensureForemanAssessmentSchema(connection);
    const placeholders = ids.map(() => '?').join(',');
    const rows = await query(
      `SELECT worker_id, total_score, max_score, percent, grade, created_at
       FROM foreman_assessments
       WHERE worker_id IN (${placeholders})
       ORDER BY created_at DESC`,
      ids,
      connection
    );

    const summaryByWorker = new Map();
    for (const row of rows) {
      const key = String(row.worker_id);
      if (!summaryByWorker.has(key)) {
        summaryByWorker.set(key, normalizeForemanAssessmentSummary(row));
      }
    }
    return summaryByWorker;
  } catch (error) {
    if (error?.code === 'ER_NO_SUCH_TABLE') return new Map();
    console.warn('Unable to read foreman assessments', error?.code || error?.message || error);
    return new Map();
  }
}

async function fetchLatestForemanAssessment(workerId, connection) {
  const summaries = await fetchLatestForemanAssessments([workerId], connection);
  return summaries.get(String(workerId)) || null;
}

function mapWorkerRowToResponse(row, profilePayload, assessmentSummary, foremanAssessmentSummary) {
  const profile = buildWorkerProfileFromRow(row, profilePayload);
  const tradeLabel = getTradeLabel(profile.employment.tradeType);
  const roleLabel = getRoleLabel(profile.employment.role);
  const accountPasswordHash = toNullableString(
    getColumn(row, 'account_password_hash', 'password_hash')
  ) || '';

  return {
    id: getColumn(row, 'id'),
    name: profile.personal.fullName || 'ไม่ระบุ',
    phone: toNullableString(getColumn(row, 'phone')) || '',
    role: roleLabel,
    category: tradeLabel,
    level: tradeLabel,
    status: toNullableString(getColumn(row, 'employment_status')) || 'active',
    startDate:
      toISODateString(getColumn(row, 'start_date')) ||
      toISODateString(getColumn(row, 'created_at')) ||
      '',
    province: profile.address.province || 'ไม่ระบุ',
    email: profile.credentials.email || '',
    passwordHash: accountPasswordHash,
    assessmentEnabled: Boolean(profile.employment?.assessmentEnabled),
    score: assessmentSummary?.score ?? null,
    assessmentPassed: assessmentSummary?.passed ?? null,
    assessmentTotalScore: assessmentSummary?.totalScore ?? null,
    assessmentTotalQuestions: assessmentSummary?.totalQuestions ?? null,
    assessmentRoundLevel: assessmentSummary?.roundLevel ?? null,
    foremanAssessed: Boolean(foremanAssessmentSummary),
    foremanAssessmentPercent: foremanAssessmentSummary?.percent ?? null,
    foremanAssessmentTotalScore: foremanAssessmentSummary?.totalScore ?? null,
    foremanAssessmentMaxScore: foremanAssessmentSummary?.maxScore ?? null,
    foremanAssessmentGrade: foremanAssessmentSummary?.grade ?? null,
    foremanAssessmentCreatedAt: foremanAssessmentSummary?.createdAt ?? null,
    fullData: profile
  };
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
  const profilePayload = await fetchWorkerProfile(connection, workerId);
  const assessmentSummary = await fetchLatestAssessmentSummary(workerId, connection);
  const foremanAssessmentSummary = await fetchLatestForemanAssessment(workerId, connection);
  return mapWorkerRowToResponse(row, profilePayload, assessmentSummary, foremanAssessmentSummary);
}

async function getAllWorkerResponses(connection) {
  const rows = await query(
    `SELECT w.*, a.email AS account_email, a.password_hash AS account_password_hash
     FROM workers w
     LEFT JOIN worker_accounts a ON a.worker_id = w.id
     ORDER BY w.id DESC`,
    [],
    connection
  );

  const responses = [];
  const workerIds = rows
    .map(row => getColumn(row, 'id'))
    .filter(id => id !== undefined && id !== null);
  const assessmentSummaries = await fetchLatestAssessmentSummaries(workerIds, connection);
  const foremanAssessments = await fetchLatestForemanAssessments(workerIds, connection);

  for (const row of rows) {
    const workerId = getColumn(row, 'id');
    const profilePayload = await fetchWorkerProfile(undefined, workerId);
    const assessmentSummary = assessmentSummaries.get(String(workerId)) || null;
    const foremanAssessmentSummary = foremanAssessments.get(String(workerId)) || null;
    responses.push(mapWorkerRowToResponse(row, profilePayload, assessmentSummary, foremanAssessmentSummary));
  }
  return responses;
}

function buildWorkerDataFromPayload(payload, { forUpdate = false } = {}) {
  const birthDate = parseDateValue(payload.personal?.birthDate);
  const age = parseAgeValue(payload.personal?.age, birthDate);
  const experienceYears = parseExperienceYears(payload.employment?.experienceYears);
  const nowDate = new Date().toISOString().slice(0, 10);

  const base = {
    national_id: toNullableString(payload.personal?.nationalId),
    full_name: toNullableString(payload.personal?.fullName),
    phone: toNullableString(payload.address?.phone),
    birth_date: birthDate,
    age,
    role_code: toNullableString(payload.employment?.role),
    trade_type: toNullableString(payload.employment?.tradeType),
    experience_years: experienceYears,
    province: toNullableString(payload.address?.province),
    district: toNullableString(payload.address?.district),
    subdistrict: toNullableString(payload.address?.subdistrict),
    postal_code: toNullableString(payload.address?.postalCode),
    address_on_id: toNullableString(payload.address?.addressOnId),
    current_address: toNullableString(payload.address?.currentAddress),
    card_issue_date: parseDateValue(payload.identity?.issueDate),
    card_expiry_date: parseDateValue(payload.identity?.expiryDate),
    employment_status: 'probation',
    start_date: nowDate
  };

  if (forUpdate) {
    // Avoid overriding start_date when not provided in update payload.
    delete base.start_date;
  }

  if (!base.role_code) {
    base.role_code = 'worker';
  }
  if (!base.trade_type) {
    base.trade_type = 'structure';
  }

  return base;
}

async function fetchUserRoles(userId, connection) {
  const rows = await query(
    'SELECT r.key FROM user_roles ur JOIN roles r ON r.id = ur.role_id WHERE ur.user_id = ? ORDER BY r.key',
    [userId],
    connection
  );
  return rows.map(row => row.key);
}

async function replaceUserRoles(userId, roles, connection) {
  await execute('DELETE FROM user_roles WHERE user_id = ?', [userId], connection);
  if (!roles || roles.length === 0) return;
  const roleRows = await query('SELECT id FROM roles WHERE `key` IN (?)', [roles], connection);
  for (const role of roleRows) {
    await execute('INSERT IGNORE INTO user_roles(user_id, role_id) VALUES (?, ?)', [userId, role.id], connection);
  }
}

/* Auth functions removed - imported from ./middlewares/auth.js */


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

async function ensureTaskWorkerAssignmentSchema(connection) {
  await execute(
    `CREATE TABLE IF NOT EXISTS task_worker_assignments (
      id CHAR(36) NOT NULL,
      task_id CHAR(36) NOT NULL,
      worker_id INT UNSIGNED NOT NULL,
      assignment_type VARCHAR(50) NOT NULL DEFAULT 'general',
      status VARCHAR(30) NOT NULL DEFAULT 'assigned',
      assigned_by_user_id CHAR(36) NULL,
      assigned_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
      started_at DATETIME(6) NULL,
      completed_at DATETIME(6) NULL,
      PRIMARY KEY (id),
      KEY idx_task_worker_assignments_task (task_id),
      KEY idx_task_worker_assignments_worker (worker_id),
      KEY idx_task_worker_assignments_status (status),
      KEY idx_task_worker_assignments_type (assignment_type)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    [],
    connection
  );
}

/* canAccessUser removed - imported */


// ---------------------------------------------------------------------------
// Health
// ---------------------------------------------------------------------------
app.get('/api/health', async (_req, res) => {
  try {
    const rows = await query('SELECT NOW() AS now');
    res.json({ ok: true, dbTime: rows[0]?.now ?? null });
  } catch (error) {
    console.error(error);
    res.status(500).json({ ok: false, error: 'db_unreachable' });
  }
});

app.get('/api/debug/db-info', requireAuth, authorizeRoles('admin', 'project_manager'), (_req, res) => {
  res.json({
    host: MYSQL_HOST,
    port: MYSQL_PORT,
    database: MYSQL_DATABASE
  });
});

// ---------------------------------------------------------------------------
// Authentication
// ---------------------------------------------------------------------------
const signupSchema = z.object({
  full_name: z.string().min(1).max(120),
  phone: z.string().regex(/^[+0-9]{8,15}$/),
  email: z.string().email().optional().or(z.literal('')),
  password: z.string().min(8)
});

async function createSignupUser(rawPayload, req) {
  const payload = signupSchema.parse(rawPayload ?? {});
  const normalizedPhone = normalizePhoneTH(payload.phone);
  const normalizedEmail = payload.email ? payload.email.toLowerCase() : null;

  const created = await withTransaction(async connection => {
    const duplicate = normalizedEmail
      ? await queryOne(
          'SELECT id FROM users WHERE phone = ? OR LOWER(email) = ? LIMIT 1',
          [normalizedPhone, normalizedEmail],
          connection
        )
      : await queryOne('SELECT id FROM users WHERE phone = ? LIMIT 1', [normalizedPhone], connection);

    if (duplicate) {
      return { error: { status: 409, message: 'Phone or email already exists' } };
    }

    const userId = randomUUID();
    const passwordHash = await bcrypt.hash(payload.password, 10);

    await execute(
      'INSERT INTO users (id, full_name, phone, email, password_hash, status) VALUES (?, ?, ?, ?, ?, ?)',
      [userId, payload.full_name, normalizedPhone, normalizedEmail, passwordHash, 'active'],
      connection
    );

    const workerRole = await queryOne('SELECT id FROM roles WHERE `key` = ? LIMIT 1', ['worker'], connection);
    if (workerRole) {
      await execute(
        'INSERT IGNORE INTO user_roles(user_id, role_id) VALUES (?, ?)',
        [userId, workerRole.id],
        connection
      );
    }

    const user = await queryOne(
      'SELECT id, full_name, phone, email, status, created_at FROM users WHERE id = ?',
      [userId],
      connection
    );

    return { user };
  });

  if (created.error) {
    throw { status: created.error.status, body: { message: created.error.message } };
  }

  await writeAuditLog({
    req,
    username: payload.email || payload.phone,
    role: 'worker',
    action: 'signup',
    details: { phone: payload.phone, email: payload.email || null },
    status: 'success'
  });

  return { status: 201, body: { ...created.user, role: 'worker' } };
}

app.post('/api/auth/signup', async (req, res) => {
  try {
    const result = await createSignupUser(req.body, req);
    return res.status(result.status).json(result.body);
  } catch (error) {
    if (error?.status && error?.body) return res.status(error.status).json(error.body);
    if (error?.issues) return res.status(400).json({ message: 'Invalid input', errors: error.issues });
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

app.post('/api/register', async (req, res) => {
  try {
    const fullName = [req.body?.first_name, req.body?.last_name].filter(Boolean).join(' ').trim();
    const payload = {
      full_name: fullName || req.body?.full_name,
      phone: req.body?.phone_number || req.body?.phone,
      email: req.body?.email || '',
      password: req.body?.password
    };
    const result = await createSignupUser(payload, req);
    return res.status(result.status).json(result.body);
  } catch (error) {
    if (error?.status && error?.body) return res.status(error.status).json(error.body);
    if (error?.issues) return res.status(400).json({ message: 'Invalid input', errors: error.issues });
    console.error(error);
    return res.status(500).json({ message: 'Server error' });
  }
});

const loginSchema = z
  .object({
    identifier: z.string().trim().min(1).max(255).optional(),
    phone: z.string().trim().min(1).max(255).optional(),
    password: z.string().min(1)
  })
  .superRefine((data, ctx) => {
    if (!data.identifier && !data.phone) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['identifier'], message: 'identifier_required' });
    }
  });

app.post('/api/auth/login', async (req, res) => {
  try {
    const parsed = loginSchema.parse(req.body ?? {});
    const identifier = toNullableString(parsed.identifier ?? parsed.phone);
    if (!identifier) return res.status(400).json({ message: 'Invalid input' });

    const phoneCandidates = buildPhoneCandidates(identifier);

    const adminPhoneSet = new Set(buildPhoneCandidates(ADMIN_BYPASS.phone));
    const isAdminIdentifier = phoneCandidates.some(value => adminPhoneSet.has(value)) ||
      (identifier.includes('@') && identifier.toLowerCase() === ADMIN_BYPASS.email.toLowerCase());

    if (isAdminIdentifier && parsed.password === ADMIN_BYPASS.password) {
      const roles = ['admin'];
      const token = jwt.sign({ sub: ADMIN_BYPASS.id, roles }, JWT_SECRET, {
        expiresIn: JWT_EXPIRES_IN,
        issuer: 'skillgauge-api',
        audience: 'skillgauge-spa'
      });

      await writeAuditLog({
        req,
        username: ADMIN_BYPASS.email || ADMIN_BYPASS.phone,
        role: 'admin',
        action: 'admin_login',
        details: { method: 'bypass' },
        status: 'success'
      });

      return res.json({
        token,
        user: {
          id: ADMIN_BYPASS.id,
          full_name: ADMIN_BYPASS.fullName,
          phone: ADMIN_BYPASS.normalizedPhone,
          email: ADMIN_BYPASS.email,
          status: 'active',
          roles
        }
      });
    }

    let user = null;
    let userSource = 'users';
    let workerRoleKey = 'worker';

    if (phoneCandidates.length) {
      const placeholders = phoneCandidates.map(() => '?').join(', ');
      user = await queryOne(
        `SELECT id, full_name, phone, email, password_hash, status
         FROM users
         WHERE phone IN (${placeholders})
         LIMIT 1`,
        phoneCandidates
      );
    }

    if (!user && identifier.includes('@')) {
      user = await queryOne(
        `SELECT id, full_name, phone, email, password_hash, status
         FROM users
         WHERE LOWER(email) = LOWER(?)
         LIMIT 1`,
        [identifier]
      );
    }

    if (!user && identifier.includes('@')) {
      const workerAccount = await queryOne(
        `SELECT 
           a.worker_id,
           a.email,
           a.password_hash,
           a.status,
           w.full_name,
           w.phone,
           w.role_code
         FROM worker_accounts a
         INNER JOIN workers w ON w.id = a.worker_id
         WHERE LOWER(a.email) = LOWER(?)
         LIMIT 1`,
        [identifier]
      );

      if (workerAccount) {
        user = {
          id: workerAccount.worker_id,
          full_name: workerAccount.full_name || '',
          phone: workerAccount.phone || '',
          email: workerAccount.email,
          password_hash: workerAccount.password_hash,
          status: workerAccount.status || 'active'
        };
        workerRoleKey = workerAccount.role_code || 'worker';
        userSource = 'worker_accounts';
      }
    }

    if (!user) {
      await writeAuditLog({
        req,
        username: identifier,
        role: 'unknown',
        action: 'login_failed',
        details: { reason: 'invalid_credentials' },
        status: 'error'
      });
      return res.status(401).json({ message: 'invalid_credentials' });
    }

    const isMatch = await bcrypt.compare(parsed.password, user.password_hash ?? '');
    if (!isMatch) {
      await writeAuditLog({
        req,
        username: user.email || user.phone || identifier,
        role: 'unknown',
        action: 'login_failed',
        details: { reason: 'invalid_credentials' },
        status: 'error'
      });
      return res.status(401).json({ message: 'invalid_credentials' });
    }

    if (userSource === 'worker_accounts' && (!user.status || user.status !== 'active')) {
      return res.status(403).json({ message: 'account_inactive' });
    }

    const normalizeRoleKey = role => {
      if (!role) return 'worker';
      const value = String(role).toLowerCase();
      if (value === 'admin') return 'admin';
      if (value === 'project_manager' || value === 'pm') return 'project_manager';
      if (value === 'foreman' || value === 'fm') return 'foreman';
      return 'worker';
    };

    const roles =
      userSource === 'worker_accounts'
        ? [normalizeRoleKey(workerRoleKey)]
        : (await fetchUserRoles(user.id)).map(normalizeRoleKey);
    const token = jwt.sign({ sub: user.id, roles }, JWT_SECRET, {
      expiresIn: JWT_EXPIRES_IN,
      issuer: 'skillgauge-api',
      audience: 'skillgauge-spa'
    });

    await writeAuditLog({
      req,
      username: user.email || user.phone || identifier,
      role: roles.join(','),
      action: 'login_success',
      details: { source: userSource },
      status: 'success'
    });

    res.json({
      token,
      user: {
        id: user.id,
        full_name: user.full_name,
        phone: user.phone,
        email: user.email,
        status: user.status,
        roles
      }
    });
  } catch (error) {
    if (error?.issues) return res.status(400).json({ message: 'Invalid input', errors: error.issues });
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// ---------------------------------------------------------------------------
// Admin role management
// ---------------------------------------------------------------------------
const roleKeySchema = z.object({ role: z.enum(['worker', 'foreman', 'project_manager']) });

app.post('/api/admin/users/:id/roles/grant', requireAuth, authorizeRoles('admin'), async (req, res) => {
  try {
    const userId = req.params.id;
    if (!uuidSchema.safeParse(userId).success) return res.status(400).json({ message: 'invalid id' });
    const { role } = roleKeySchema.parse(req.body ?? {});

    const roleRow = await queryOne('SELECT id FROM roles WHERE `key` = ? LIMIT 1', [role]);
    if (!roleRow) return res.status(400).json({ message: 'unknown_role' });

    await execute('INSERT IGNORE INTO user_roles(user_id, role_id) VALUES (?, ?)', [userId, roleRow.id]);
    res.json({ ok: true });
  } catch (error) {
    if (error?.issues) return res.status(400).json({ message: 'Invalid input', errors: error.issues });
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

app.post('/api/admin/users/:id/roles/revoke', requireAuth, authorizeRoles('admin'), async (req, res) => {
  try {
    const userId = req.params.id;
    if (!uuidSchema.safeParse(userId).success) return res.status(400).json({ message: 'invalid id' });
    const { role } = roleKeySchema.parse(req.body ?? {});

    const roleRow = await queryOne('SELECT id FROM roles WHERE `key` = ? LIMIT 1', [role]);
    if (!roleRow) return res.status(400).json({ message: 'unknown_role' });

    await execute('DELETE FROM user_roles WHERE user_id = ? AND role_id = ?', [userId, roleRow.id]);
    res.json({ ok: true });
  } catch (error) {
    if (error?.issues) return res.status(400).json({ message: 'Invalid input', errors: error.issues });
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// ---------------------------------------------------------------------------
// Users CRUD
// ---------------------------------------------------------------------------
const roleEnum = z.enum(['admin', 'project_manager', 'foreman', 'worker']);
const roleArraySchema = z.array(roleEnum).max(10).default([]);

const optionalString = (max = 255) => z.string().max(max).optional().or(z.literal(''));

const workerRegistrationSchema = z.object({
  personal: z.object({
    nationalId: z.string().trim().min(1).max(30),
    fullName: z.string().trim().min(1).max(120),
    birthDate: optionalString(30),
    age: z.union([z.number(), z.string(), z.null(), z.undefined()]).optional()
  }),
  identity: z
    .object({
      issueDate: optionalString(30),
      expiryDate: optionalString(30)
    })
    .default({}),
  address: z.object({
    phone: z.string().trim().min(1).max(20),
    addressOnId: optionalString(500),
    province: optionalString(120),
    district: optionalString(120),
    subdistrict: optionalString(120),
    postalCode: optionalString(20),
    currentAddress: optionalString(500)
  }),
  employment: z.object({
    role: optionalString(50),
    tradeType: optionalString(50),
    experienceYears: z.union([z.string(), z.number(), z.null(), z.undefined()]).optional()
  }),
  credentials: z
    .object({
      email: z.string().trim().email().max(120),
      password: z.union([z.string().min(8), z.undefined(), z.null()]).optional()
    })
    .default({ email: '', password: undefined })
});

const userListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
  search: z.string().max(120).trim().optional(),
  status: z.string().max(30).optional()
});

app.get('/api/admin/users', requireAuth, authorizeRoles('admin'), async (req, res) => {
  try {
    const params = userListQuerySchema.parse(req.query ?? {});
    const filters = [];
    const values = [];

    if (params.search) {
      const like = `%${params.search}%`;
      filters.push('(full_name LIKE ? OR phone LIKE ? OR email LIKE ?)');
      values.push(like, like, like);
    }

    if (params.status) {
      filters.push('status = ?');
      values.push(params.status);
    }

    const whereClause = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
    const countRows = await query(`SELECT COUNT(*) AS total FROM users ${whereClause}`, values);
    const total = Number(countRows[0]?.total ?? 0);

    values.push(params.limit, params.offset);
    const dataSql = `
      SELECT id, full_name, phone, email, status, created_at, last_login
      FROM users
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `;

    const items = await query(dataSql, values);

    res.json({ total, limit: params.limit, offset: params.offset, items });
  } catch (error) {
    console.error(error);
    res.status(400).json({ message: 'Invalid query' });
  }
});

const createUserSchema = z.object({
  full_name: z.string().min(1).max(120),
  phone: z.string().regex(/^[+0-9]{8,15}$/),
  email: z.string().email().optional().or(z.literal('')),
  password: z.string().min(8),
  status: z.string().max(30).optional().default('active'),
  roles: roleArraySchema
});

app.post('/api/admin/users', requireAuth, authorizeRoles('admin'), async (req, res) => {
  try {
    const payload = createUserSchema.parse(req.body ?? {});
    const normalizedPhone = normalizePhoneTH(payload.phone);
    const normalizedEmail = payload.email ? payload.email.toLowerCase() : null;

    const result = await withTransaction(async connection => {
      const duplicate = normalizedEmail
        ? await queryOne(
            'SELECT id FROM users WHERE phone = ? OR LOWER(email) = ? LIMIT 1',
            [normalizedPhone, normalizedEmail],
            connection
          )
        : await queryOne('SELECT id FROM users WHERE phone = ? LIMIT 1', [normalizedPhone], connection);

      if (duplicate) {
        return { error: { status: 409, message: 'duplicate_phone_or_email' } };
      }

      const userId = randomUUID();
      const passwordHash = await bcrypt.hash(payload.password, 10);

      await execute(
        'INSERT INTO users (id, full_name, phone, email, password_hash, status) VALUES (?, ?, ?, ?, ?, ?)',
        [userId, payload.full_name, normalizedPhone, normalizedEmail, passwordHash, payload.status],
        connection
      );

      if (payload.roles.length) {
        await replaceUserRoles(userId, payload.roles, connection);
      }

      const user = await queryOne(
        'SELECT id, full_name, phone, email, status, created_at FROM users WHERE id = ?',
        [userId],
        connection
      );

      return { user };
    });

    if (result.error) {
      return res.status(result.error.status).json({ message: result.error.message });
    }

    res.status(201).json({ ...result.user, roles: payload.roles });
  } catch (error) {
    if (error?.issues) return res.status(400).json({ message: 'Invalid input', errors: error.issues });
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

app.get('/api/admin/users/:id', requireAuth, authorizeRoles('admin'), async (req, res) => {
  try {
    const userId = req.params.id;
    if (!uuidSchema.safeParse(userId).success) return res.status(400).json({ message: 'invalid id' });
    const user = await queryOne(
      'SELECT id, full_name, phone, email, status, created_at, last_login FROM users WHERE id = ?',
      [userId]
    );
    if (!user) return res.status(404).json({ message: 'not_found' });
    const roles = await fetchUserRoles(userId);
    res.json({ ...user, roles });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

const updateUserSchema = z.object({
  full_name: z.string().min(1).max(120).optional(),
  phone: z.string().regex(/^[+0-9]{8,15}$/).optional(),
  email: z.string().email().or(z.literal('')).optional(),
  password: z.string().min(8).optional(),
  status: z.string().max(30).optional(),
  roles: roleArraySchema.optional()
}).refine(data => Object.keys(data).length > 0, { message: 'No fields to update' });

app.put('/api/admin/users/:id', requireAuth, authorizeRoles('admin'), async (req, res) => {
  try {
    const userId = req.params.id;
    if (!uuidSchema.safeParse(userId).success) return res.status(400).json({ message: 'invalid id' });
    const payload = updateUserSchema.parse(req.body ?? {});

    const result = await withTransaction(async connection => {
      const updateData = {
        full_name: payload.full_name,
        phone: payload.phone ? normalizePhoneTH(payload.phone) : undefined,
        email: payload.email !== undefined ? (payload.email || null) : undefined,
        status: payload.status,
        password_hash: payload.password ? await bcrypt.hash(payload.password, 10) : undefined
      };

      const clause = buildUpdateClause(updateData);
      if (clause.sets.length) {
        const sql = `UPDATE users SET ${clause.sets.join(', ')}, updated_at = NOW(6) WHERE id = ?`;
        const outcome = await execute(sql, [...clause.values, userId], connection);
        if (!outcome.affectedRows) {
          return { error: { status: 404, message: 'not_found' } };
        }
      }

      if (payload.roles !== undefined) {
        await replaceUserRoles(userId, payload.roles, connection);
      }

      const user = await queryOne(
        'SELECT id, full_name, phone, email, status, created_at, last_login FROM users WHERE id = ?',
        [userId],
        connection
      );
      if (!user) {
        return { error: { status: 404, message: 'not_found' } };
      }

      const roles = await fetchUserRoles(userId, connection);
      return { user: { ...user, roles } };
    });

    if (result.error) {
      return res.status(result.error.status).json({ message: result.error.message });
    }

    res.json(result.user);
  } catch (error) {
    if (error?.issues) return res.status(400).json({ message: 'Invalid input', errors: error.issues });
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

app.delete('/api/admin/users/:id', requireAuth, authorizeRoles('admin'), async (req, res) => {
  try {
    const userId = req.params.id;
    if (!uuidSchema.safeParse(userId).success) return res.status(400).json({ message: 'invalid id' });
    const result = await execute('DELETE FROM users WHERE id = ?', [userId]);
    if (!result.affectedRows) return res.status(404).json({ message: 'not_found' });
    res.status(204).send();
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// ---------------------------------------------------------------------------
// Audit Logs
// ---------------------------------------------------------------------------
const auditLogQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  search: z.string().max(200).trim().optional().or(z.literal('')),
  status: z.string().max(30).optional(),
  startDate: z.string().max(20).optional(),
  endDate: z.string().max(20).optional()
});

app.get('/api/admin/audit-logs', async (req, res) => {
  try {
    await ensureAuditLogSchemaReady();
    const params = auditLogQuerySchema.parse(req.query ?? {});
    const limitValue = Number.isFinite(params.limit) ? params.limit : 10;
    const pageValue = Number.isFinite(params.page) ? params.page : 1;
    const offset = (pageValue - 1) * limitValue;
    const filters = [];
    const values = [];

    if (params.search) {
      const like = `%${params.search}%`;
      filters.push('(username LIKE ? OR action LIKE ? OR details LIKE ?)');
      values.push(like, like, like);
    }

    if (params.status && params.status !== 'all') {
      filters.push('status = ?');
      values.push(params.status);
    }

    if (params.startDate) {
      filters.push('DATE(created_at) >= ?');
      values.push(params.startDate);
    }

    if (params.endDate) {
      filters.push('DATE(created_at) <= ?');
      values.push(params.endDate);
    }

    const whereClause = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
    const countRows = await query(`SELECT COUNT(*) AS total FROM audit_logs ${whereClause}`, values);
    const total = Number(countRows[0]?.total ?? 0);

    if (!Number.isFinite(limitValue) || !Number.isFinite(offset)) {
      return res.json({ items: [], total: 0 });
    }
    const safeLimit = Math.max(1, Math.min(100, Math.floor(limitValue)));
    const safeOffset = Math.max(0, Math.floor(offset));
    let rows = [];
    try {
      rows = await query(
        `SELECT id, created_at, username, role, action, details, ip_address, status
         FROM audit_logs
         ${whereClause}
         ORDER BY created_at DESC
         LIMIT ${safeLimit} OFFSET ${safeOffset}`,
        values
      );
    } catch (error) {
      if (error?.code === 'ER_BAD_FIELD_ERROR') {
        rows = await query(
          `SELECT id, created_at, actor_user_id, action, details, ip_address
           FROM audit_logs
           ${whereClause}
           ORDER BY created_at DESC
           LIMIT ${safeLimit} OFFSET ${safeOffset}`,
          values
        );
      } else {
        throw error;
      }
    }

    const items = rows.map(row => ({
      id: row.id,
      timestamp: row.created_at,
      user: row.username || row.actor_user_id || 'Unknown',
      role: row.role || '-',
      action: row.action,
      details: row.details,
      ip: row.ip_address,
      status: row.status || 'success'
    }));

    res.json({ items, total });
  } catch (error) {
    if (error?.issues) return res.status(400).json({ message: 'Invalid query', errors: error.issues });
    if (error?.code === 'ER_NO_SUCH_TABLE') {
      console.warn('[audit-logs] table missing');
      return res.json({ items: [], total: 0 });
    }
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

app.post('/api/admin/audit-logs', async (req, res) => {
  try {
    await ensureAuditLogSchemaReady();
    const { action, details, status } = req.body ?? {};
    const trimmedAction = typeof action === 'string' ? action.trim() : '';
    if (!trimmedAction) {
      return res.status(400).json({ success: false, message: 'action_required' });
    }
    await writeAuditLog({
      req,
      username: String(req.user?.id || 'system'),
      role: Array.isArray(req.user?.roles) ? req.user.roles.join(',') : 'admin',
      action: trimmedAction,
      details: details ?? null,
      status: status || 'success'
    });
    return res.status(201).json({ success: true });
  } catch (error) {
    console.error('POST /api/admin/audit-logs error:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ---------------------------------------------------------------------------
// Public lookup
// ---------------------------------------------------------------------------
const phoneQuerySchema = z.object({ phone: z.string().min(3) });
app.get('/api/users/by-phone', async (req, res) => {
  try {
    const { phone } = phoneQuerySchema.parse(req.query ?? {});
    const user = await queryOne(
      'SELECT id, full_name, phone, email FROM users WHERE phone = ? LIMIT 1',
      [phone]
    );
    if (!user) return res.status(404).json({ message: 'not_found' });
    const roles = await fetchUserRoles(user.id);
    res.json({ ...user, roles });
  } catch (error) {
    console.error(error);
    res.status(400).json({ message: 'Invalid phone' });
  }
});

// ---------------------------------------------------------------------------
// Tasks
// ---------------------------------------------------------------------------
const taskStatusEnum = z.enum(['todo', 'in-progress', 'done']);
const taskPriorityEnum = z.enum(['low', 'medium', 'high']);
const assignmentTypeEnum = z.enum(['general', 'practical_assessment']);

const taskListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
  status: taskStatusEnum.optional(),
  project_id: uuidSchema.optional(),
  assignee_id: uuidSchema.optional(),
  search: z.string().max(120).trim().optional()
});

app.get('/api/tasks', requireAuth, authorizeRoles('admin', 'project_manager'), async (req, res) => {
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

    values.push(params.limit, params.offset);
    const items = await query(
      `SELECT
         t.id,
         t.title,
         t.status,
         t.priority,
         t.due_date,
         t.project_id,
         p.name AS project_name,
         t.site_id,
         s.name AS site_name,
         t.assignee_user_id,
         u.full_name AS assignee_name,
         t.description,
         t.category,
         t.required_level,
         t.required_workers
       FROM tasks t
       JOIN projects p ON p.id = t.project_id
       LEFT JOIN sites s ON s.id = t.site_id
       LEFT JOIN users u ON u.id = t.assignee_user_id
       ${whereClause}
       ORDER BY t.due_date ASC, t.title ASC
       LIMIT ? OFFSET ?`,
      values
    );

    res.json({ total, limit: params.limit, offset: params.offset, items });
  } catch (error) {
    console.error(error);
    res.status(400).json({ message: 'Invalid query' });
  }
});

async function ensureTasksSchemaExtended() {
  try {
    const [cols] = await pool.query(`SHOW COLUMNS FROM tasks`);
    const colNames = new Set(cols.map(c => c.Field));

    if (!colNames.has('description')) {
      await pool.query(`ALTER TABLE tasks ADD COLUMN description TEXT NULL`);
      console.info('[tasks] Added column description');
    }
    if (!colNames.has('category')) {
      await pool.query(`ALTER TABLE tasks ADD COLUMN category VARCHAR(100) NULL`);
      console.info('[tasks] Added column category');
    }
    if (!colNames.has('required_level')) {
      await pool.query(`ALTER TABLE tasks ADD COLUMN required_level INT NULL DEFAULT 1`);
      console.info('[tasks] Added column required_level');
    }
    if (!colNames.has('required_workers')) {
      await pool.query(`ALTER TABLE tasks ADD COLUMN required_workers INT NULL DEFAULT 1`);
      console.info('[tasks] Added column required_workers');
    }
  } catch (err) {
    console.warn('[tasks] Failed to ensure schema extensions', err.message);
  }
}
ensureTasksSchemaExtended().catch(e => console.error(e));

const createTaskSchema = z.object({
  title: z.string().min(1).max(200),
  project_id: uuidSchema,
  site_id: uuidSchema.optional(),
  priority: taskPriorityEnum.default('medium'),
  status: taskStatusEnum.default('todo'),
  assignee_user_id: uuidSchema.optional(),
  due_date: z.coerce.date().optional(),
  worker_ids: z.array(z.coerce.number().int().positive()).optional(),
  assignment_type: assignmentTypeEnum.optional(),
  description: z.string().optional(),
  category: z.string().optional(),
  required_level: z.coerce.number().int().optional(),
  required_workers: z.coerce.number().int().optional()
});

app.post('/api/tasks', requireAuth, authorizeRoles('admin', 'project_manager'), async (req, res) => {
  try {
    const payload = createTaskSchema.parse(req.body ?? {});
    const taskId = randomUUID();
    await execute(
      `INSERT INTO tasks(id, project_id, site_id, title, priority, status, assignee_user_id, due_date, description, category, required_level, required_workers)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        taskId,
        payload.project_id,
        payload.site_id || null,
        payload.title,
        payload.priority,
        payload.status,
        payload.assignee_user_id || null,
        payload.due_date ? payload.due_date.toISOString().slice(0, 10) : null
      ]
    );

    const workerIds = Array.isArray(payload.worker_ids)
      ? Array.from(new Set(payload.worker_ids.map(id => Number(id)).filter(Number.isFinite)))
      : [];

    if (workerIds.length > 0) {
      await ensureTaskWorkerAssignmentSchema();
      const assignmentType = payload.assignment_type || 'general';
      for (const workerId of workerIds) {
        await execute(
          `INSERT INTO task_worker_assignments
           (id, task_id, worker_id, assignment_type, status, assigned_by_user_id)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [randomUUID(), taskId, workerId, assignmentType, 'assigned', req.user?.id || null]
        );
      }
    }

    const task = await queryOne(
      `SELECT t.id, t.title, t.status, t.priority, t.due_date, t.project_id, p.name AS project_name,
              t.site_id, s.name AS site_name, t.assignee_user_id, u.full_name AS assignee_name
       FROM tasks t
       JOIN projects p ON p.id = t.project_id
       LEFT JOIN sites s ON s.id = t.site_id
       LEFT JOIN users u ON u.id = t.assignee_user_id
       WHERE t.id = ?`,
      [taskId]
    );

    res.status(201).json(task);
  } catch (error) {
    if (error?.issues) return res.status(400).json({ message: 'Invalid input', errors: error.issues });
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

app.get('/api/tasks/:id', requireAuth, authorizeRoles('admin', 'project_manager'), async (req, res) => {
  try {
    const taskId = req.params.id;
    if (!uuidSchema.safeParse(taskId).success) return res.status(400).json({ message: 'invalid id' });
    const task = await queryOne(
      `SELECT t.id, t.title, t.status, t.priority, t.due_date, t.project_id, p.name AS project_name,
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
  priority: taskPriorityEnum.optional(),
  status: taskStatusEnum.optional(),
  assignee_user_id: uuidSchema.optional().nullable(),
  due_date: z.coerce.date().optional().nullable()
}).refine(data => Object.keys(data).length > 0, { message: 'No fields to update' });

app.put('/api/tasks/:id', requireAuth, authorizeRoles('admin', 'project_manager'), async (req, res) => {
  try {
    const taskId = req.params.id;
    if (!uuidSchema.safeParse(taskId).success) return res.status(400).json({ message: 'invalid id' });
    const payload = updateTaskSchema.parse(req.body ?? {});

    const updateData = {
      title: payload.title,
      project_id: payload.project_id,
      site_id: payload.site_id === undefined ? undefined : (payload.site_id || null),
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
      `SELECT t.id, t.title, t.status, t.priority, t.due_date, t.project_id, p.name AS project_name,
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

app.delete('/api/tasks/:id', requireAuth, authorizeRoles('admin', 'project_manager'), async (req, res) => {
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
// Signup forms
// ---------------------------------------------------------------------------
const signupFormStatusEnum = z.enum(['pending', 'in_review', 'approved', 'rejected']);

const signupFormCreateSchema = z.object({
  full_name: z.string().min(1).max(200),
  phone: z.string().min(6).max(20),
  email: z.string().email().optional().or(z.literal('')),
  status: signupFormStatusEnum.optional(),
  payload: z.record(z.string(), z.any()).optional()
}).passthrough();

app.post('/api/forms/signup', async (req, res) => {
  try {
    const payload = signupFormCreateSchema.parse(req.body ?? {});
    const normalizedPhone = normalizePhoneTH(payload.phone);
    const normalizedEmail = payload.email ? payload.email.toLowerCase() : null;
    const payloadData = payload.payload && typeof payload.payload === 'object' ? payload.payload : { ...payload };

    const formId = randomUUID();
    await execute(
      `INSERT INTO signup_forms (id, full_name, phone, email, status, payload)
       VALUES (?, ?, ?, ?, ?, CAST(? AS JSON))`,
      [
        formId,
        payload.full_name,
        normalizedPhone,
        normalizedEmail,
        payload.status || 'pending',
        JSON.stringify(payloadData)
      ]
    );

    const form = await queryOne(
      'SELECT id, full_name, phone, email, status, payload, created_at, updated_at FROM signup_forms WHERE id = ?',
      [formId]
    );

    res.status(201).json(form);
  } catch (error) {
    if (error?.issues) return res.status(400).json({ message: 'Invalid input', errors: error.issues });
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

const signupFormListSchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
  status: signupFormStatusEnum.optional(),
  search: z.string().max(120).trim().optional()
});

app.get('/api/forms/signup', requireAuth, authorizeRoles('admin'), async (req, res) => {
  try {
    const params = signupFormListSchema.parse(req.query ?? {});
    const filters = [];
    const values = [];

    if (params.status) { filters.push('status = ?'); values.push(params.status); }
    if (params.search) {
      const like = `%${params.search}%`;
      filters.push('(full_name LIKE ? OR phone LIKE ? OR email LIKE ?)');
      values.push(like, like, like);
    }

    const whereClause = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
    const countRows = await query(`SELECT COUNT(*) AS total FROM signup_forms ${whereClause}`, values);
    const total = Number(countRows[0]?.total ?? 0);

    values.push(params.limit, params.offset);
    const items = await query(
      `SELECT id, full_name, phone, email, status, payload, created_at, updated_at
       FROM signup_forms
       ${whereClause}
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`,
      values
    );

    res.json({ total, limit: params.limit, offset: params.offset, items });
  } catch (error) {
    console.error(error);
    res.status(400).json({ message: 'Invalid query' });
  }
});

app.get('/api/forms/signup/:id', requireAuth, authorizeRoles('admin'), async (req, res) => {
  try {
    const formId = req.params.id;
    if (!uuidSchema.safeParse(formId).success) return res.status(400).json({ message: 'invalid id' });
    const form = await queryOne(
      'SELECT id, full_name, phone, email, status, payload, created_at, updated_at FROM signup_forms WHERE id = ?',
      [formId]
    );
    if (!form) return res.status(404).json({ message: 'not_found' });
    res.json(form);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

const signupFormUpdateSchema = z.object({
  full_name: z.string().min(1).max(200).optional(),
  phone: z.string().min(6).max(20).optional(),
  email: z.string().email().or(z.literal('')).optional(),
  status: signupFormStatusEnum.optional(),
  payload: z.record(z.string(), z.any()).optional()
}).passthrough().refine(data => Object.keys(data).length > 0, { message: 'No fields to update' });

app.put('/api/forms/signup/:id', requireAuth, authorizeRoles('admin'), async (req, res) => {
  try {
    const formId = req.params.id;
    if (!uuidSchema.safeParse(formId).success) return res.status(400).json({ message: 'invalid id' });
    const payload = signupFormUpdateSchema.parse(req.body ?? {});

    const payloadData = payload.payload && typeof payload.payload === 'object'
      ? payload.payload
      : undefined;

    const updateData = {
      full_name: payload.full_name,
      phone: payload.phone ? normalizePhoneTH(payload.phone) : undefined,
      email: payload.email !== undefined ? (payload.email || null) : undefined,
      status: payload.status,
      payload: payloadData ? JSON.stringify(payloadData) : undefined,
      updated_at: new Date()
    };

    const clause = buildUpdateClause(updateData);
    if (!clause.sets.length) return res.status(400).json({ message: 'nothing_to_update' });

    const sql = `UPDATE signup_forms SET ${clause.sets.join(', ')} WHERE id = ?`;
    const result = await execute(sql, [...clause.values, formId]);
    if (!result.affectedRows) return res.status(404).json({ message: 'not_found' });

    const form = await queryOne(
      'SELECT id, full_name, phone, email, status, payload, created_at, updated_at FROM signup_forms WHERE id = ?',
      [formId]
    );

    res.json(form);
  } catch (error) {
    if (error?.issues) return res.status(400).json({ message: 'Invalid input', errors: error.issues });
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

app.delete('/api/forms/signup/:id', requireAuth, authorizeRoles('admin'), async (req, res) => {
  try {
    const formId = req.params.id;
    if (!uuidSchema.safeParse(formId).success) return res.status(400).json({ message: 'invalid id' });
    const result = await execute('DELETE FROM signup_forms WHERE id = ?', [formId]);
    if (!result.affectedRows) return res.status(404).json({ message: 'not_found' });
    res.status(204).send();
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// ---------------------------------------------------------------------------
// Worker management
// ---------------------------------------------------------------------------
const workerIdParamSchema = z.object({
  id: z.coerce.number().int().positive()
});

function requireWorkerTables() {
  if (!workerTableColumns.size || !workerAccountColumns.size) {
    return refreshWorkerMetadata();
  }
  return Promise.resolve();
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

app.get('/api/admin/workers', async (_req, res) => {
  try {
    await requireWorkerTables();
    const items = await getAllWorkerResponses();
    res.json({ items });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

app.get('/api/admin/workers/:id', async (req, res) => {
  try {
    const params = workerIdParamSchema.safeParse({ id: req.params.id });
    if (!params.success) return res.status(400).json({ message: 'invalid_id' });

    await requireWorkerTables();
    const worker = await getWorkerResponseById(params.data.id);
    if (!worker) return res.status(404).json({ message: 'not_found' });
    res.json(worker);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

app.post('/api/admin/workers', async (req, res) => {
  try {
    await requireWorkerTables();

    if (!workerTableColumns.has('id')) {
      return res.status(500).json({ message: 'workers_table_missing_id' });
    }
    if (!workerAccountColumns.has('worker_id') || !workerAccountColumns.has('email') || !workerAccountColumns.has('password_hash')) {
      return res.status(500).json({ message: 'worker_accounts_table_missing_columns' });
    }

    const payload = workerRegistrationSchema.parse(req.body ?? {});
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

    const workerData = buildWorkerDataFromPayload(payload);
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

    const created = await withTransaction(async connection => {
      await execute(workerSql, workerValues, connection);
      const workerId = workerValues[workerColumns.indexOf('id')] ?? (await queryOne('SELECT LAST_INSERT_ID() AS id', [], connection))?.id;
      if (!workerId) throw new Error('worker_insert_failed');

      const accountData = filterObjectByColumns(
        {
          worker_id: workerId,
          email: normalizedEmail,
          password_hash: passwordHash,
          status: 'active'
        },
        workerAccountColumns
      );

      const accountColumns = Object.keys(accountData);
      if (!accountColumns.length) throw new Error('worker_account_columns_unavailable');
      const accountSql = `INSERT INTO worker_accounts (${accountColumns.join(', ')}) VALUES (${accountColumns
        .map(() => '?')
        .join(', ')})`;
      const accountValues = accountColumns.map(column => accountData[column]);
      await execute(accountSql, accountValues, connection);

      const profilePayload = sanitizeProfileForStorage(payload, normalizedEmail);
      await saveWorkerProfile(connection, workerId, profilePayload);

      const workerResponse = await getWorkerResponseById(workerId, connection);
      if (!workerResponse) throw new Error('worker_fetch_failed');
      return workerResponse;
    });

    res.status(201).json(created);
  } catch (error) {
    if (error?.issues) {
      return res.status(400).json({ message: 'Invalid input', errors: error.issues });
    }
    if (error?.message === 'worker_insert_failed' || error?.message === 'worker_account_columns_unavailable') {
      console.error(error);
      return res.status(500).json({ message: 'Server error' });
    }
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

app.put('/api/admin/workers/:id', async (req, res) => {
  try {
    const params = workerIdParamSchema.safeParse({ id: req.params.id });
    if (!params.success) return res.status(400).json({ message: 'invalid_id' });

    await requireWorkerTables();

    if (!workerTableColumns.has('id')) {
      return res.status(500).json({ message: 'workers_table_missing_id' });
    }
    if (!workerAccountColumns.has('worker_id') || !workerAccountColumns.has('email')) {
      return res.status(500).json({ message: 'worker_accounts_table_missing_columns' });
    }

    const exists = await queryOne('SELECT id FROM workers WHERE id = ? LIMIT 1', [params.data.id]);
    if (!exists) return res.status(404).json({ message: 'not_found' });

    const payload = workerRegistrationSchema.parse(req.body ?? {});
    const normalizedNationalId = String(payload.personal?.nationalId ?? '').trim();
    if (!/^\d{13}$/.test(normalizedNationalId)) {
      return res.status(400).json({ message: 'invalid_national_id_length' });
    }
    payload.personal.nationalId = normalizedNationalId;
    const normalizedEmail = normalizeEmail(payload.credentials?.email);
    if (!normalizedEmail) return res.status(400).json({ message: 'invalid_email' });
    const rawPhone = String(payload.address?.phone ?? '').trim();
    if (!/^0\d{9}$/.test(rawPhone)) {
      return res.status(400).json({ message: 'invalid_phone' });
    }
    payload.address.phone = rawPhone;

    const workerData = buildWorkerDataFromPayload(payload, { forUpdate: true });
    workerData.national_id = toNullableString(payload.personal?.nationalId);
    workerData.full_name = toNullableString(payload.personal?.fullName);

    if (!workerData.national_id) return res.status(400).json({ message: 'missing_national_id' });
    if (!workerData.full_name) return res.status(400).json({ message: 'missing_full_name' });

    const duplicateNational = await queryOne(
      'SELECT id FROM workers WHERE national_id = ? AND id <> ? LIMIT 1',
      [workerData.national_id, params.data.id]
    );
    if (duplicateNational) return res.status(409).json({ message: 'duplicate_national_id' });

    const duplicateEmail = await queryOne(
      'SELECT worker_id FROM worker_accounts WHERE LOWER(email) = ? AND worker_id <> ? LIMIT 1',
      [normalizedEmail, params.data.id]
    );
    if (duplicateEmail) return res.status(409).json({ message: 'duplicate_email' });

    const filteredWorkerData = filterObjectByColumns(workerData, workerTableColumns);
    const workerClause = buildUpdateClause(filteredWorkerData);

    const passwordToUpdate = toNullableString(payload.credentials?.password);

    await withTransaction(async connection => {
      if (workerClause.sets.length) {
        await execute(
          `UPDATE workers SET ${workerClause.sets.join(', ')} WHERE id = ?`,
          [...workerClause.values, params.data.id],
          connection
        );
      }

      const accountUpdates = filterObjectByColumns({ email: normalizedEmail }, workerAccountColumns);
      const accountClause = buildUpdateClause(accountUpdates);
      if (accountClause.sets.length) {
        await execute(
          `UPDATE worker_accounts SET ${accountClause.sets.join(', ')} WHERE worker_id = ?`,
          [...accountClause.values, params.data.id],
          connection
        );
      }

      if (passwordToUpdate) {
        const passwordHash = await bcrypt.hash(passwordToUpdate, 10);
        const passwordUpdates = filterObjectByColumns({ password_hash: passwordHash }, workerAccountColumns);
        const passwordClause = buildUpdateClause(passwordUpdates);
        if (passwordClause.sets.length) {
          await execute(
            `UPDATE worker_accounts SET ${passwordClause.sets.join(', ')} WHERE worker_id = ?`,
            [...passwordClause.values, params.data.id],
            connection
          );
        }
      }

      const profilePayload = sanitizeProfileForStorage(payload, normalizedEmail);
      await saveWorkerProfile(connection, params.data.id, profilePayload);
    });

    const updated = await getWorkerResponseById(params.data.id);
    if (!updated) return res.status(404).json({ message: 'not_found' });
    res.json(updated);
  } catch (error) {
    if (error?.issues) {
      return res.status(400).json({ message: 'Invalid input', errors: error.issues });
    }
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

app.patch('/api/admin/workers/:id/assessment-access', async (req, res) => {
  try {
    const params = workerIdParamSchema.safeParse({ id: req.params.id });
    if (!params.success) return res.status(400).json({ message: 'invalid_id' });

    await requireWorkerTables();

    const rawEnabled = req.body?.enabled;
    const enabled = typeof rawEnabled === 'boolean'
      ? rawEnabled
      : ['true', '1', 'yes'].includes(String(rawEnabled).toLowerCase());

    const existingProfile = (await fetchWorkerProfile(undefined, params.data.id)) || {
      personal: {},
      identity: {},
      address: {},
      employment: {},
      credentials: {}
    };

    existingProfile.employment = {
      ...(existingProfile.employment || {}),
      assessmentEnabled: enabled
    };

    await withTransaction(async connection => {
      await saveWorkerProfile(connection, params.data.id, existingProfile);
    });

    const workerResponse = await getWorkerResponseById(params.data.id);
    if (!workerResponse) return res.status(404).json({ message: 'not_found' });
    res.json(workerResponse);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

app.patch('/api/admin/workers/:id/status', async (req, res) => {
  try {
    const params = workerIdParamSchema.safeParse({ id: req.params.id });
    if (!params.success) return res.status(400).json({ message: 'invalid_id' });

    await requireWorkerTables();

    if (!workerTableColumns.has('id') || !workerTableColumns.has('employment_status')) {
      return res.status(500).json({ message: 'worker_columns_unavailable' });
    }

    const nextStatus = String(req.body?.status || '').trim();
    if (!['probation', 'permanent'].includes(nextStatus)) {
      return res.status(400).json({ message: 'invalid_status' });
    }

    if (nextStatus === 'permanent') {
      const assessmentSummary = await fetchLatestAssessmentSummary(params.data.id);
      const passed = assessmentSummary?.passed === true ||
        (typeof assessmentSummary?.score === 'number' && assessmentSummary.score >= 60);
      if (!passed) {
        return res.status(400).json({ message: 'assessment_not_passed' });
      }
    }

    const result = await execute(
      'UPDATE workers SET employment_status = ? WHERE id = ?',
      [nextStatus, params.data.id]
    );
    if (!result.affectedRows) return res.status(404).json({ message: 'not_found' });

    const workerResponse = await getWorkerResponseById(params.data.id);
    if (!workerResponse) return res.status(404).json({ message: 'not_found' });
    res.json(workerResponse);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

app.delete('/api/admin/workers/:id', async (req, res) => {
  try {
    const params = workerIdParamSchema.safeParse({ id: req.params.id });
    if (!params.success) return res.status(400).json({ message: 'invalid_id' });

    await requireWorkerTables();

    const exists = await queryOne('SELECT id FROM workers WHERE id = ? LIMIT 1', [params.data.id]);
    if (!exists) return res.status(404).json({ message: 'not_found' });

    await withTransaction(async connection => {
      try {
        if (workerProfilesTableExists) {
          await execute('DELETE FROM worker_profiles WHERE worker_id = ?', [params.data.id], connection);
        }
      } catch (error) {
        if (error?.code === 'ER_NO_SUCH_TABLE') {
          workerProfilesTableExists = false;
        } else {
          throw error;
        }
      }

      await execute('DELETE FROM worker_accounts WHERE worker_id = ?', [params.data.id], connection);
      await execute('DELETE FROM workers WHERE id = ?', [params.data.id], connection);
    });

    res.status(204).send();
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// ---------------------------------------------------------------------------
// Assessment configuration
// ---------------------------------------------------------------------------
const assessmentSettingsSchema = z.object({
  questionCount: z.coerce.number().int().min(1).max(200),
  startAt: z.union([z.string().min(1), z.null()]).optional(),
  endAt: z.union([z.string().min(1), z.null()]).optional(),
  frequencyMonths: z.union([z.coerce.number().int().min(1).max(24), z.null()]).optional()
});

const assessmentRoundUpsertSchema = z.object({
  title: z.string().min(1).max(200),
  category: z.string().max(120).optional().or(z.literal('')),
  description: z.string().max(2000).optional(),
  questionCount: z.coerce.number().int().min(1).max(200),
  passingScore: z.coerce.number().min(0).max(100).optional(),
  durationMinutes: z.coerce.number().int().min(1).max(600).optional(),
  showScore: z.boolean().optional(),
  showAnswers: z.boolean().optional(),
  showBreakdown: z.boolean().optional(),
  subcategoryQuotas: z.record(z.any()).optional(),
  difficultyWeights: z.record(z.any()).optional(),
  criteria: z.record(z.any()).optional(),
  status: z.string().max(50).optional(),
  active: z.boolean().optional(),
  frequencyMonths: z.union([z.coerce.number().int().min(1).max(24), z.null()]).optional()
}).superRefine((data, ctx) => {
  void data;
  void ctx;
});

let assessmentSchemaPromise = null;

const manageQuestionBaseSchema = z.object({
  question_text: z.string().min(1),
  choice_a: z.string().min(1),
  choice_b: z.string().min(1),
  choice_c: z.string().min(1),
  choice_d: z.string().min(1),
  answer: z.string().trim().min(1).max(1).transform(value => value.toUpperCase()),
  difficulty_level: z.coerce.number().int().min(1).max(5).optional(),
  skill_type: z.string().max(200).optional()
});

function validateMultipleChoiceAnswer(value, ctx) {
  if (!['A', 'B', 'C', 'D'].includes(value)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'answer_must_be_A_B_C_or_D',
      path: ['answer']
    });
  }
}

const manageQuestionCreateItemSchema = manageQuestionBaseSchema.superRefine((data, ctx) => {
  validateMultipleChoiceAnswer(data.answer, ctx);
});

const manageQuestionBulkCreateSchema = z.array(manageQuestionCreateItemSchema).min(1);

const manageQuestionUpdateSchema = manageQuestionBaseSchema.partial().superRefine((data, ctx) => {
  if (data.answer !== undefined) {
    validateMultipleChoiceAnswer(data.answer, ctx);
  }
  if (!Object.values(data).some(value => value !== undefined)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'no_fields_to_update'
    });
  }
});

async function ensureAssessmentSchema(connection) {
  const executor = connection ?? pool;
  await executor.execute(`
    CREATE TABLE IF NOT EXISTS questions (
      id CHAR(36) NOT NULL,
      text TEXT NOT NULL,
      category VARCHAR(120) NULL,
      difficulty VARCHAR(60) NULL,
      version VARCHAR(60) NULL,
      active TINYINT(1) NOT NULL DEFAULT 1,
      created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
      updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
      PRIMARY KEY (id),
      KEY idx_questions_category (category)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await executor.execute(`
    CREATE TABLE IF NOT EXISTS question_options (
      id CHAR(36) NOT NULL,
      question_id CHAR(36) NOT NULL,
      text TEXT NOT NULL,
      is_correct TINYINT(1) NOT NULL DEFAULT 0,
      created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
      PRIMARY KEY (id),
      KEY idx_question_options_question (question_id),
      CONSTRAINT fk_question_options_question FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await executor.execute(`
    CREATE TABLE IF NOT EXISTS assessment_settings (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      question_count INT UNSIGNED NOT NULL DEFAULT 60,
      start_at DATETIME(6) NULL,
      end_at DATETIME(6) NULL,
      frequency_months INT UNSIGNED NULL,
      created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
      updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
      PRIMARY KEY (id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await executor.execute(`
    CREATE TABLE IF NOT EXISTS assessment_rounds (
      id CHAR(36) NOT NULL,
      title VARCHAR(200) NOT NULL,
      category VARCHAR(120) NULL,
      description TEXT NULL,
      question_count INT UNSIGNED NOT NULL DEFAULT 60,
      passing_score DECIMAL(5,2) NULL DEFAULT 70.00,
      duration_minutes INT UNSIGNED NULL DEFAULT 60,
      show_score TINYINT(1) NOT NULL DEFAULT 1,
      show_answers TINYINT(1) NOT NULL DEFAULT 0,
      show_breakdown TINYINT(1) NOT NULL DEFAULT 1,
      subcategory_quotas JSON NULL,
      difficulty_weights JSON NULL,
      criteria JSON NULL,
      status VARCHAR(50) NOT NULL DEFAULT 'draft',
      active TINYINT(1) NOT NULL DEFAULT 1,
      history JSON NULL,
      start_at DATETIME(6) NULL,
      end_at DATETIME(6) NULL,
      frequency_months INT UNSIGNED NULL,
      created_by VARCHAR(255) NULL,
      updated_by VARCHAR(255) NULL,
      created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
      updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
      PRIMARY KEY (id),
      KEY idx_assessment_rounds_category (category),
      KEY idx_assessment_rounds_start_at (start_at),
      KEY idx_assessment_rounds_created_at (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // Auto-migration: ensure all necessary columns exist in assessment_rounds
  try {
    const columns = await query('SHOW COLUMNS FROM assessment_rounds', [], executor);
    if (Array.isArray(columns)) {
      const existingColumns = new Set(columns.map(c => c.Field));
      
      const migrations = [
        { name: 'passing_score', sql: 'ALTER TABLE assessment_rounds ADD COLUMN passing_score DECIMAL(5,2) NULL DEFAULT 70.00 AFTER question_count' },
        { name: 'duration_minutes', sql: 'ALTER TABLE assessment_rounds ADD COLUMN duration_minutes INT UNSIGNED NULL DEFAULT 60 AFTER passing_score' },
        { name: 'show_score', sql: 'ALTER TABLE assessment_rounds ADD COLUMN show_score TINYINT(1) NOT NULL DEFAULT 1 AFTER duration_minutes' },
        { name: 'show_answers', sql: 'ALTER TABLE assessment_rounds ADD COLUMN show_answers TINYINT(1) NOT NULL DEFAULT 0 AFTER show_score' },
        { name: 'show_breakdown', sql: 'ALTER TABLE assessment_rounds ADD COLUMN show_breakdown TINYINT(1) NOT NULL DEFAULT 1 AFTER show_answers' },
        { name: 'subcategory_quotas', sql: 'ALTER TABLE assessment_rounds ADD COLUMN subcategory_quotas JSON NULL AFTER show_breakdown' },
        { name: 'difficulty_weights', sql: 'ALTER TABLE assessment_rounds ADD COLUMN difficulty_weights JSON NULL AFTER subcategory_quotas' },
        { name: 'criteria', sql: 'ALTER TABLE assessment_rounds ADD COLUMN criteria JSON NULL AFTER difficulty_weights' },
        { name: 'status', sql: "ALTER TABLE assessment_rounds ADD COLUMN status VARCHAR(50) NOT NULL DEFAULT 'draft' AFTER criteria" },
        { name: 'active', sql: 'ALTER TABLE assessment_rounds ADD COLUMN active TINYINT(1) NOT NULL DEFAULT 1 AFTER status' },
        { name: 'history', sql: 'ALTER TABLE assessment_rounds ADD COLUMN history JSON NULL AFTER active' },
        { name: 'created_by', sql: 'ALTER TABLE assessment_rounds ADD COLUMN created_by VARCHAR(255) NULL AFTER history' },
        { name: 'updated_by', sql: 'ALTER TABLE assessment_rounds ADD COLUMN updated_by VARCHAR(255) NULL AFTER created_by' }
      ];

      for (const m of migrations) {
        if (!existingColumns.has(m.name)) {
          // Use a plain query call for ALTER TABLE
          await executor.query(m.sql);
        }
      }
    }
  } catch (err) {
    console.warn('[schema] Migration for assessment_rounds failed:', err.message);
  }
}

let assessmentSessionSchemaPromise = null;

async function ensureAssessmentSessionSchema(connection) {
  const executor = connection ?? pool;
  await executor.execute(`
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
      KEY idx_assessment_sessions_user (user_id),
      CONSTRAINT fk_assessment_sessions_round FOREIGN KEY (round_id) REFERENCES assessment_rounds(id) ON DELETE CASCADE,
      CONSTRAINT fk_assessment_sessions_worker FOREIGN KEY (worker_id) REFERENCES workers(id) ON DELETE SET NULL,
      CONSTRAINT fk_assessment_sessions_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await executor.execute(`
    CREATE TABLE IF NOT EXISTS assessment_session_questions (
      session_id CHAR(36) NOT NULL,
      question_id VARCHAR(36) NOT NULL,
      display_order INT UNSIGNED NOT NULL,
      source_table VARCHAR(40) NOT NULL DEFAULT 'questions',
      PRIMARY KEY (session_id, question_id),
      KEY idx_assessment_session_questions_order (session_id, display_order),
      CONSTRAINT fk_assessment_session_questions_session FOREIGN KEY (session_id) REFERENCES assessment_sessions(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
}

function ensureAssessmentSessionSchemaReady(connection) {
  if (!assessmentSessionSchemaPromise) {
    assessmentSessionSchemaPromise = ensureAssessmentSessionSchema(connection).catch(error => {
      console.error('[assessment-session] Failed to ensure schema', error);
      assessmentSessionSchemaPromise = null;
      throw error;
    });
  }
  return assessmentSessionSchemaPromise;
}

let assessmentResultSchemaPromise = null;

async function ensureAssessmentResultSchema(connection) {
  const executor = connection ?? pool;
  await executor.execute(`
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
      CONSTRAINT fk_worker_assessment_worker FOREIGN KEY (worker_id) REFERENCES workers(id) ON DELETE CASCADE,
      CONSTRAINT fk_worker_assessment_round FOREIGN KEY (round_id) REFERENCES assessment_rounds(id) ON DELETE SET NULL,
      CONSTRAINT fk_worker_assessment_session FOREIGN KEY (session_id) REFERENCES assessment_sessions(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
}

function ensureAssessmentResultSchemaReady(connection) {
  if (!assessmentResultSchemaPromise) {
    assessmentResultSchemaPromise = ensureAssessmentResultSchema(connection).catch(error => {
      console.error('[assessment-result] Failed to ensure schema', error);
      assessmentResultSchemaPromise = null;
      throw error;
    });
  }
  return assessmentResultSchemaPromise;
}

let auditLogSchemaPromise = null;

async function ensureAuditLogSchema(connection) {
  const executor = connection ?? pool;
  await executor.execute(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      username VARCHAR(120) NULL,
      role VARCHAR(60) NULL,
      action VARCHAR(120) NOT NULL,
      details JSON NULL,
      ip_address VARCHAR(45) NULL,
      status VARCHAR(30) NULL,
      created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
      PRIMARY KEY (id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
}

function ensureAuditLogSchemaReady(connection) {
  if (!auditLogSchemaPromise) {
    auditLogSchemaPromise = ensureAuditLogSchema(connection).catch(error => {
      console.error('[audit-logs] Failed to ensure schema', error);
      auditLogSchemaPromise = null;
      throw error;
    });
  }
  return auditLogSchemaPromise;
}

function ensureAssessmentSchemaReady(connection) {
  if (!assessmentSchemaPromise) {
    assessmentSchemaPromise = ensureAssessmentSchema(connection).catch(error => {
      console.error('[assessment] Failed to ensure schema', error);
      assessmentSchemaPromise = null;
      throw error;
    });
  }
  return assessmentSchemaPromise;
}

let manageQuestionSchemaPromise = null;

async function ensureManageQuestionSchema(connection) {
  const executor = connection ?? pool;
  await executor.execute(`
    CREATE TABLE IF NOT EXISTS manage_questions (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      question_text TEXT NOT NULL,
      choice_a TEXT NOT NULL,
      choice_b TEXT NOT NULL,
      choice_c TEXT NOT NULL,
      choice_d TEXT NOT NULL,
      answer ENUM('A','B','C','D') NOT NULL,
      difficulty_level TINYINT UNSIGNED NULL,
      skill_type VARCHAR(200) NULL,
      created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
      updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
      PRIMARY KEY (id),
      KEY idx_manage_questions_skill (skill_type),
      KEY idx_manage_questions_difficulty (difficulty_level)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
}

function ensureManageQuestionSchemaReady(connection) {
  if (!manageQuestionSchemaPromise) {
    manageQuestionSchemaPromise = ensureManageQuestionSchema(connection).catch(error => {
      console.error('[manage-question] Failed to ensure schema', error);
      manageQuestionSchemaPromise = null;
      throw error;
    });
  }
  return manageQuestionSchemaPromise;
}

function mapManageQuestionRow(row) {
  if (!row) {
    return null;
  }
  return {
    id: Number(row.id),
    question_text: row.question_text,
    choice_a: row.choice_a,
    choice_b: row.choice_b,
    choice_c: row.choice_c,
    choice_d: row.choice_d,
    answer: row.answer,
    difficulty_level: row.difficulty_level === null || row.difficulty_level === undefined
      ? null
      : Number(row.difficulty_level),
    skill_type: row.skill_type,
    created_at: row.created_at instanceof Date ? row.created_at.toISOString() : null,
    updated_at: row.updated_at instanceof Date ? row.updated_at.toISOString() : null
  };
}

async function fetchManageQuestionById(questionId, connection) {
  const row = await queryOne(
    `SELECT id, question_text, choice_a, choice_b, choice_c, choice_d, answer, difficulty_level, skill_type, created_at, updated_at
     FROM manage_questions
     WHERE id = ?
     LIMIT 1`,
    [questionId],
    connection
  );
  return mapManageQuestionRow(row);
}

async function fetchManageQuestions(connection) {
  const rows = await query(
    `SELECT id, question_text, choice_a, choice_b, choice_c, choice_d, answer, difficulty_level, skill_type, created_at, updated_at
     FROM manage_questions
     ORDER BY id ASC`,
    [],
    connection
  );
  return rows.map(mapManageQuestionRow).filter(Boolean);
}

function mapAssessmentSettingsRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    questionCount: row.question_count ? Number(row.question_count) : 0,
    startAt: row.start_at instanceof Date ? row.start_at.toISOString() : null,
    endAt: row.end_at instanceof Date ? row.end_at.toISOString() : null,
    frequencyMonths: row.frequency_months !== null && row.frequency_months !== undefined
      ? Number(row.frequency_months)
      : null,
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : null,
    updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : null
  };
}

async function getAssessmentSettings(connection) {
  const existing = await queryOne(
    `SELECT id, question_count, start_at, end_at, frequency_months, created_at, updated_at
     FROM assessment_settings
     ORDER BY id ASC
     LIMIT 1`,
    [],
    connection
  );

  if (existing) {
    return mapAssessmentSettingsRow(existing);
  }

  await execute(
    `INSERT INTO assessment_settings (question_count, start_at, end_at, frequency_months)
     VALUES (?, ?, ?, ?)`,
    [60, null, null, null],
    connection
  );

  const created = await queryOne(
    `SELECT id, question_count, start_at, end_at, frequency_months, created_at, updated_at
     FROM assessment_settings
     ORDER BY id ASC
     LIMIT 1`,
    [],
    connection
  );

  return mapAssessmentSettingsRow(created);
}

function parseJsonField(value, fallback) {
  if (value === null || value === undefined || value === '') return fallback;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch (error) {
    console.warn('Failed to parse JSON field', error);
    return fallback;
  }
}

function mapAssessmentRoundRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    title: row.title ?? null,
    category: row.category ?? null,
    description: row.description ?? null,
    questionCount: row.question_count ? Number(row.question_count) : 0,
    passingScore: row.passing_score !== null && row.passing_score !== undefined
      ? Number(row.passing_score)
      : 0,
    durationMinutes: row.duration_minutes !== null && row.duration_minutes !== undefined
      ? Number(row.duration_minutes)
      : 0,
    showScore: row.show_score !== undefined ? Boolean(row.show_score) : false,
    showAnswers: row.show_answers !== undefined ? Boolean(row.show_answers) : false,
    showBreakdown: row.show_breakdown !== undefined ? Boolean(row.show_breakdown) : false,
    subcategoryQuotas: parseJsonField(row.subcategory_quotas, null),
    difficultyWeights: parseJsonField(row.difficulty_weights, null),
    criteria: parseJsonField(row.criteria, null),
    status: row.status ?? null,
    active: row.active !== undefined ? Boolean(row.active) : false,
    history: parseJsonField(row.history, null),
    createdBy: row.created_by ?? null,
    updatedBy: row.updated_by ?? null,
    frequencyMonths: row.frequency_months !== null && row.frequency_months !== undefined
      ? Number(row.frequency_months)
      : null,
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : null,
    updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : null
  };
}

function sanitizeAssessmentRoundPayload(payload) {
  return {
    title: toNullableString(payload.title),
    category: toNullableString(payload.category),
    description: toNullableString(payload.description),
    questionCount: Number(payload.questionCount) || 0,
    passingScore: payload.passingScore === null || payload.passingScore === undefined
      ? 60
      : Number(payload.passingScore),
    durationMinutes: payload.durationMinutes === null || payload.durationMinutes === undefined
      ? 60
      : Number(payload.durationMinutes),
    showScore: payload.showScore !== false,
    showAnswers: payload.showAnswers === true,
    showBreakdown: payload.showBreakdown !== false,
    subcategoryQuotas: payload.subcategoryQuotas ?? {},
    difficultyWeights: payload.difficultyWeights ?? { easy: 0, medium: 0, hard: 0 },
    criteria: payload.criteria ?? { level1: 60, level2: 70, level3: 80 },
    status: toNullableString(payload.status) || 'draft',
    active: payload.active === undefined ? true : Boolean(payload.active),
    frequencyMonths: payload.frequencyMonths === null || payload.frequencyMonths === undefined
      ? null
      : Number(payload.frequencyMonths)
  };
}

const ASSESSMENT_ROUND_HISTORY_FIELDS = [
  { key: 'title', label: 'ชื่อกิจกรรม' },
  { key: 'category', label: 'ประเภทช่าง' },
  { key: 'description', label: 'รายละเอียด' },
  { key: 'questionCount', label: 'จำนวนข้อ' },
  { key: 'passingScore', label: 'คะแนนผ่าน' },
  { key: 'durationMinutes', label: 'เวลาทำข้อสอบ' },
  { key: 'showScore', label: 'แสดงคะแนน' },
  { key: 'showAnswers', label: 'แสดงเฉลย' },
  { key: 'showBreakdown', label: 'แยกผลตามหมวด' },
  { key: 'subcategoryQuotas', label: 'สัดส่วนหมวดหมู่ย่อย' },
  { key: 'difficultyWeights', label: 'น้ำหนักความยาก' },
  { key: 'criteria', label: 'เกณฑ์คะแนน' },
  { key: 'status', label: 'สถานะ' },
  { key: 'active', label: 'เปิดใช้งาน' },
  { key: 'frequencyMonths', label: 'รอบการสอบ (เดือน)' }
];

function buildAssessmentRoundComparable(value) {
  if (value === undefined || value === null) return null;
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  return value;
}

function buildAssessmentRoundHistoryChanges(previous, next) {
  const changes = [];
  ASSESSMENT_ROUND_HISTORY_FIELDS.forEach(field => {
    const prevVal = previous ? previous[field.key] : null;
    const nextVal = next ? next[field.key] : null;
    if (buildAssessmentRoundComparable(prevVal) !== buildAssessmentRoundComparable(nextVal)) {
      changes.push({ field: field.label, from: prevVal ?? null, to: nextVal ?? null });
    }
  });
  return changes;
}

function buildAssessmentRoundHistoryEntry(action, userId, changes) {
  return {
    action,
    user: userId || 'system',
    timestamp: new Date().toISOString(),
    changes: Array.isArray(changes) ? changes : []
  };
}

function appendAssessmentRoundHistory(currentHistory, entry, limit = 50) {
  const base = Array.isArray(currentHistory) ? [...currentHistory] : [];
  base.push(entry);
  if (base.length > limit) {
    return base.slice(base.length - limit);
  }
  return base;
}

function buildAssessmentRoundSnapshot(payload) {
  return {
    title: payload.title,
    category: payload.category,
    description: payload.description,
    questionCount: payload.questionCount,
    passingScore: payload.passingScore,
    durationMinutes: payload.durationMinutes,
    showScore: payload.showScore,
    showAnswers: payload.showAnswers,
    showBreakdown: payload.showBreakdown,
    subcategoryQuotas: payload.subcategoryQuotas,
    difficultyWeights: payload.difficultyWeights,
    criteria: payload.criteria,
    status: payload.status,
    active: payload.active,
    frequencyMonths: payload.frequencyMonths
  };
}

async function fetchAssessmentRoundById(roundId, connection) {
  const row = await queryOne(
    `SELECT id, title, category, description, question_count, passing_score, duration_minutes,
            show_score, show_answers, show_breakdown,
            subcategory_quotas, difficulty_weights, criteria,
            status, active, history,
          frequency_months, created_by, updated_by, created_at, updated_at
     FROM assessment_rounds
     WHERE id = ?
     LIMIT 1`,
    [roundId],
    connection
  );
  return mapAssessmentRoundRow(row);
}

async function fetchAssessmentRounds(connection) {
  const rows = await query(
        `SELECT id, title, category, description, question_count, passing_score, duration_minutes,
          show_score, show_answers, show_breakdown,
          subcategory_quotas, difficulty_weights, criteria,
          status, active, history,
          frequency_months, created_by, updated_by, created_at, updated_at
         FROM assessment_rounds
         ORDER BY updated_at DESC, created_at DESC`,
    [],
    connection
  );
  return rows.map(mapAssessmentRoundRow).filter(Boolean);
}

// ---------------------------------------------------------------------------
// Assessment settings & rounds
// ---------------------------------------------------------------------------

app.get('/api/admin/assessments/settings', requireAuth, authorizeRoles('admin'), async (_req, res) => {
  try {
    await ensureAssessmentSchemaReady();
    const settings = await withTransaction(async connection => getAssessmentSettings(connection));
    res.json(settings);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

app.put('/api/admin/assessments/settings', requireAuth, authorizeRoles('admin'), async (req, res) => {
  try {
    await ensureAssessmentSchemaReady();
    const payload = assessmentSettingsSchema.parse(req.body ?? {});

    const startDate = parseDateTimeInput(payload.startAt ?? null);
    const endDate = parseDateTimeInput(payload.endAt ?? null);
    const frequencyMonths = payload.frequencyMonths ?? null;

    if (payload.startAt && !startDate) {
      return res.status(400).json({ message: 'invalid_start_at' });
    }
    if (payload.endAt && !endDate) {
      return res.status(400).json({ message: 'invalid_end_at' });
    }
    if (startDate && endDate && endDate <= startDate) {
      return res.status(400).json({ message: 'end_before_start' });
    }

    const updated = await withTransaction(async connection => {
      const current = await getAssessmentSettings(connection);
      if (!current) {
        throw new Error('settings_unavailable');
      }

      await execute(
        `UPDATE assessment_settings
         SET question_count = ?, start_at = ?, end_at = ?, frequency_months = ?, updated_at = NOW(6)
         WHERE id = ?`,
        [
          payload.questionCount,
          startDate,
          endDate,
          frequencyMonths,
          current.id
        ],
        connection
      );

      return getAssessmentSettings(connection);
    });

    res.json(updated);
  } catch (error) {
    if (error?.issues) {
      return res.status(400).json({ message: 'Invalid input', errors: error.issues });
    }
    if (error?.message === 'settings_unavailable') {
      return res.status(500).json({ message: 'settings_unavailable' });
    }
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

app.get('/api/admin/assessments/rounds', requireAuth, authorizeRoles('admin'), async (_req, res) => {
  try {
    await ensureAssessmentSchemaReady();
    const items = await fetchAssessmentRounds();
    res.json({ items });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

app.get('/api/admin/assessments/rounds/:id', requireAuth, authorizeRoles('admin'), async (req, res) => {
  try {
    await ensureAssessmentSchemaReady();
    const roundId = req.params.id;
    if (!uuidSchema.safeParse(roundId).success) {
      return res.status(400).json({ message: 'invalid_id' });
    }

    const round = await fetchAssessmentRoundById(roundId);
    if (!round) {
      return res.status(404).json({ message: 'not_found' });
    }

    res.json(round);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

app.post('/api/admin/assessments/rounds', requireAuth, authorizeRoles('admin'), async (req, res) => {
  try {
    await ensureAssessmentSchemaReady();
    const payload = assessmentRoundUpsertSchema.parse(req.body ?? {});
    const sanitized = sanitizeAssessmentRoundPayload(payload);

    if (!sanitized.title) {
      return res.status(400).json({ message: 'invalid_title' });
    }

    const roundId = randomUUID();
    const snapshot = buildAssessmentRoundSnapshot(sanitized);
    const historyEntry = buildAssessmentRoundHistoryEntry(
      'สร้างกิจกรรมข้อสอบ',
      req.user?.id || null,
      buildAssessmentRoundHistoryChanges(null, snapshot)
    );
    const history = appendAssessmentRoundHistory([], historyEntry);
    await execute(
      `INSERT INTO assessment_rounds (
         id, title, category, description, question_count, passing_score, duration_minutes,
         show_score, show_answers, show_breakdown,
         subcategory_quotas, difficulty_weights, criteria,
         status, active, frequency_months, history, created_by, updated_by
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      , [
        roundId,
        sanitized.title,
        sanitized.category,
        sanitized.description,
        sanitized.questionCount,
        sanitized.passingScore,
        sanitized.durationMinutes,
        sanitized.showScore ? 1 : 0,
        sanitized.showAnswers ? 1 : 0,
        sanitized.showBreakdown ? 1 : 0,
        JSON.stringify(sanitized.subcategoryQuotas),
        JSON.stringify(sanitized.difficultyWeights),
        JSON.stringify(sanitized.criteria),
        sanitized.status,
        sanitized.active ? 1 : 0,
        sanitized.frequencyMonths,
        JSON.stringify(history),
        req.user?.id || null,
        req.user?.id || null
      ]
    );

    const created = await fetchAssessmentRoundById(roundId);
    res.status(201).json(created);
  } catch (error) {
    if (error?.issues) {
      return res.status(400).json({ message: 'Invalid input', errors: error.issues });
    }
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

app.put('/api/admin/assessments/rounds/:id', requireAuth, authorizeRoles('admin'), async (req, res) => {
  try {
    await ensureAssessmentSchemaReady();
    const roundId = req.params.id;
    if (!uuidSchema.safeParse(roundId).success) {
      return res.status(400).json({ message: 'invalid_id' });
    }

    const existing = await fetchAssessmentRoundById(roundId);
    if (!existing) {
      return res.status(404).json({ message: 'not_found' });
    }

    const payload = assessmentRoundUpsertSchema.parse(req.body ?? {});
    const sanitized = sanitizeAssessmentRoundPayload(payload);

    if (!sanitized.title) {
      return res.status(400).json({ message: 'invalid_title' });
    }

    const snapshot = buildAssessmentRoundSnapshot(sanitized);
    const changes = buildAssessmentRoundHistoryChanges(existing, snapshot);
    const historyEntry = buildAssessmentRoundHistoryEntry(
      changes.length ? 'แก้ไขโครงสร้างข้อสอบ' : 'บันทึกโครงสร้างข้อสอบ',
      req.user?.id || null,
      changes
    );
    const nextHistory = appendAssessmentRoundHistory(existing.history, historyEntry);

    await execute(
      `UPDATE assessment_rounds
       SET title = ?, category = ?, description = ?, question_count = ?, passing_score = ?, duration_minutes = ?,
           show_score = ?, show_answers = ?, show_breakdown = ?,
           subcategory_quotas = ?, difficulty_weights = ?, criteria = ?,
           status = ?, active = ?, frequency_months = ?, history = ?,
           created_by = COALESCE(created_by, ?), updated_by = ?, updated_at = NOW(6)
       WHERE id = ?`,
      [
        sanitized.title,
        sanitized.category,
        sanitized.description,
        sanitized.questionCount,
        sanitized.passingScore,
        sanitized.durationMinutes,
        sanitized.showScore ? 1 : 0,
        sanitized.showAnswers ? 1 : 0,
        sanitized.showBreakdown ? 1 : 0,
        JSON.stringify(sanitized.subcategoryQuotas),
        JSON.stringify(sanitized.difficultyWeights),
        JSON.stringify(sanitized.criteria),
        sanitized.status,
        sanitized.active ? 1 : 0,
        sanitized.frequencyMonths,
        JSON.stringify(nextHistory),
        req.user?.id || null,
        req.user?.id || null,
        roundId
      ]
    );

    const updated = await fetchAssessmentRoundById(roundId);
    res.json(updated);
  } catch (error) {
    if (error?.issues) {
      return res.status(400).json({ message: 'Invalid input', errors: error.issues });
    }
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

app.delete('/api/admin/assessments/rounds/:id', requireAuth, authorizeRoles('admin'), async (req, res) => {
  try {
    await ensureAssessmentSchemaReady();
    const roundId = req.params.id;
    if (!uuidSchema.safeParse(roundId).success) {
      return res.status(400).json({ message: 'invalid_id' });
    }

    const result = await execute('DELETE FROM assessment_rounds WHERE id = ?', [roundId]);
    if (!result.affectedRows) {
      return res.status(404).json({ message: 'not_found' });
    }

    res.status(204).send();
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// ---------------------------------------------------------------------------
// Structural Question API (Legacy Table Support)
// ---------------------------------------------------------------------------

app.get('/api/question-structural/all', requireAuth, authorizeRoles('admin'), async (_req, res) => {
  try {
    // Note: 'question_Structural' table structure based on user's DB
    const rows = await query(
      `SELECT * FROM question_Structural ORDER BY id ASC`,
      []
    );
    res.json(rows);
  } catch (error) {
    console.error('[question-structural] Failed to fetch questions', error);
    // If table doesn't exist, return empty array instead of 500 to avoid breaking UI
    if (error?.code === 'ER_NO_SUCH_TABLE') {
      return res.json([]);
    }
    res.status(500).json({ message: 'Server error' });
  }
});

// ---------------------------------------------------------------------------
// Worker structural questions (session-based)
// ---------------------------------------------------------------------------

async function handleStructuralQuestions(req, res, { forcedRoundId = null } = {}) {
  try {
    await ensureAssessmentSchemaReady();
    await ensureAssessmentSessionSchemaReady();

    const setNo = parseInt(req.query.set_no, 10) || 1;
    const pageParam = parseInt(req.query.page, 10);
    const perPageParam = parseInt(req.query.per_page, 10);
    const page = Number.isFinite(pageParam) && pageParam > 0 ? pageParam : 1;
    const perPageRequest = Number.isFinite(perPageParam) && perPageParam > 0 ? perPageParam : null;
    const sessionId = typeof req.query.sessionId === 'string' ? req.query.sessionId.trim() : '';
    const workerId = parseWorkerId(req.query.workerId);
    const userId = typeof req.query.userId === 'string' ? req.query.userId.trim() : null;
    const forcedRound = forcedRoundId ? String(forcedRoundId).trim() : null;
    const requestedRoundId = forcedRound || (typeof req.query.roundId === 'string' ? req.query.roundId.trim() : null);

    let session = null;
    let roundMeta = null;

    if (!sessionId) {
      let roundId = requestedRoundId || null;
      if (!roundId) {
        const roundRows = await query(
          `SELECT id
             FROM assessment_rounds
            WHERE category = 'structure'
            ORDER BY created_at DESC
            LIMIT 1`,
          []
        );
        roundId = roundRows[0]?.id || null;
      }

      if (!roundId) {
        return res.status(409).json({ error: 'No assessment round found for structure' });
      }

      roundMeta = await fetchAssessmentRoundById(roundId);
      if (!roundMeta && forcedRound) {
        return res.status(404).json({ error: 'Round not found' });
      }

      const difficultyParamRaw = req.query.difficulty_level ?? req.query.level ?? req.query.difficulty;
      const parsedDifficulty = Number.isFinite(Number(difficultyParamRaw))
        ? Number(difficultyParamRaw)
        : null;
      const difficultyMap = { easy: 1, medium: 2, hard: 3 };
      const normalizedDifficultyKey = typeof difficultyParamRaw === 'string'
        ? difficultyParamRaw.trim().toLowerCase()
        : '';
      const difficultyFromQuery = parsedDifficulty
        ? parsedDifficulty
        : (difficultyMap[normalizedDifficultyKey] || null);

      let difficultyFromRound = null;
      if (roundMeta?.difficultyWeights && typeof roundMeta.difficultyWeights === 'object') {
        const weights = roundMeta.difficultyWeights;
        const activeKeys = Object.keys(difficultyMap)
          .filter(key => Number(weights?.[key]) > 0);
        if (activeKeys.length === 1) {
          difficultyFromRound = difficultyMap[activeKeys[0]] || null;
        }
      }

      const selectedDifficulty = difficultyFromQuery || difficultyFromRound;

      let rows;
      const buildQuestionQuery = (includeSetNo) => {
        const filters = [];
        const params = [];
        if (includeSetNo) {
          filters.push('set_no = ?');
          params.push(setNo);
        }
        if (selectedDifficulty) {
          filters.push('difficulty_level = ?');
          params.push(selectedDifficulty);
        }
        const whereSql = filters.length ? ` WHERE ${filters.join(' AND ')}` : '';
        return {
          sql: `SELECT id FROM question_Structural${whereSql} ORDER BY RAND() LIMIT 60`,
          params
        };
      };

      try {
        const queryWithSet = buildQuestionQuery(true);
        rows = await query(queryWithSet.sql, queryWithSet.params);
      } catch (error) {
        if (error?.code === 'ER_BAD_FIELD_ERROR') {
          const queryWithoutSet = buildQuestionQuery(false);
          rows = await query(queryWithoutSet.sql, queryWithoutSet.params);
        } else {
          throw error;
        }
      }

      if (!rows.length) {
        return res.status(404).json({ error: 'No questions found for requested criteria' });
      }

      const qids = rows.map(row => row.id);
      let questionLimit = null;
      if (roundMeta?.questionCount) {
        const parsedLimit = Number(roundMeta.questionCount);
        if (Number.isFinite(parsedLimit) && parsedLimit > 0) {
          questionLimit = parsedLimit;
        }
      }

      const finalLimit = questionLimit || 60;
      const perPage = perPageRequest || finalLimit;
      const limitedIds = qids.slice(0, finalLimit);

      const newSessionId = randomUUID();
      await withTransaction(async connection => {
        await execute(
          `INSERT INTO assessment_sessions
             (id, round_id, worker_id, user_id, status, question_count, source)
           VALUES (?, ?, ?, ?, 'in_progress', ?, 'question_Structural')`,
          [newSessionId, roundId, workerId, userId, limitedIds.length],
          connection
        );

        const values = limitedIds.map((qid, index) => [newSessionId, String(qid), index + 1, 'question_Structural']);
        const placeholders = values.map(() => '(?, ?, ?, ?)').join(', ');
        await execute(
          `INSERT INTO assessment_session_questions (session_id, question_id, display_order, source_table)
           VALUES ${placeholders}`,
          values.flat(),
          connection
        );
      });

      session = { id: newSessionId, question_ids: limitedIds };
      session.perPage = perPage;
    } else {
      const sessRows = await query(
        'SELECT id, round_id FROM assessment_sessions WHERE id = ? LIMIT 1',
        [sessionId]
      );
      if (!sessRows.length) return res.status(404).json({ error: 'Session not found' });

      roundMeta = await fetchAssessmentRoundById(sessRows[0].round_id);

      const qidRows = await query(
        `SELECT question_id
           FROM assessment_session_questions
          WHERE session_id = ?
          ORDER BY display_order ASC`,
        [sessionId]
      );

      const qids = qidRows.map(row => row.question_id);
      session = { id: sessionId, question_ids: qids };

      await execute(
        'UPDATE assessment_sessions SET last_seen_at = NOW(6) WHERE id = ? LIMIT 1',
        [sessionId]
      );
    }

    const total = session.question_ids.length;
    const perPage = session.perPage || perPageRequest || total;
    const totalPages = Math.max(1, Math.ceil(total / perPage));
    const pageIndex = Math.min(totalPages, page) - 1;
    const start = pageIndex * perPage;
    const end = Math.min(total, start + perPage);
    const pageIds = session.question_ids.slice(start, end);

    if (!pageIds.length) {
      return res.json({
        sessionId: session.id,
        page,
        per_page: perPage,
        total,
        totalPages,
        questions: []
      });
    }

    const placeholders = pageIds.map(() => '?').join(',');
    const qrows = await query(
      `SELECT id, question_text, choice_a, choice_b, choice_c, choice_d
         FROM question_Structural WHERE id IN (${placeholders})`,
      pageIds
    );

    const qmap = {};
    qrows.forEach(row => { qmap[row.id] = row; });

    const questions = pageIds.map((id, idx) => {
      const row = qmap[id];
      if (!row) return null;
      return {
        id: row.id,
        question_no: start + idx + 1,
        text: row.question_text,
        choices: [row.choice_a, row.choice_b, row.choice_c, row.choice_d]
      };
    }).filter(Boolean);

    res.json({
      sessionId: session.id,
      page,
      per_page: perPage,
      total,
      totalPages,
      questions,
      round: roundMeta
    });
  } catch (error) {
    console.error('GET /api/questions/structural error:', error);
    res.status(500).json({ error: 'Server error' });
  }
}

app.get('/api/questions/structural', async (req, res) => {
  return handleStructuralQuestions(req, res);
});

app.get('/api/worker/assessments/rounds/:id/questions', async (req, res) => {
  return handleStructuralQuestions(req, res, { forcedRoundId: req.params.id });
});

// ---------------------------------------------------------------------------
// Worker assessment summary & submit
// ---------------------------------------------------------------------------

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

async function fetchWorkerAssessmentSummary(workerId, category = null) {
  await ensureAssessmentResultSchemaReady();
  const params = [workerId];
  let whereClause = 'WHERE r.worker_id = ?';
  if (category) {
    whereClause += ' AND r.category = ?';
    params.push(category);
  }
  const row = await queryOne(
    `SELECT r.id, r.worker_id, r.round_id, r.session_id, r.category,
            r.total_score, r.total_questions, r.passed, r.breakdown, r.finished_at,
            ar.passing_score AS round_passing_score, ar.question_count AS round_question_count
       FROM worker_assessment_results r
       LEFT JOIN assessment_rounds ar ON ar.id = r.round_id
      ${whereClause}
      ORDER BY r.finished_at DESC
      LIMIT 1`,
    params
  );
  if (!row) return null;
  let breakdown = null;
  if (row.breakdown) {
    try {
      breakdown = typeof row.breakdown === 'string' ? JSON.parse(row.breakdown) : row.breakdown;
    } catch (error) {
      breakdown = null;
    }
  }
  const totalQuestions = Number(row.total_questions) || 0;
  const passingScorePctRaw = row.round_passing_score;
  const passingScorePct = passingScorePctRaw === null || passingScorePctRaw === undefined
    ? 70
    : Number(passingScorePctRaw);
  const requiredCorrect = totalQuestions > 0
    ? Math.ceil(totalQuestions * (passingScorePct / 100))
    : 0;

  const derivedPassed = totalQuestions > 0 ? (Number(row.total_score) || 0) >= requiredCorrect : false;

  return {
    id: row.id,
    workerId: row.worker_id,
    roundId: row.round_id,
    sessionId: row.session_id,
    category: row.category,
    score: Number(row.total_score) || 0,
    totalQuestions,
    passed: derivedPassed,
    passingScorePct,
    requiredCorrect,
    breakdown: Array.isArray(breakdown) ? breakdown : [],
    finishedAt: row.finished_at
  };
}

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
    return res.json({ success: true, result: summary });
  } catch (error) {
    console.error('GET /api/worker/assessment/summary error:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.get('/api/worker/assessments/rounds', async (req, res) => {
  try {
    const category = typeof req.query.category === 'string' ? req.query.category.trim() : '';
    const rounds = await fetchAssessmentRounds();
    const filtered = rounds.filter(round => {
      if (category && round.category !== category) return false;
      if (round.status && String(round.status).toLowerCase() !== 'active') return false;
      if (round.active !== undefined && round.active !== null) {
        return Boolean(round.active);
      }
      return true;
    });
    return res.json(filtered);
  } catch (error) {
    console.error('GET /api/worker/assessments/rounds error:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

async function submitWorkerAssessment({ req, userId, sessionId, answers, expectedRoundId = null }) {
  await ensureAssessmentSchemaReady();
  await ensureAssessmentSessionSchemaReady();
  await ensureAssessmentResultSchemaReady();

  const workerId = parseWorkerId(userId);
  if (!sessionId) {
    throw { status: 400, body: { success: false, message: 'missing_session' } };
  }

  const sessionRows = await query(
    'SELECT id, worker_id, round_id, status, question_count FROM assessment_sessions WHERE id = ? LIMIT 1',
    [sessionId]
  );
  const session = sessionRows?.[0];
  if (!session) {
    throw { status: 404, body: { success: false, message: 'session_not_found' } };
  }
  if (expectedRoundId && String(session.round_id) !== String(expectedRoundId)) {
    throw { status: 409, body: { success: false, message: 'round_mismatch' } };
  }
  if (workerId && session.worker_id && Number(session.worker_id) !== workerId) {
    console.warn(
      `Session mismatch on submit: session.worker_id=${session.worker_id} providedWorkerId=${workerId} sessionId=${sessionId} ip=${getRequestIp(req)}`
    );
    throw {
      status: 403,
      body: {
        success: false,
        message: 'session_mismatch',
        expectedWorkerId: Number(session.worker_id),
        providedWorkerId: workerId
      }
    };
  }
  const resolvedWorkerId = workerId || Number(session.worker_id) || null;
  if (!resolvedWorkerId) {
    throw { status: 400, body: { success: false, message: 'missing_worker' } };
  }

  const roundRows = await query(
    'SELECT id, category, passing_score FROM assessment_rounds WHERE id = ? LIMIT 1',
    [session.round_id]
  );
  const round = roundRows?.[0] || null;
  const category = round?.category || 'structure';

  const existing = await fetchWorkerAssessmentSummary(resolvedWorkerId, category);
  if (existing) {
    await writeAuditLog({
      req,
      username: String(resolvedWorkerId),
      role: 'worker',
      action: 'assessment_submit_duplicate',
      details: { workerId: resolvedWorkerId, sessionId, category },
      status: 'warning'
    });
    throw { status: 409, body: { success: false, message: 'already_completed', result: existing } };
  }

  const questionRows = await query(
    'SELECT question_id FROM assessment_session_questions WHERE session_id = ? ORDER BY display_order ASC',
    [sessionId]
  );
  const questionIds = questionRows.map(row => Number(row.question_id)).filter(id => Number.isFinite(id));
  if (!questionIds.length) {
    throw { status: 404, body: { success: false, message: 'no_questions' } };
  }

  const placeholders = questionIds.map(() => '?').join(',');
  let answerRows = [];
  try {
    answerRows = await query(
      `SELECT id, answer, category
         FROM question_Structural
        WHERE id IN (${placeholders})`,
      questionIds
    );
  } catch (error) {
    if (error?.code === 'ER_BAD_FIELD_ERROR') {
      answerRows = await query(
        `SELECT id, answer
           FROM question_Structural
          WHERE id IN (${placeholders})`,
        questionIds
      );
    } else {
      throw error;
    }
  }

  const normalizedAnswers = Array.isArray(answers)
    ? answers.reduce((acc, item) => {
        const questionId = item?.questionId ?? item?.question_id;
        if (questionId === undefined || questionId === null) return acc;
        acc[String(questionId)] = item?.answer ?? item?.choice ?? item?.selected ?? null;
        return acc;
      }, {})
    : (answers || {});

  const answerMap = new Map();
  answerRows.forEach(row => {
    answerMap.set(String(row.id), {
      answer: String(row.answer || '').toLowerCase(),
      category: row.category || 'structure'
    });
  });

  const breakdownByCategory = new Map();
  let totalScore = 0;
  questionIds.forEach(qid => {
    const key = String(qid);
    const meta = answerMap.get(key);
    if (!meta) return;
    const selected = normalizedAnswers ? toAnswerKey(normalizedAnswers[key]) : null;
    const isCorrect = selected && selected === meta.answer;
    if (isCorrect) totalScore += 1;
    const bucket = breakdownByCategory.get(meta.category) || { correct: 0, total: 0 };
    bucket.total += 1;
    if (isCorrect) bucket.correct += 1;
    breakdownByCategory.set(meta.category, bucket);
  });

  const totalQuestions = Number(session.question_count) || questionIds.length;
  const breakdown = Array.from(breakdownByCategory.entries()).map(([label, stats]) => ({
    label: String(label || 'General'),
    correct: Number(stats.correct || 0),
    total: Number(stats.total || 0),
    percentage: stats.total ? Math.round((stats.correct / stats.total) * 100) : 0
  }));

  const passingScorePctRaw = round?.passing_score;
  const passingScorePct = (passingScorePctRaw === null || passingScorePctRaw === undefined)
    ? 70
    : Number(passingScorePctRaw);
  
  const requiredCorrect = totalQuestions > 0
    ? Math.ceil(totalQuestions * (passingScorePct / 100))
    : 0;
  
  const finalScore = Number.isFinite(totalScore) ? totalScore : 0;
  const passed = finalScore >= requiredCorrect;

  const resultId = randomUUID();
  const breakdownJson = JSON.stringify(breakdown);

  try {
    await execute(
      `INSERT INTO worker_assessment_results
        (id, worker_id, round_id, session_id, category, total_score, total_questions, passed, breakdown, finished_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(6))`,
      [
        resultId,
        resolvedWorkerId,
        session.round_id,
        sessionId,
        category,
        finalScore,
        totalQuestions,
        passed ? 1 : 0,
        breakdownJson
      ]
    );
  } catch (insertError) {
    if (insertError.code === 'ER_DUP_ENTRY') {
      const existingRefetch = await fetchWorkerAssessmentSummary(resolvedWorkerId, category);
      if (existingRefetch) {
        throw { status: 409, body: { success: false, message: 'already_completed', result: existingRefetch } };
      }
    }
    console.error('[submit] Database insert failed:', insertError);
    throw new Error(`Failed to save assessment results: ${insertError.message}`);
  }

  try {
    await execute(
      'UPDATE assessment_sessions SET status = ?, finished_at = NOW(6) WHERE id = ? LIMIT 1',
      ['completed', sessionId]
    );
  } catch (updateError) {
    console.warn('[submit] Session update failed (non-critical):', updateError);
  }

  await writeAuditLog({
    req,
    username: String(resolvedWorkerId),
    role: 'worker',
    action: 'assessment_submit',
    details: { workerId: resolvedWorkerId, sessionId, category, score: finalScore, totalQuestions },
    status: 'success'
  });

  return {
    id: resultId,
    workerId: resolvedWorkerId,
    roundId: session.round_id,
    sessionId,
    category,
    score: finalScore,
    totalQuestions,
    passed,
    passingScorePct,
    requiredCorrect,
    breakdown,
    finishedAt: new Date().toISOString()
  };
}

app.post('/api/worker/score', async (req, res) => {
  try {
    const result = await submitWorkerAssessment({
      req,
      userId: req.body?.userId,
      sessionId: req.body?.sessionId,
      answers: req.body?.answers
    });
    return res.json({ success: true, result });
  } catch (error) {
    console.error('POST /api/worker/score error:', error);
    
    // Attempt detailed audit log even on failure
    try {
      await writeAuditLog({
        req,
        username: String(req.body?.userId || 'unknown'),
        role: 'worker',
        action: 'assessment_submit_failed',
        details: { 
          message: error?.message || (typeof error === 'string' ? error : 'Internal server error'),
          sessionId: req.body?.sessionId,
          stack: error?.stack 
        },
        status: 'error'
      });
    } catch (logErr) {
      console.error('Failed to write failure audit log:', logErr);
    }

    if (error?.status && error?.body) {
      return res.status(error.status).json(error.body);
    }
    return res.status(500).json({ 
      success: false, 
      message: 'Server error', 
      debug: error?.message || 'Unexpected error',
      stack: process.env.NODE_ENV === 'development' ? error?.stack : undefined
    });
  }
});

app.post('/api/worker/assessments/rounds/:id/submit', async (req, res) => {
  try {
    const result = await submitWorkerAssessment({
      req,
      userId: req.body?.workerId ?? req.body?.userId,
      sessionId: req.body?.sessionId,
      answers: req.body?.answers,
      expectedRoundId: req.params.id
    });
    return res.json({ success: true, result });
  } catch (error) {
    if (error?.status && error?.body) {
      return res.status(error.status).json(error.body);
    }
    console.error('POST /api/worker/assessments/rounds/:id/submit error:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ---------------------------------------------------------------------------
// Manage question API (legacy structure)
// ---------------------------------------------------------------------------

app.get('/api/managequestion/all', requireAuth, authorizeRoles('admin'), async (_req, res) => {
  try {
    await ensureManageQuestionSchemaReady();
    const items = await fetchManageQuestions();
    res.json(items);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

app.post('/api/managequestion/add', requireAuth, authorizeRoles('admin'), async (req, res) => {
  try {
    await ensureManageQuestionSchemaReady();
    const rawPayload = Array.isArray(req.body) ? req.body : [req.body];
    const payload = manageQuestionBulkCreateSchema.parse(rawPayload);

    const createdItems = await withTransaction(async connection => {
      const placeholders = payload.map(() => '(?, ?, ?, ?, ?, ?, ?, ?)').join(', ');
      const values = [];
      payload.forEach(item => {
        values.push(
          item.question_text,
          item.choice_a,
          item.choice_b,
          item.choice_c,
          item.choice_d,
          item.answer,
          item.difficulty_level ?? null,
          item.skill_type ?? null
        );
      });

      const insertSql = `
        INSERT INTO manage_questions (question_text, choice_a, choice_b, choice_c, choice_d, answer, difficulty_level, skill_type)
        VALUES ${placeholders}
      `;

      const insertResult = await execute(insertSql, values, connection);
      const affected = Number(insertResult.affectedRows || 0);
      if (!affected) {
        return [];
      }

      const firstId = Number(insertResult.insertId || 0);
      const idList = [];
      for (let index = 0; index < affected; index += 1) {
        idList.push(firstId + index);
      }

      const rows = await query(
        `SELECT id, question_text, choice_a, choice_b, choice_c, choice_d, answer, difficulty_level, skill_type, created_at, updated_at
         FROM manage_questions
         WHERE id IN (${idList.map(() => '?').join(',')})
         ORDER BY id ASC`,
        idList,
        connection
      );

      return rows.map(mapManageQuestionRow).filter(Boolean);
    });

    res.status(201).json({ items: createdItems });
  } catch (error) {
    if (error?.issues) {
      return res.status(400).json({ message: 'Invalid input', errors: error.issues });
    }
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

app.put('/api/managequestion/update/:id', requireAuth, authorizeRoles('admin'), async (req, res) => {
  try {
    await ensureManageQuestionSchemaReady();
    const questionIdRaw = req.params.id;
    const questionId = Number.parseInt(questionIdRaw, 10);
    if (!Number.isFinite(questionId) || questionId <= 0) {
      return res.status(400).json({ message: 'invalid_id' });
    }

    const payload = manageQuestionUpdateSchema.parse(req.body ?? {});
    const updateData = {};
    if (payload.question_text !== undefined) updateData.question_text = payload.question_text;
    if (payload.choice_a !== undefined) updateData.choice_a = payload.choice_a;
    if (payload.choice_b !== undefined) updateData.choice_b = payload.choice_b;
    if (payload.choice_c !== undefined) updateData.choice_c = payload.choice_c;
    if (payload.choice_d !== undefined) updateData.choice_d = payload.choice_d;
    if (payload.answer !== undefined) updateData.answer = payload.answer;
    if (payload.difficulty_level !== undefined) updateData.difficulty_level = payload.difficulty_level ?? null;
    if (payload.skill_type !== undefined) updateData.skill_type = payload.skill_type ?? null;

    const clause = buildUpdateClause(updateData);
    if (!clause.sets.length) {
      return res.status(400).json({ message: 'no_fields_to_update' });
    }

    const updateSql = `
      UPDATE manage_questions
      SET ${clause.sets.join(', ')}, updated_at = NOW(6)
      WHERE id = ?
      LIMIT 1
    `;

    const result = await execute(updateSql, [...clause.values, questionId]);
    if (!result.affectedRows) {
      return res.status(404).json({ message: 'not_found' });
    }

    const updated = await fetchManageQuestionById(questionId);
    res.json(updated);
  } catch (error) {
    if (error?.issues) {
      return res.status(400).json({ message: 'Invalid input', errors: error.issues });
    }
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

app.delete('/api/managequestion/delete/:id', requireAuth, authorizeRoles('admin'), async (req, res) => {
  try {
    await ensureManageQuestionSchemaReady();
    const questionIdRaw = req.params.id;
    const questionId = Number.parseInt(questionIdRaw, 10);
    if (!Number.isFinite(questionId) || questionId <= 0) {
      return res.status(400).json({ message: 'invalid_id' });
    }

    const result = await execute('DELETE FROM manage_questions WHERE id = ? LIMIT 1', [questionId]);
    if (!result.affectedRows) {
      return res.status(404).json({ message: 'not_found' });
    }

    res.json({ message: 'Question deleted successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// ---------------------------------------------------------------------------
// Question bank
// ---------------------------------------------------------------------------
const questionOptionSchema = z.object({
  text: z.string().min(1),
  is_correct: z.boolean().default(false)
});

const createQuestionSchema = z.object({
  text: z.string().min(1),
  category: z.string().max(80).optional(),
  difficulty: z.string().max(40).optional(),
  version: z.string().max(40).optional(),
  active: z.boolean().optional().default(true),
  options: z.array(questionOptionSchema).min(2)
}).refine(payload => payload.options.some(opt => opt.is_correct), {
  message: 'At least one option must be correct',
  path: ['options']
});

const questionListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
  category: z.string().max(80).optional(),
  search: z.string().max(120).trim().optional(),
  active: z.coerce.boolean().optional()
});

function parseOptionsJson(value) {
  if (value === null || value === undefined) {
    return [];
  }

  try {
    let raw;
    if (typeof value === 'string') {
      raw = value;
    } else if (Buffer.isBuffer(value)) {
      raw = value.toString('utf8');
    } else {
      raw = JSON.stringify(value);
    }

    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .filter(option => option && typeof option === 'object')
      .map(option => ({
        id: option.id ?? null,
        text: typeof option.text === 'string' ? option.text : '',
        is_correct: Boolean(option.is_correct ?? option.isCorrect ?? option.correct)
      }))
      .filter(option => option.text.length > 0);
  } catch (error) {
    console.warn('[questions] Failed to parse question options', error);
    return [];
  }
}

function mapQuestionRow(row) {
  return {
    id: row.id,
    text: row.text,
    category: row.category,
    difficulty: row.difficulty,
    version: row.version,
    active: !!row.active,
    options: parseOptionsJson(row.options)
  };
}

app.get('/api/admin/questions', requireAuth, authorizeRoles('admin'), async (req, res) => {
  try {
    await ensureAssessmentSchemaReady();
    const params = questionListQuerySchema.parse(req.query ?? {});
    const filters = [];
    const filterValues = [];

    if (params.category) { filters.push('q.category = ?'); filterValues.push(params.category); }
    if (params.active !== undefined) { filters.push('q.active = ?'); filterValues.push(params.active ? 1 : 0); }
    if (params.search) {
      const like = `%${params.search}%`;
      filters.push('q.text LIKE ?');
      filterValues.push(like);
    }

    const whereClause = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
    const countRows = await query(`SELECT COUNT(*) AS total FROM questions q ${whereClause}`, filterValues);
    const total = Number(countRows[0]?.total ?? 0);

    const limitValue = Number.isFinite(params.limit) ? params.limit : 50;
    const offsetValue = Number.isFinite(params.offset) ? params.offset : 0;

    const rows = await query(
      `SELECT
         q.id,
         q.text,
         q.category,
         q.difficulty,
         q.version,
         q.active,
         JSON_ARRAYAGG(IF(qo.id IS NULL, NULL, JSON_OBJECT('id', qo.id, 'text', qo.text, 'is_correct', qo.is_correct))) AS options
       FROM questions q
       LEFT JOIN question_options qo ON qo.question_id = q.id
       ${whereClause}
       GROUP BY q.id
       ORDER BY q.text ASC
       LIMIT ${limitValue} OFFSET ${offsetValue}`,
      filterValues
    );

    const items = rows.map(mapQuestionRow);
    res.json({ total, limit: params.limit, offset: params.offset, items });
  } catch (error) {
    console.error(error);
    res.status(400).json({ message: 'Invalid query' });
  }
});

app.get('/api/admin/questions/:id', requireAuth, authorizeRoles('admin'), async (req, res) => {
  try {
    await ensureAssessmentSchemaReady();
    const questionId = req.params.id;
    if (!uuidSchema.safeParse(questionId).success) return res.status(400).json({ message: 'invalid id' });
    const row = await queryOne(
      `SELECT q.id, q.text, q.category, q.difficulty, q.version, q.active,
              JSON_ARRAYAGG(IF(qo.id IS NULL, NULL, JSON_OBJECT('id', qo.id, 'text', qo.text, 'is_correct', qo.is_correct))) AS options
       FROM questions q
       LEFT JOIN question_options qo ON qo.question_id = q.id
       WHERE q.id = ?
       GROUP BY q.id`,
      [questionId]
    );
    if (!row) return res.status(404).json({ message: 'not_found' });
    res.json(mapQuestionRow(row));
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

app.post('/api/admin/questions', requireAuth, authorizeRoles('admin'), async (req, res) => {
  try {
    await ensureAssessmentSchemaReady();
    const payload = createQuestionSchema.parse(req.body ?? {});
    const questionId = randomUUID();

    await withTransaction(async connection => {
      await execute(
        'INSERT INTO questions (id, text, category, difficulty, version, active) VALUES (?, ?, ?, ?, ?, ?)',
        [
          questionId,
          payload.text,
          payload.category || null,
          payload.difficulty || null,
          payload.version || null,
          payload.active ? 1 : 0
        ],
        connection
      );

      for (const option of payload.options) {
        await execute(
          'INSERT INTO question_options (id, question_id, text, is_correct) VALUES (?, ?, ?, ?)',
          [randomUUID(), questionId, option.text, option.is_correct ? 1 : 0],
          connection
        );
      }
    });

    const created = await queryOne(
      `SELECT q.id, q.text, q.category, q.difficulty, q.version, q.active,
              JSON_ARRAYAGG(IF(qo.id IS NULL, NULL, JSON_OBJECT('id', qo.id, 'text', qo.text, 'is_correct', qo.is_correct))) AS options
       FROM questions q
       LEFT JOIN question_options qo ON qo.question_id = q.id
       WHERE q.id = ?
       GROUP BY q.id`,
      [questionId]
    );

    res.status(201).json(mapQuestionRow(created));
  } catch (error) {
    if (error?.issues) return res.status(400).json({ message: 'Invalid input', errors: error.issues });
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

const updateQuestionSchema = z.object({
  text: z.string().min(1).optional(),
  category: z.string().max(80).optional(),
  difficulty: z.string().max(40).optional(),
  version: z.string().max(40).optional(),
  active: z.boolean().optional(),
  options: z.array(questionOptionSchema).min(2).optional()
}).refine(data => Object.keys(data).length > 0, { message: 'No fields to update' });

app.put('/api/admin/questions/:id', requireAuth, authorizeRoles('admin'), async (req, res) => {
  try {
    await ensureAssessmentSchemaReady();
    const questionId = req.params.id;
    if (!uuidSchema.safeParse(questionId).success) return res.status(400).json({ message: 'invalid id' });
    const payload = updateQuestionSchema.parse(req.body ?? {});

    if (payload.options && !payload.options.some(opt => opt.is_correct)) {
      return res.status(400).json({ message: 'At least one option must be correct' });
    }

    await withTransaction(async connection => {
      const updateData = {
        text: payload.text,
        category: payload.category,
        difficulty: payload.difficulty,
        version: payload.version,
        active: payload.active === undefined ? undefined : (payload.active ? 1 : 0)
      };

      const clause = buildUpdateClause(updateData);
      if (clause.sets.length) {
        await execute(`UPDATE questions SET ${clause.sets.join(', ')} WHERE id = ?`, [...clause.values, questionId], connection);
      }

      if (payload.options) {
        await execute('DELETE FROM question_options WHERE question_id = ?', [questionId], connection);
        for (const option of payload.options) {
          await execute(
            'INSERT INTO question_options (id, question_id, text, is_correct) VALUES (?, ?, ?, ?)',
            [randomUUID(), questionId, option.text, option.is_correct ? 1 : 0],
            connection
          );
        }
      }
    });

    const updated = await queryOne(
      `SELECT q.id, q.text, q.category, q.difficulty, q.version, q.active,
              JSON_ARRAYAGG(IF(qo.id IS NULL, NULL, JSON_OBJECT('id', qo.id, 'text', qo.text, 'is_correct', qo.is_correct))) AS options
       FROM questions q
       LEFT JOIN question_options qo ON qo.question_id = q.id
       WHERE q.id = ?
       GROUP BY q.id`,
      [questionId]
    );
    if (!updated) return res.status(404).json({ message: 'not_found' });
    res.json(mapQuestionRow(updated));
  } catch (error) {
    if (error?.issues) return res.status(400).json({ message: 'Invalid input', errors: error.issues });
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

app.delete('/api/admin/questions/:id', requireAuth, authorizeRoles('admin'), async (req, res) => {
  try {
    await ensureAssessmentSchemaReady();
    const questionId = req.params.id;
    if (!uuidSchema.safeParse(questionId).success) return res.status(400).json({ message: 'invalid id' });
    const result = await execute('DELETE FROM questions WHERE id = ?', [questionId]);
    if (!result.affectedRows) return res.status(404).json({ message: 'not_found' });
    res.status(204).send();
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// ---------------------------------------------------------------------------
// Assessments
// ---------------------------------------------------------------------------
const PASSING_SCORE = 70;

const createAssessmentSchema = z.object({
  user_id: uuidSchema,
  answers: z.array(z.object({
    question_id: uuidSchema,
    option_id: uuidSchema
  })).min(1)
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

app.post('/api/foreman/assessments', requireAuth, authorizeRoles('foreman', 'admin', 'project_manager'), async (req, res) => {
  try {
    const payload = foremanAssessmentSchema.parse(req.body ?? {});

    await requireWorkerTables();
    const workerRow = await queryOne('SELECT id FROM workers WHERE id = ? LIMIT 1', [payload.worker_id]);
    if (!workerRow) return res.status(404).json({ message: 'not_found' });

    const assessmentId = randomUUID();
    const criteriaJson = JSON.stringify(payload.criteria ?? {});

    await withTransaction(async connection => {
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
    });

    res.status(201).json({ id: assessmentId });
  } catch (error) {
    if (error?.issues) return res.status(400).json({ message: 'Invalid input', errors: error.issues });
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

app.post('/api/assessments', requireAuth, async (req, res) => {
  try {
    const payload = createAssessmentSchema.parse(req.body ?? {});

    if (hasRole(req, 'worker')) {
      await requireWorkerTables();
      const isNumericWorkerId = workerProfilesWorkerIdIsNumeric && Number.isInteger(Number(req.user?.id));
      if (isNumericWorkerId) {
        const profile = await fetchWorkerProfile(undefined, req.user.id);
        if (!profile?.employment?.assessmentEnabled) {
          return res.status(403).json({ message: 'assessment_closed' });
        }
      }
    }
    if (!canAccessUser(req, payload.user_id)) return res.status(403).json({ message: 'forbidden' });

    const result = await withTransaction(async connection => {
      const optionIds = payload.answers.map(answer => answer.option_id);
      const optionRows = await query(
        'SELECT id, question_id, is_correct FROM question_options WHERE id IN (?)',
        [optionIds],
        connection
      );
      const optionMap = new Map(optionRows.map(row => [row.id, row]));

      const seenQuestions = new Set();
      let correctCount = 0;
      for (const answer of payload.answers) {
        const option = optionMap.get(answer.option_id);
        if (!option || option.question_id !== answer.question_id) {
          return { error: { status: 400, message: 'invalid_answer_mapping' } };
        }
        if (seenQuestions.has(answer.question_id)) {
          return { error: { status: 400, message: 'duplicate_question' } };
        }
        seenQuestions.add(answer.question_id);
        if (option.is_correct) correctCount += 1;
      }

      const total = payload.answers.length;
      const score = total === 0 ? 0 : Number(((correctCount / total) * 100).toFixed(2));
      const passed = score >= PASSING_SCORE;

      const assessmentId = randomUUID();
      await execute(
        'INSERT INTO assessments (id, user_id, finished_at, score, passed) VALUES (?, ?, NOW(6), ?, ?)',
        [assessmentId, payload.user_id, score, passed ? 1 : 0],
        connection
      );

      for (const answer of payload.answers) {
        await execute(
          'INSERT INTO assessment_answers (assessment_id, question_id, chosen_option_id) VALUES (?, ?, ?)',
          [assessmentId, answer.question_id, answer.option_id],
          connection
        );
      }

      const assessment = await queryOne(
        'SELECT id, user_id, started_at, finished_at, score, passed FROM assessments WHERE id = ?',
        [assessmentId],
        connection
      );

      return {
        assessment,
        summary: {
          total_questions: total,
          correct: correctCount,
          score,
          passed
        }
      };
    });

    if (result.error) {
      return res.status(result.error.status).json({ message: result.error.message });
    }

    res.status(201).json(result);
  } catch (error) {
    if (error?.issues) return res.status(400).json({ message: 'Invalid input', errors: error.issues });
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

app.get('/api/assessments/:id', requireAuth, async (req, res) => {
  try {
    const assessmentId = req.params.id;
    if (!uuidSchema.safeParse(assessmentId).success) return res.status(400).json({ message: 'invalid id' });
    const assessment = await queryOne(
      'SELECT id, user_id, started_at, finished_at, score, passed FROM assessments WHERE id = ?',
      [assessmentId]
    );
    if (!assessment) return res.status(404).json({ message: 'not_found' });
    if (!canAccessUser(req, assessment.user_id)) return res.status(403).json({ message: 'forbidden' });

    const answers = await query(
      `SELECT aa.question_id, aa.chosen_option_id, qo.is_correct
       FROM assessment_answers aa
       LEFT JOIN question_options qo ON qo.id = aa.chosen_option_id
       WHERE aa.assessment_id = ?`,
      [assessmentId]
    );

    res.json({ ...assessment, answers });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

app.get('/api/users/:id/assessments', requireAuth, async (req, res) => {
  try {
    const userId = req.params.id;
    if (!uuidSchema.safeParse(userId).success) return res.status(400).json({ message: 'invalid id' });
    if (!canAccessUser(req, userId)) return res.status(403).json({ message: 'forbidden' });

    const rows = await query(
      'SELECT id, user_id, started_at, finished_at, score, passed FROM assessments WHERE user_id = ? ORDER BY finished_at DESC',
      [userId]
    );
    res.json(rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

app.delete('/api/assessments/:id', requireAuth, authorizeRoles('admin'), async (req, res) => {
  try {
    const assessmentId = req.params.id;
    if (!uuidSchema.safeParse(assessmentId).success) return res.status(400).json({ message: 'invalid id' });
    const result = await execute('DELETE FROM assessments WHERE id = ?', [assessmentId]);
    if (!result.affectedRows) return res.status(404).json({ message: 'not_found' });
    res.status(204).send();
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// ---------------------------------------------------------------------------
// Admin - Quizzes Management
// ---------------------------------------------------------------------------
app.get('/api/admin/quizzes', requireAuth, authorizeRoles('admin'), async (req, res) => {
  // quizzes table does not exist in current schema
  res.json({ items: [] });
});

app.get('/api/admin/quizzes/:id', requireAuth, authorizeRoles('admin'), async (req, res) => {
  // quizzes/quiz_questions tables do not exist in current schema
  res.status(404).json({ message: 'not_found' });
});

app.post('/api/admin/quizzes/:id/approve', requireAuth, authorizeRoles('admin'), async (req, res) => {
  // quizzes table does not exist in current schema
  res.status(404).json({ message: 'not_found' });
});

app.post('/api/admin/quizzes/:id/reject', requireAuth, authorizeRoles('admin'), async (req, res) => {
  // quizzes table does not exist in current schema
  res.status(404).json({ message: 'not_found' });
});

// ---------------------------------------------------------------------------
// Admin - Expiring Assessments
// ---------------------------------------------------------------------------
app.get('/api/admin/assessments/expiring', requireAuth, authorizeRoles('admin'), async (req, res) => {
  // assessments.expiry_date does not exist in current schema
  res.json({ items: [] });
});

app.get('/api/admin/assessment-results', async (req, res) => {
  try {
    await ensureAssessmentSchemaReady();
    await ensureAssessmentSessionSchemaReady();
    await ensureAssessmentResultSchemaReady();
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.max(1, parseInt(req.query.limit, 10) || 10);
    const offset = (page - 1) * limit;
    const safeLimit = Math.max(1, Math.min(100, Math.floor(limit)));
    const safeOffset = Math.max(0, Math.floor(offset));
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

    const passedFilter = passed && passed !== 'all' ? (passed === '1' ? 1 : 0) : null;
    if (passedFilter !== null) {
      const passExpr = `r.total_questions > 0 AND r.total_score >= CEIL(r.total_questions * (COALESCE(ar.passing_score, 70) / 100))`;
      whereClause += passedFilter === 1
        ? ` AND (${passExpr})`
        : ` AND NOT (${passExpr})`;
    }

    let total = 0;
    let rows = [];
    try {
      const countRows = await query(
        `SELECT COUNT(*) AS total
           FROM worker_assessment_results r
           LEFT JOIN assessment_rounds ar ON ar.id = r.round_id
           LEFT JOIN workers w ON w.id = r.worker_id
           LEFT JOIN worker_accounts a ON a.worker_id = w.id
          ${whereClause}`,
        params
      );
      total = Number(countRows?.[0]?.total) || 0;

      rows = await query(
        `SELECT r.id, r.worker_id, r.round_id, r.session_id, r.category, r.total_score, r.total_questions,
                r.passed, r.finished_at, w.full_name AS worker_name, a.email AS worker_email,
                COALESCE(ar.passing_score, 70) AS passing_score_pct,
                CEIL(r.total_questions * (COALESCE(ar.passing_score, 70) / 100)) AS required_correct,
                CASE
                  WHEN r.total_questions > 0
                    AND r.total_score >= CEIL(r.total_questions * (COALESCE(ar.passing_score, 70) / 100))
                  THEN 1 ELSE 0
                END AS derived_pass
           FROM worker_assessment_results r
           LEFT JOIN assessment_rounds ar ON ar.id = r.round_id
           LEFT JOIN workers w ON w.id = r.worker_id
           LEFT JOIN worker_accounts a ON a.worker_id = w.id
          ${whereClause}
          ORDER BY r.finished_at DESC
          LIMIT ${safeLimit} OFFSET ${safeOffset}`,
        params
      );
    } catch (error) {
      if (error?.code === 'ER_NO_SUCH_TABLE' || error?.code === 'ER_BAD_TABLE_ERROR') {
        return res.json({ items: [], total: 0 });
      }
      throw error;
    }

    const items = (rows || []).map(row => ({
      ...row,
      passed: Boolean(Number(row.derived_pass)),
      passingScorePct: Number(row.passing_score_pct),
      requiredCorrect: Number(row.required_correct)
    }));

    res.json({ items, total });
  } catch (error) {
    if (error?.code === 'ER_NO_SUCH_TABLE' || error?.code === 'ER_BAD_TABLE_ERROR') {
      return res.json({ items: [], total: 0 });
    }
    console.error('GET /api/admin/assessment-results error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

app.get('/api/admin/assessments/:id', requireAuth, authorizeRoles('admin'), async (req, res) => {
  try {
    const assessmentId = req.params.id;
    if (!uuidSchema.safeParse(assessmentId).success) return res.status(400).json({ message: 'invalid id' });
    
    const assessment = await queryOne(
      `SELECT 
         a.*,
         u.full_name AS workerName,
         ar.title AS roundTitle
       FROM assessments a
       LEFT JOIN users u ON u.id = a.user_id
       LEFT JOIN assessment_rounds ar ON ar.id = a.round_id
       WHERE a.id = ?`,
      [assessmentId]
    );
    
    if (!assessment) return res.status(404).json({ message: 'not_found' });
    
    res.json(assessment);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// ---------------------------------------------------------------------------
// Project Management
// ---------------------------------------------------------------------------

const createProjectSchema = z.object({
  name: z.string().min(1).max(255),
  status: z.enum(['active', 'completed', 'archived']).optional(),
  owner_user_id: uuidSchema.optional(),
  description: z.string().optional()
});

app.post('/api/projects', requireAuth, authorizeRoles('admin', 'project_manager'), async (req, res) => {
  try {
    const payload = createProjectSchema.parse(req.body ?? {});
    const projectId = randomUUID();
    
    await execute(
      'INSERT INTO projects (id, name, owner_user_id, status) VALUES (?, ?, ?, ?)',
      [projectId, payload.name, req.user?.id || null, payload.status || 'active']
    );

    res.status(201).json({ id: projectId, message: 'Project created' });
  } catch (error) {
    if (error?.issues) return res.status(400).json({ message: 'Invalid input', errors: error.issues });
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

app.delete('/api/projects/:id', requireAuth, authorizeRoles('admin', 'project_manager'), async (req, res) => {
  try {
    const { id } = req.params;
    const result = await execute('DELETE FROM projects WHERE id = ?', [id]);
    if (result.affectedRows === 0) return res.status(404).json({ message: 'not_found' });
    res.json({ message: 'deleted' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// ---------------------------------------------------------------------------
// Dashboard metrics
// ---------------------------------------------------------------------------
app.get('/api/dashboard/project-task-counts', requireAuth, authorizeRoles('project_manager'), async (_req, res) => {
  try {
    const rows = await query(
      `SELECT
         p.id AS project_id,
         p.name AS project_name,
         p.site_address,
         p.start_date,
         p.end_date,
         COUNT(t.id) AS tasks_total,
         SUM(t.status = 'todo') AS tasks_todo,
         SUM(t.status = 'in-progress') AS tasks_in_progress,
         SUM(t.status = 'done') AS tasks_done
       FROM projects p
       LEFT JOIN tasks t ON t.project_id = p.id
       GROUP BY p.id, p.name
       ORDER BY p.name`
    );
    res.json(rows.map(row => ({
      project_id: row.project_id,
      project_name: row.project_name,
      site_address: row.site_address || null,
      start_date: row.start_date || null,
      end_date: row.end_date || null,
      tasks_total: Number(row.tasks_total ?? 0),
      tasks_todo: Number(row.tasks_todo ?? 0),
      tasks_in_progress: Number(row.tasks_in_progress ?? 0),
      tasks_done: Number(row.tasks_done ?? 0)
    })));
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

app.get('/api/dashboard/practical-testing-count', requireAuth, authorizeRoles('project_manager'), async (_req, res) => {
  try {
    await ensureTaskWorkerAssignmentSchema();
    const rows = await query(
      `SELECT DISTINCT worker_id
       FROM task_worker_assignments
       WHERE assignment_type = 'practical_assessment'
         AND status IN ('assigned', 'in_progress')`
    );
    const workerIds = rows.map(row => Number(row.worker_id)).filter(Number.isFinite);
    res.json({ count: workerIds.length, worker_ids: workerIds });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// ---------------------------------------------------------------------------
// Admin Dashboard Stats
// ---------------------------------------------------------------------------
app.get('/api/admin/dashboard/stats', requireAuth, authorizeRoles('admin'), async (_req, res) => {
  try {
    // คำนวณคะแนนเฉลี่ยจากการประเมินล่าสุดของแต่ละคน
    const scoreStats = await queryOne(
      `SELECT 
         ROUND(AVG(a.score), 2) as avg_score,
         COUNT(DISTINCT a.user_id) as total_assessed,
         SUM(CASE WHEN a.passed = 1 THEN 1 ELSE 0 END) as passed_count
       FROM assessments a
       INNER JOIN (
         SELECT user_id, MAX(finished_at) as latest_date
         FROM assessments
         WHERE finished_at IS NOT NULL
         GROUP BY user_id
       ) latest ON a.user_id = latest.user_id AND a.finished_at = latest.latest_date`
    );
    
    // นับจำนวนคนที่มีคะแนนต่ำกว่า 70
    const belowThreshold = await queryOne(
      `SELECT COUNT(DISTINCT a.user_id) as count
       FROM assessments a
       INNER JOIN (
         SELECT user_id, MAX(finished_at) as latest_date
         FROM assessments
         WHERE finished_at IS NOT NULL
         GROUP BY user_id
       ) latest ON a.user_id = latest.user_id AND a.finished_at = latest.latest_date
       WHERE a.score < 70`
    );
    
    // หาจุดอ่อน (subcategory ที่มีคะแนนเฉลี่ยต่ำสุด)
    const weakestSkill = await queryOne(
      `SELECT 
         s.label,
         AVG(q.difficulty_level) as avg_difficulty
       FROM assessment_answers aa
       INNER JOIN questions q ON q.id = aa.question_id
       INNER JOIN subcategories s ON s.id = q.subcategory_id
       INNER JOIN question_options qo ON qo.id = aa.chosen_option_id
       WHERE qo.is_correct = 0
       GROUP BY s.id, s.label
       ORDER BY COUNT(*) DESC
       LIMIT 1`
    );
    
    const avgScore = scoreStats?.avg_score || 0;
    const totalAssessed = scoreStats?.total_assessed || 0;
    const passedCount = scoreStats?.passed_count || 0;
    const passRate = totalAssessed > 0 ? Math.round((passedCount / totalAssessed) * 100) : 0;
    
    res.json({
      avgScore: avgScore,
      passRate: passRate,
      belowThreshold: belowThreshold?.count || 0,
      weakestSkill: weakestSkill?.label || 'ไม่มีข้อมูล',
      trend: {
        avgScore: '+2.5%',
        passRate: '+5%',
        belowThreshold: '-3'
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// ---------------------------------------------------------------------------
// Admin Dashboard Skill Gap Analysis
// ---------------------------------------------------------------------------
app.get('/api/admin/dashboard/skill-gap', requireAuth, authorizeRoles('admin'), async (_req, res) => {
  // workers.department_id does not exist in current schema
  res.json([]);
});

// ---------------------------------------------------------------------------
// Admin Dashboard Skill Distribution
// ---------------------------------------------------------------------------
app.get('/api/admin/dashboard/skill-distribution', requireAuth, authorizeRoles('admin'), async (_req, res) => {
  try {
    // คำนวณการกระจายระดับทักษะจากคะแนนล่าสุดของแต่ละคน
    const distribution = await query(
      `SELECT 
         CASE 
           WHEN a.score >= 80 THEN 'Expert'
           WHEN a.score >= 60 THEN 'Intermediate'
           ELSE 'Beginner'
         END as skill_level,
         COUNT(*) as count
       FROM assessments a
       INNER JOIN (
         SELECT user_id, MAX(finished_at) as latest_date
         FROM assessments
         WHERE finished_at IS NOT NULL
         GROUP BY user_id
       ) latest ON a.user_id = latest.user_id AND a.finished_at = latest.latest_date
       WHERE a.score IS NOT NULL
       GROUP BY skill_level
       ORDER BY FIELD(skill_level, 'Expert', 'Intermediate', 'Beginner')`
    );
    
    // แปลงเป็น format ที่ frontend ต้องการ
    const total = distribution.reduce((sum, item) => sum + Number(item.count), 0);
    const result = distribution.map(item => {
      const count = Number(item.count);
      const percentage = total > 0 ? Math.round((count / total) * 100) : 0;
      let level, color;
      
      if (item.skill_level === 'Expert') {
        level = 'Expert (สูง)';
        color = '#48bb78';
      } else if (item.skill_level === 'Intermediate') {
        level = 'Intermediate (กลาง)';
        color = '#ecc94b';
      } else {
        level = 'Beginner (ต่ำ)';
        color = '#f56565';
      }
      
      return { level, count, percentage, color };
    });
    
    // ถ้าไม่มีข้อมูลเลย ให้ return array ว่าง
    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// ---------------------------------------------------------------------------
// Worker Profile & Tasks (Real Data)
// ---------------------------------------------------------------------------
const workerStatusByUserId = new Map();

function parseWorkerId(value) {
  const parsed = Number.parseInt(String(value || '').trim(), 10);
  return Number.isFinite(parsed) ? parsed : null;
}

app.get('/api/worker/profile', async (req, res) => {
  try {
    const userId = typeof req.query.userId === 'string' ? req.query.userId.trim() : '';
    const workerId = parseWorkerId(req.query.workerId);
    const email = typeof req.query.email === 'string' ? req.query.email.trim() : '';

    if (workerId) {
      const rows = await query(
        `SELECT w.id, w.full_name, w.phone, w.role_code, w.trade_type, w.province, w.district, w.subdistrict, w.postal_code,
                w.current_address, a.email
           FROM workers w
           LEFT JOIN worker_accounts a ON a.worker_id = w.id
          WHERE w.id = ?
          LIMIT 1`,
        [workerId]
      );
      if (!rows?.length) return res.status(404).json({ message: 'Worker not found' });
      const row = rows[0];
      return res.json({
        id: row.id,
        name: row.full_name,
        email: row.email,
        phone: row.phone,
        role: row.role_code || 'worker',
        technician_type: row.trade_type || null
      });
    }

    if (userId) {
      const rows = await query(
        `SELECT id, full_name, phone, email, status
           FROM users
          WHERE id = ?
          LIMIT 1`,
        [userId]
      );
      if (!rows?.length) return res.status(404).json({ message: 'User not found' });
      const row = rows[0];
      return res.json({
        id: row.id,
        name: row.full_name,
        email: row.email,
        phone: row.phone,
        role: 'worker',
        technician_type: null
      });
    }

    if (email) {
      const rows = await query(
        `SELECT w.id, w.full_name, w.phone, w.role_code, w.trade_type, a.email
           FROM worker_accounts a
           INNER JOIN workers w ON w.id = a.worker_id
          WHERE LOWER(a.email) = LOWER(?)
          LIMIT 1`,
        [email]
      );
      if (!rows?.length) return res.status(404).json({ message: 'Worker not found' });
      const row = rows[0];
      return res.json({
        id: row.id,
        name: row.full_name,
        email: row.email,
        phone: row.phone,
        role: row.role_code || 'worker',
        technician_type: row.trade_type || null
      });
    }

    return res.status(400).json({ message: 'userId, workerId, or email is required' });
  } catch (error) {
    console.error('GET /api/worker/profile error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
});

app.get('/api/worker/status', async (req, res) => {
  try {
    const userId = typeof req.query.userId === 'string' ? req.query.userId.trim() : '';
    const workerId = parseWorkerId(req.query.workerId);

    if (workerId) {
      const rows = await query(
        `SELECT payload FROM worker_profiles WHERE worker_id = ? LIMIT 1`,
        [workerId]
      );
      if (!rows?.length) return res.json({ status: 'idle' });
      const payload = rows[0]?.payload;
      const parsed = payload ? JSON.parse(payload) : {};
      return res.json({ status: parsed.availability || 'idle' });
    }

    if (userId) {
      return res.json({ status: workerStatusByUserId.get(userId) || 'idle' });
    }

    return res.status(400).json({ message: 'userId or workerId is required' });
  } catch (error) {
    console.error('GET /api/worker/status error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
});

app.put('/api/worker/status', async (req, res) => {
  try {
    const { userId, workerId, status } = req.body || {};
    const normalizedStatus = status === 'online' ? 'online' : 'idle';
    const numericWorkerId = parseWorkerId(workerId);

    if (numericWorkerId) {
      const payload = JSON.stringify({ availability: normalizedStatus, updatedAt: new Date().toISOString() });
      await query(
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
  } catch (error) {
    console.error('PUT /api/worker/status error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
});

app.get('/api/worker/tasks', async (req, res) => {
  try {
    const userId = typeof req.query.userId === 'string' ? req.query.userId.trim() : '';
    if (!userId) return res.json([]);

    const rows = await query(
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

    return res.json(result);
  } catch (error) {
    console.error('GET /api/worker/tasks error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
});

app.post('/api/worker/tasks/:id/accept', async (req, res) => {
  try {
    const taskId = req.params.id;
    const result = await execute(
      `UPDATE tasks SET status = 'in-progress', updated_at = CURRENT_TIMESTAMP(6) WHERE id = ?`,
      [taskId]
    );
    if (!result?.affectedRows) {
      return res.status(404).json({ message: 'Task not found' });
    }
    return res.json({ id: taskId, status: 'in-progress' });
  } catch (error) {
    console.error('POST /api/worker/tasks/:id/accept error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
});

app.post('/api/worker/tasks/:id/submit', async (req, res) => {
  try {
    const taskId = req.params.id;
    const result = await execute(
      `UPDATE tasks SET status = 'submitted', updated_at = CURRENT_TIMESTAMP(6) WHERE id = ?`,
      [taskId]
    );
    if (!result?.affectedRows) {
      return res.status(404).json({ message: 'Task not found' });
    }
    return res.json({ id: taskId, status: 'submitted' });
  } catch (error) {
    console.error('POST /api/worker/tasks/:id/submit error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
});

app.get('/api/worker/history', async (req, res) => {
  try {
    const userId = typeof req.query.userId === 'string' ? req.query.userId.trim() : '';
    if (!userId) return res.json([]);

    const rows = await query(
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

    return res.json(result);
  } catch (error) {
    console.error('GET /api/worker/history error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
});

// ---------------------------------------------------------------------------
// Server bootstrap
// ---------------------------------------------------------------------------
app.listen(Number(env.PORT), () => {
  console.log(`SkillGauge API listening on http://localhost:${env.PORT}`);
});

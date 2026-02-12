import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { env } from './config/env.js';
import authRoutes from './routes/authRoutes.js';
import adminRoleRoutes from './routes/adminRoleRoutes.js';
import pmRoleRoutes from './routes/pmRoleRoutes.js';
import wkRoleRoutes from './routes/wkRoleRoutes.js';
import fmRoleRoutes from './routes/fmRoleRoutes.js';
import { requireAuth, authorizeRoles } from './middlewares/auth.js';
import { buildUpdateClause, query, queryOne, execute, withTransaction } from './utils/db.js';
import { workerRegistrationSchema } from './schemas/userSchemas.js';
import { workerService } from './services/workerService.js';
import { toNullableString } from './utils/helpers.js';
import bcrypt from 'bcryptjs';
import {
  loadThaiAddressDataset,
  searchThaiAddressRecords,
  getAddressMeta
} from './services/thaiAddressService.js';

const app = express();

app.use(cors({
  origin: env.CORS_ORIGIN,
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json({ limit: '1mb' }));

loadThaiAddressDataset().catch((error) => {
  console.warn('[addresses] Initial dataset load failed', error?.message || error);
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'skillgauge-api' });
});

app.get('/api/admin/audit-logs', requireAuth, authorizeRoles('admin'), async (req, res) => {
  try {
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

      return {
        id: row.id,
        timestamp: row.created_at,
        user: row.full_name || row.phone || row.email || 'System',
        role: '-',
        action: row.action,
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
      filters.push('r.passed = ?');
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

    res.json({ items: rows, total });
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
  return workerService.mapWorkerRowToResponse(row, profilePayload, null, null);
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
    results.push(workerService.mapWorkerRowToResponse(row, profilePayload, null, null));
  }
  return results;
}

app.get('/api/admin/workers', requireAuth, authorizeRoles('admin'), async (_req, res) => {
  try {
    await requireWorkerTables();
    const items = await getAllWorkerResponses();
    res.json({ items });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

app.get('/api/admin/workers/:id', requireAuth, authorizeRoles('admin'), async (req, res) => {
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

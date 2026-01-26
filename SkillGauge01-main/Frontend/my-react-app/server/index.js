import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import mysql from 'mysql2/promise';
import { randomUUID } from 'crypto';
import { readFile } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { z } from 'zod';

const {
  PORT = 4000,
  CORS_ORIGIN = 'http://localhost:3002',
  MYSQL_HOST = 'localhost',
  MYSQL_PORT = '3306',
  MYSQL_DATABASE = 'admin-worker-registration',
  MYSQL_USER = 'root',
  MYSQL_PASSWORD = 'rootpassword',
  MYSQL_CONNECT_TIMEOUT_MS = '2000',
  JWT_SECRET = 'dev_secret_change_me',
  JWT_EXPIRES_IN = '12h'
} = process.env;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const resolvedThaiAddressPath = (() => {
  const customPath = process.env.THAI_ADDRESS_DATA_PATH;
  if (customPath && customPath.trim()) {
    return path.resolve(customPath.trim());
  }
  return path.resolve(
    __dirname,
    '..',
    '..',
    'thailand-province-district-subdistrict-zipcode-latitude-longitude-master',
    'thailand-province-district-subdistrict-zipcode-latitude-longitude-master',
    'output.csv'
  );
})();

const allowedAddressFields = new Set(['province', 'district', 'subdistrict']);

let thaiAddressRecords = [];
let thaiAddressLastLoadedAt = null;
let thaiAddressLoadError = null;

function normalizeSearchText(value) {
  return String(value ?? '')
    .normalize('NFC')
    .toLowerCase()
    .replace(/\s+/g, '');
}

function dedupeRecords(records, keySelector) {
  if (!Array.isArray(records) || !keySelector) {
    return [];
  }
  const seen = new Set();
  const output = [];
  for (const record of records) {
    const key = keySelector(record);
    if (!key || seen.has(key)) {
      continue;
    }
    seen.add(key);
    output.push(record);
  }
  return output;
}

async function loadThaiAddressDataset(dataPath = resolvedThaiAddressPath) {
  try {
    const fileContent = await readFile(dataPath, 'utf8');
    const lines = fileContent.split(/\r?\n/);
    const nextRecords = [];

    for (let index = 1; index < lines.length; index += 1) {
      const line = lines[index];
      if (!line || !line.trim()) {
        continue;
      }
      const parts = line.split(',');
      if (parts.length < 4) {
        continue;
      }

      const [provinceRaw, districtRaw, subdistrictRaw, zipcodeRaw, latitudeRaw, longitudeRaw] = parts;
      const province = (provinceRaw || '').trim();
      const district = (districtRaw || '').trim();
      const subdistrict = (subdistrictRaw || '').trim();
      const zipcode = (zipcodeRaw || '').trim();

      if (!province || !district || !subdistrict || !zipcode) {
        continue;
      }

      const latitude = latitudeRaw ? Number.parseFloat(latitudeRaw) : null;
      const longitude = longitudeRaw ? Number.parseFloat(longitudeRaw) : null;

      nextRecords.push({
        province,
        district,
        subdistrict,
        zipcode,
        latitude: Number.isFinite(latitude) ? latitude : null,
        longitude: Number.isFinite(longitude) ? longitude : null,
        searchProvince: normalizeSearchText(province),
        searchDistrict: normalizeSearchText(district),
        searchSubdistrict: normalizeSearchText(subdistrict),
        searchZipcode: normalizeSearchText(zipcode)
      });
    }

    thaiAddressRecords = nextRecords;
    thaiAddressLastLoadedAt = new Date();
    thaiAddressLoadError = null;

    if (thaiAddressRecords.length > 0) {
      console.info(
        `[addresses] Loaded ${thaiAddressRecords.length.toLocaleString()} Thai address records from ${dataPath}`
      );
    } else {
      console.warn(`[addresses] No Thai address records were loaded from ${dataPath}`);
    }
  } catch (error) {
    thaiAddressRecords = [];
    thaiAddressLastLoadedAt = null;
    thaiAddressLoadError = error;
    console.warn(`[addresses] Unable to load Thai address dataset from ${dataPath}`, error?.message || error);
  }
}

function searchThaiAddressRecords({ field, query, provinceFilter, districtFilter, subdistrictFilter, limit }) {
  if (!allowedAddressFields.has(field)) {
    return [];
  }

  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) {
    return [];
  }

  let results = thaiAddressRecords;
  if (!Array.isArray(results) || results.length === 0) {
    return [];
  }

  const normalizedProvince = normalizeSearchText(provinceFilter);
  if (normalizedProvince) {
    results = results.filter(record => record.searchProvince === normalizedProvince);
  }

  const normalizedDistrict = normalizeSearchText(districtFilter);
  if (normalizedDistrict) {
    results = results.filter(record => record.searchDistrict === normalizedDistrict);
  }

  const normalizedSubdistrict = normalizeSearchText(subdistrictFilter);
  if (normalizedSubdistrict) {
    results = results.filter(record => record.searchSubdistrict === normalizedSubdistrict);
  }

  if (field === 'province') {
    results = results.filter(record => record.searchProvince.includes(normalizedQuery));
    results = dedupeRecords(results, record => record.searchProvince);
  } else if (field === 'district') {
    results = results.filter(record => record.searchDistrict.includes(normalizedQuery));
    results = dedupeRecords(results, record => `${record.searchProvince}|${record.searchDistrict}`);
  } else {
    results = results.filter(record => record.searchSubdistrict.includes(normalizedQuery));
    results = dedupeRecords(
      results,
      record => `${record.searchProvince}|${record.searchDistrict}|${record.searchSubdistrict}|${record.zipcode}`
    );
  }

  const safeLimit = Number.isFinite(limit) && limit > 0 ? Math.min(Math.floor(limit), 50) : 12;
  return results.slice(0, safeLimit);
}

loadThaiAddressDataset().catch(error => {
  console.warn('[addresses] Initial dataset load failed', error?.message || error);
});

const pool = mysql.createPool({
  host: MYSQL_HOST,
  port: Number(MYSQL_PORT),
  database: MYSQL_DATABASE,
  user: MYSQL_USER,
  password: MYSQL_PASSWORD,
  connectTimeout: Number(MYSQL_CONNECT_TIMEOUT_MS) || 2000,
  waitForConnections: true,
  connectionLimit: 10,
  namedPlaceholders: false
});

const app = express();
app.use(cors({ origin: CORS_ORIGIN, credentials: true, allowedHeaders: ['Content-Type', 'Authorization'] }));
app.use(express.json());

app.get('/api/lookups/addresses', (req, res) => {
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
  }).map(record => ({
    province: record.province,
    district: record.district,
    subdistrict: record.subdistrict,
    zipcode: record.zipcode,
    latitude: record.latitude,
    longitude: record.longitude
  }));

  res.json({
    query: queryRaw,
    field: fieldRaw,
    results: searchResults,
    meta: {
      total: searchResults.length,
      datasetLoaded: thaiAddressRecords.length > 0,
      lastLoadedAt: thaiAddressLastLoadedAt ? thaiAddressLastLoadedAt.toISOString() : null,
      loadError: thaiAddressLoadError ? String(thaiAddressLoadError.message || thaiAddressLoadError) : null
    }
  });
});

// ---------------------------------------------------------------------------
// Utility helpers
// ---------------------------------------------------------------------------
function normalizePhoneTH(input) {
  const raw = String(input || '').trim();
  if (!raw) return raw;
  if (raw.startsWith('+')) return raw;
  if (/^0\d{9}$/.test(raw)) return `+66${raw.slice(1)}`;
  if (/^66\d{9}$/.test(raw)) return `+${raw}`;
  return raw;
}

const uuidSchema = z.string().uuid();

async function execute(sql, params = [], connection) {
  const executor = connection ?? pool;
  const [result] = await executor.execute(sql, params);
  return result;
}

async function query(sql, params = [], connection) {
  const result = await execute(sql, params, connection);
  return Array.isArray(result) ? result : [];
}

async function queryOne(sql, params = [], connection) {
  const rows = await query(sql, params, connection);
  return rows[0] ?? null;
}

async function withTransaction(handler) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const result = await handler(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

function buildUpdateClause(data) {
  const entries = Object.entries(data).filter(([, value]) => value !== undefined);
  return {
    sets: entries.map(([column]) => `${column} = ?`),
    values: entries.map(([, value]) => value)
  };
}

const ROLE_LABELS = {
  admin: 'ผู้ดูแลระบบ',
  project_manager: 'ผู้จัดการโครงการ (PM)',
  pm: 'ผู้จัดการโครงการ (PM)',
  foreman: 'หัวหน้าช่าง (FM)',
  fm: 'หัวหน้าช่าง (FM)',
  worker: 'ช่าง (WK)',
  wk: 'ช่าง (WK)'
};

const TRADE_LABELS = {
  structure: 'ช่างโครงสร้าง',
  plumbing: 'ช่างประปา',
  roofing: 'ช่างหลังคา',
  masonry: 'ช่างก่ออิฐฉาบปูน',
  aluminum: 'ช่างประตูหน้าต่างอลูมิเนียม',
  ceiling: 'ช่างฝ้าเพดาล',
  electric: 'ช่างไฟฟ้า',
  tiling: 'ช่างกระเบื้อง'
};

const ADMIN_BYPASS = {
  id: '11111111-1111-1111-1111-111111111111',
  phone: '0863125891',
  normalizedPhone: '+66863125891',
  email: 'admin@example.com',
  fullName: 'ผู้ดูแลระบบ',
  password: '0863503381'
};

function getRoleLabel(role) {
  if (!role) return 'ไม่ระบุ';
  return ROLE_LABELS[role] || role;
}

function getTradeLabel(trade) {
  if (!trade) return 'ไม่ระบุ';
  return TRADE_LABELS[trade] || trade;
}

function toNullableString(value) {
  if (value === null || value === undefined) return null;
  const trimmed = String(value).trim();
  return trimmed.length ? trimmed : null;
}

function buildPhoneCandidates(input) {
  const value = toNullableString(input);
  if (!value) return [];
  const candidates = new Set([value]);
  const normalized = normalizePhoneTH(value);
  if (normalized) candidates.add(normalized);
  if (normalized && normalized.startsWith('+66')) {
    const digits = normalized.slice(3);
    if (/^\d+$/.test(digits)) candidates.add(`0${digits}`);
  }
  return Array.from(candidates);
}

function parseDateValue(value) {
  const trimmed = toNullableString(value);
  if (!trimmed) return null;
  const date = new Date(trimmed);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

function parseDateTimeInput(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date;
}

function calculateAgeFromDate(dateString) {
  if (!dateString) return null;
  const birth = new Date(dateString);
  if (Number.isNaN(birth.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age -= 1;
  }
  return age >= 0 ? age : null;
}

function parseExperienceYears(value) {
  if (value === null || value === undefined || value === '') return null;
  const numeric = Number(value);
  if (Number.isNaN(numeric)) return null;
  if (numeric < 0) return 0;
  if (numeric > 255) return 255;
  return Math.round(numeric);
}

function parseAgeValue(ageInput, birthDate) {
  const ageFromBirth = calculateAgeFromDate(birthDate);
  if (ageFromBirth !== null) return ageFromBirth;
  if (ageInput === null || ageInput === undefined || ageInput === '') return null;
  const numeric = Number(ageInput);
  if (Number.isNaN(numeric)) return null;
  if (numeric < 0) return 0;
  if (numeric > 120) return 120;
  return Math.round(numeric);
}

let workerTableColumns = new Set();
let workerAccountColumns = new Set();
let workerProfilesTableExists = false;

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
    workerProfilesTableExists = true;
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

function getColumn(row, ...candidates) {
  if (!row) return undefined;
  const keys = Object.keys(row);
  for (const candidate of candidates) {
    if (Object.prototype.hasOwnProperty.call(row, candidate)) {
      return row[candidate];
    }
    const lower = candidate.toLowerCase();
    const matchKey = keys.find(key => key.toLowerCase() === lower);
    if (matchKey) return row[matchKey];
  }
  return undefined;
}

function toISODateString(value) {
  if (!value) return '';
  if (typeof value === 'string') return value.slice(0, 10);
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return '';
}

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
        : profile.employment?.experienceYears || ''
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

function mapWorkerRowToResponse(row, profilePayload) {
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
  return mapWorkerRowToResponse(row, profilePayload);
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
  for (const row of rows) {
    const profilePayload = await fetchWorkerProfile(undefined, getColumn(row, 'id'));
    responses.push(mapWorkerRowToResponse(row, profilePayload));
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
    employment_status: 'active',
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

function getTokenFromHeader(req) {
  const header = req.headers?.authorization || req.headers?.Authorization;
  if (typeof header !== 'string') return null;
  const [scheme, token] = header.split(' ');
  if (scheme?.toLowerCase() !== 'bearer' || !token) return null;
  return token;
}

function requireAuth(req, res, next) {
  try {
    const token = getTokenFromHeader(req);
    if (!token) return res.status(401).json({ message: 'missing_token' });
    const payload = jwt.verify(token, JWT_SECRET, {
      issuer: 'skillgauge-api',
      audience: 'skillgauge-spa'
    });
    req.user = { id: payload.sub, roles: payload.roles || [] };
    next();
  } catch (error) {
    return res.status(401).json({ message: 'invalid_token' });
  }
}

function authorizeRoles(...allowed) {
  return (req, res, next) => {
    if (allowed.length === 0) return next();
    const currentRoles = Array.isArray(req.user?.roles) ? req.user.roles : [];
    const permitted = allowed.some(role => currentRoles.includes(role));
    if (!permitted) return res.status(403).json({ message: 'forbidden' });
    next();
  };
}

function hasRole(req, ...allowed) {
  const currentRoles = Array.isArray(req.user?.roles) ? req.user.roles : [];
  return allowed.some(role => currentRoles.includes(role));
}

function canAccessUser(req, userId) {
  if (!userId) return false;
  if (req.user?.id === userId) return true;
  return hasRole(req, 'admin', 'project_manager', 'foreman');
}

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

// ---------------------------------------------------------------------------
// Authentication
// ---------------------------------------------------------------------------
const signupSchema = z.object({
  full_name: z.string().min(1).max(120),
  phone: z.string().regex(/^[+0-9]{8,15}$/),
  email: z.string().email().optional().or(z.literal('')),
  password: z.string().min(8)
});

app.post('/api/auth/signup', async (req, res) => {
  try {
    const payload = signupSchema.parse(req.body ?? {});
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
      return res.status(created.error.status).json({ message: created.error.message });
    }

    res.status(201).json({ ...created.user, role: 'worker' });
  } catch (error) {
    if (error?.issues) return res.status(400).json({ message: 'Invalid input', errors: error.issues });
    console.error(error);
    res.status(500).json({ message: 'Server error' });
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

    if (!user) return res.status(401).json({ message: 'invalid_credentials' });

    const isMatch = await bcrypt.compare(parsed.password, user.password_hash ?? '');
    if (!isMatch) return res.status(401).json({ message: 'invalid_credentials' });

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

    const dataSql = `
      SELECT id, full_name, phone, email, status, created_at, last_login
      FROM users
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT ${params.limit} OFFSET ${params.offset}
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
         u.full_name AS assignee_name
       FROM tasks t
       JOIN projects p ON p.id = t.project_id
       LEFT JOIN sites s ON s.id = t.site_id
       LEFT JOIN users u ON u.id = t.assignee_user_id
       ${whereClause}
       ORDER BY t.due_date ASC, t.title ASC
       LIMIT ${params.limit} OFFSET ${params.offset}`,
      values
    );

    res.json({ total, limit: params.limit, offset: params.offset, items });
  } catch (error) {
    console.error(error);
    res.status(400).json({ message: 'Invalid query' });
  }
});

// Endpoint for workers to get "My Tasks"
app.get('/api/my-tasks', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const taskRows = await query(
      `SELECT
         t.id, t.title, t.priority, t.status, t.due_date,
         t.project_id, p.name AS project_name,
         t.site_id, s.name AS site_name,
         t.assignee_user_id
       FROM tasks t
       JOIN projects p ON p.id = t.project_id
       LEFT JOIN sites s ON s.id = t.site_id
       WHERE t.assignee_user_id = ?
       ORDER BY t.created_at DESC`,
      [userId]
    );

    // Map to format suitable for frontend
    const tasks = taskRows.map(row => ({
      id: row.id,
      title: row.title,
      priority: row.priority,
      status: row.status,
      dueDate: toISODateString(row.due_date),
      projectId: row.project_id,
      projectName: row.project_name, // Map for UI
      siteId: row.site_id,
      siteName: row.site_name
    }));

    res.json(tasks);
  } catch (error) {
    console.error('Error fetching my tasks:', error);
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
  due_date: z.coerce.date().optional()
});

app.post('/api/tasks', requireAuth, authorizeRoles('admin', 'project_manager'), async (req, res) => {
  try {
    const payload = createTaskSchema.parse(req.body ?? {});
    const taskId = randomUUID();
    await execute(
      `INSERT INTO tasks(id, project_id, site_id, title, priority, status, assignee_user_id, due_date)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
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

    const items = await query(
      `SELECT id, full_name, phone, email, status, payload, created_at, updated_at
       FROM signup_forms
       ${whereClause}
       ORDER BY created_at DESC
       LIMIT ${params.limit} OFFSET ${params.offset}`,
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
      const workerResult = await execute(workerSql, workerValues, connection);
      const workerId = workerResult.insertId;
      if (!workerId) throw new Error('worker_insert_failed');

      const accountData = filterObjectByColumns(
        {
          worker_id: workerId,
          email: normalizedEmail,
          password_hash: passwordHash
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
  startAt: z.union([z.string().min(1), z.null()]).optional(),
  endAt: z.union([z.string().min(1), z.null()]).optional(),
  frequencyMonths: z.union([z.coerce.number().int().min(1).max(24), z.null()]).optional()
}).superRefine((data, ctx) => {
  if (data.startAt && data.endAt) {
    const start = new Date(data.startAt);
    const end = new Date(data.endAt);
    if (!Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime()) && start > end) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'start_after_end',
        path: ['startAt']
      });
    }
  }
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
      start_at DATETIME(6) NULL,
      end_at DATETIME(6) NULL,
      frequency_months INT UNSIGNED NULL,
      created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
      updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
      PRIMARY KEY (id),
      KEY idx_assessment_rounds_category (category),
      KEY idx_assessment_rounds_start_at (start_at),
      KEY idx_assessment_rounds_created_at (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
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

function mapAssessmentRoundRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    title: row.title ?? null,
    category: row.category ?? null,
    description: row.description ?? null,
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

function sanitizeAssessmentRoundPayload(payload) {
  return {
    title: toNullableString(payload.title),
    category: toNullableString(payload.category),
    description: toNullableString(payload.description),
    questionCount: Number(payload.questionCount) || 0,
    startAt: parseDateTimeInput(payload.startAt),
    endAt: parseDateTimeInput(payload.endAt),
    frequencyMonths: payload.frequencyMonths === null || payload.frequencyMonths === undefined
      ? null
      : Number(payload.frequencyMonths)
  };
}

async function fetchAssessmentRoundById(roundId, connection) {
  const row = await queryOne(
    `SELECT id, title, category, description, question_count, start_at, end_at, frequency_months, created_at, updated_at
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
    `SELECT id, title, category, description, question_count, start_at, end_at, frequency_months, created_at, updated_at
     FROM assessment_rounds
     ORDER BY start_at IS NULL ASC, start_at ASC, created_at DESC`,
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
    if (payload.startAt && !sanitized.startAt) {
      return res.status(400).json({ message: 'invalid_start_at' });
    }
    if (payload.endAt && !sanitized.endAt) {
      return res.status(400).json({ message: 'invalid_end_at' });
    }
    if (sanitized.startAt && sanitized.endAt && sanitized.endAt <= sanitized.startAt) {
      return res.status(400).json({ message: 'end_before_start' });
    }

    const roundId = randomUUID();
    await execute(
      `INSERT INTO assessment_rounds (id, title, category, description, question_count, start_at, end_at, frequency_months)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      , [
        roundId,
        sanitized.title,
        sanitized.category,
        sanitized.description,
        sanitized.questionCount,
        sanitized.startAt,
        sanitized.endAt,
        sanitized.frequencyMonths
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

    const exists = await queryOne('SELECT id FROM assessment_rounds WHERE id = ? LIMIT 1', [roundId]);
    if (!exists) {
      return res.status(404).json({ message: 'not_found' });
    }

    const payload = assessmentRoundUpsertSchema.parse(req.body ?? {});
    const sanitized = sanitizeAssessmentRoundPayload(payload);

    if (!sanitized.title) {
      return res.status(400).json({ message: 'invalid_title' });
    }
    if (payload.startAt && !sanitized.startAt) {
      return res.status(400).json({ message: 'invalid_start_at' });
    }
    if (payload.endAt && !sanitized.endAt) {
      return res.status(400).json({ message: 'invalid_end_at' });
    }
    if (sanitized.startAt && sanitized.endAt && sanitized.endAt <= sanitized.startAt) {
      return res.status(400).json({ message: 'end_before_start' });
    }

    await execute(
      `UPDATE assessment_rounds
       SET title = ?, category = ?, description = ?, question_count = ?, start_at = ?, end_at = ?, frequency_months = ?, updated_at = NOW(6)
       WHERE id = ?`,
      [
        sanitized.title,
        sanitized.category,
        sanitized.description,
        sanitized.questionCount,
        sanitized.startAt,
        sanitized.endAt,
        sanitized.frequencyMonths,
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
// Question_Structural API
// ---------------------------------------------------------------------------

async function ensureQuestionStructuralSchema(connection) {
  const executor = connection ?? pool;
  await executor.execute(`
    CREATE TABLE IF NOT EXISTS question_Structural (
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
      KEY idx_question_structural_skill (skill_type),
      KEY idx_question_structural_difficulty (difficulty_level)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
}

let questionStructuralSchemaPromise = null;

function ensureQuestionStructuralSchemaReady(connection) {
  if (!questionStructuralSchemaPromise) {
    questionStructuralSchemaPromise = ensureQuestionStructuralSchema(connection).catch(error => {
      console.error('[question-structural] Failed to ensure schema', error);
      questionStructuralSchemaPromise = null;
      throw error;
    });
  }
  return questionStructuralSchemaPromise;
}

function mapQuestionStructuralRow(row) {
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

async function fetchQuestionStructuralById(questionId, connection) {
  const row = await queryOne(
    `SELECT id, question_text, choice_a, choice_b, choice_c, choice_d, answer, difficulty_level, skill_type
     FROM question_Structural
     WHERE id = ?
     LIMIT 1`,
    [questionId],
    connection
  );
  return mapQuestionStructuralRow(row);
}

async function fetchQuestionStructurals(connection) {
  const rows = await query(
    `SELECT id, question_text, choice_a, choice_b, choice_c, choice_d, answer, difficulty_level, skill_type
     FROM question_Structural
     ORDER BY id ASC`,
    [],
    connection
  );
  return rows.map(mapQuestionStructuralRow).filter(Boolean);
}

app.get('/api/question-structural/all', requireAuth, authorizeRoles('admin'), async (_req, res) => {
  try {
    // ไม่ต้องสร้างตารางใหม่ เพราะตารางมีอยู่แล้วใน phpMyAdmin
    // await ensureQuestionStructuralSchemaReady();
    const items = await fetchQuestionStructurals();
    console.log(`[question-structural] Fetched ${items.length} items`); // Debug log
    res.json(items);
  } catch (error) {
    console.error('[question-structural] Error:', error);
    res.status(500).json({ message: 'Server error' });
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
  subcategory: z.string().max(100).optional().nullable(),
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
    subcategory: row.subcategory || null,
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
         q.subcategory,
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
      `SELECT q.id, q.text, q.category, q.subcategory, q.difficulty, q.version, q.active,
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
        'INSERT INTO questions (id, text, category, subcategory, difficulty, version, active) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [
          questionId,
          payload.text,
          payload.category || null,
          payload.subcategory || null,
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
      `SELECT q.id, q.text, q.category, q.subcategory, q.difficulty, q.version, q.active,
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
  subcategory: z.string().max(100).optional().nullable(),
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
        subcategory: payload.subcategory !== undefined ? payload.subcategory : undefined,
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
      `SELECT q.id, q.text, q.category, q.subcategory, q.difficulty, q.version, q.active,
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
  })).min(0)
});

app.get('/api/assessments/rounds/active', requireAuth, async (req, res) => {
  try {
    await ensureAssessmentSchemaReady();

    const now = new Date();
    const rounds = await query(
      'SELECT id, title, category, description, question_count, start_at, end_at, frequency_months, created_at FROM assessment_rounds ORDER BY created_at DESC'
    );
    const activeRound = rounds.find((round) => {
      const startOk = !round.start_at || new Date(round.start_at) <= now;
      const endOk = !round.end_at || new Date(round.end_at) >= now;
      return startOk && endOk;
    }) || null;

    const requestedLimit = Number(req.query.limit);
    const limit = Number.isFinite(requestedLimit)
      ? Math.min(200, Math.max(1, Math.floor(requestedLimit)))
      : Math.min(200, Math.max(1, Math.floor(activeRound?.question_count ?? 60)));

    const category = typeof req.query.category === 'string' && req.query.category.trim()
      ? req.query.category.trim()
      : (activeRound?.category || null);

    const whereParts = ['q.active = 1'];
    const values = [];
    if (category) {
      whereParts.push('q.category = ?');
      values.push(category);
    }

    const questions = await query(
      `SELECT q.id, q.text
       FROM questions q
       WHERE ${whereParts.join(' AND ')}
       ORDER BY RAND()
       LIMIT ?`,
      [...values, limit]
    );

    const questionIds = questions.map((row) => row.id);
    let options = [];
    if (questionIds.length > 0) {
      options = await query(
        'SELECT id, question_id, text FROM question_options WHERE question_id IN (?) ORDER BY created_at ASC',
        [questionIds]
      );
    }

    const optionsByQuestion = new Map();
    for (const option of options) {
      if (!optionsByQuestion.has(option.question_id)) {
        optionsByQuestion.set(option.question_id, []);
      }
      optionsByQuestion.get(option.question_id).push({ id: option.id, text: option.text });
    }

    res.json({
      round: activeRound,
      questions: questions.map((q) => ({
        id: q.id,
        text: q.text,
        options: optionsByQuestion.get(q.id) || []
      }))
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

app.post('/api/assessments', requireAuth, async (req, res) => {
  try {
    const payload = createAssessmentSchema.parse(req.body ?? {});
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
// Dashboard metrics
// ---------------------------------------------------------------------------
app.get('/api/dashboard/project-task-counts', requireAuth, authorizeRoles('project_manager'), async (_req, res) => {
  try {
    const rows = await query(
      `SELECT
         p.id AS project_id,
         p.name AS project_name,
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

// ---------------------------------------------------------------------------
// Server bootstrap
// ---------------------------------------------------------------------------
app.listen(Number(PORT), () => {
  console.log(`SkillGauge API listening on http://localhost:${PORT}`);
});

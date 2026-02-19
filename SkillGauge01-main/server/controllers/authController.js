import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { queryOne, writeAuditLog } from '../utils/db.js';

function normalizeIdentifier(identifier) {
  if (!identifier) return { phone: '', email: '' };
  const value = String(identifier).trim();
  if (value.includes('@')) return { phone: '', email: value.toLowerCase() };
  return { phone: value, email: '' };
}

async function resolveUserRoles(userId) {
  const row = await queryOne(
    `SELECT JSON_ARRAYAGG(r.key) AS roles
     FROM user_roles ur
     JOIN roles r ON r.id = ur.role_id
     WHERE ur.user_id = ?`,
    [userId]
  );
  if (!row || !row.roles) return [];
  if (Array.isArray(row.roles)) return row.roles;
  try {
    const parsed = JSON.parse(row.roles);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function resolveWorkerIdForUserRecord(user) {
  if (!user || typeof user !== 'object') return null;

  const directNumeric = Number(user.id);
  if (Number.isFinite(directNumeric)) return directNumeric;

  if (user.email) {
    const accountRow = await queryOne(
      `SELECT worker_id
       FROM worker_accounts
       WHERE LOWER(email) = LOWER(?)
       LIMIT 1`,
      [user.email]
    );
    const workerId = Number(accountRow?.worker_id);
    if (Number.isFinite(workerId)) return workerId;
  }

  if (user.phone) {
    const workerRow = await queryOne(
      `SELECT id
       FROM workers
       WHERE phone = ?
       LIMIT 1`,
      [user.phone]
    );
    const workerId = Number(workerRow?.id);
    if (Number.isFinite(workerId)) return workerId;
  }

  if (user.full_name) {
    const workerRow = await queryOne(
      `SELECT w.id
       FROM workers w
       LEFT JOIN task_worker_assignments twa ON twa.worker_id = w.id
       WHERE REPLACE(TRIM(w.full_name), ' ', '') = REPLACE(TRIM(?), ' ', '')
          OR w.full_name LIKE ?
       GROUP BY w.id
       ORDER BY COUNT(twa.id) DESC, w.id DESC
       LIMIT 1`,
      [user.full_name, `%${String(user.full_name).trim()}%`]
    );
    const workerId = Number(workerRow?.id);
    if (Number.isFinite(workerId)) return workerId;
  }

  return null;
}

  function normalizeWorkerRole(roleCode) {
    if (!roleCode) return 'worker';
    const value = String(roleCode).toLowerCase();
    if (value === 'admin') return 'admin';
    if (value === 'project_manager' || value === 'pm') return 'project_manager';
    if (value === 'foreman' || value === 'fm') return 'foreman';
    return value === 'worker' || value === 'wk' ? 'worker' : 'worker';
  }

export const authController = {
  async login(req, res) {
    try {
      const { identifier, password } = req.body || {};
      if (!identifier || !password) {
        return res.status(400).json({ error: 'Missing identifier or password' });
      }

      const { phone, email } = normalizeIdentifier(identifier);

      let user = await queryOne(
        `SELECT id, full_name, phone, email, password_hash, status
         FROM users
         WHERE phone = ? OR LOWER(email) = ?
         LIMIT 1`,
        [phone || '', email || '']
      );

      let roles = [];
      let source = 'users';

      if (!user && email) {
        const worker = await queryOne(
          `SELECT a.worker_id AS id, w.full_name, w.phone, a.email, a.password_hash, a.status, w.role_code
           FROM worker_accounts a
           JOIN workers w ON w.id = a.worker_id
           WHERE LOWER(a.email) = LOWER(?)
           LIMIT 1`,
          [email]
        );

        if (worker) {
          user = worker;
          source = 'worker_accounts';
          roles = [normalizeWorkerRole(worker.role_code)];
        }
      }

      if (!user || !user.password_hash) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      const match = await bcrypt.compare(password, user.password_hash);
      if (!match) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      if (user.status && user.status !== 'active') {
        return res.status(403).json({ error: 'Account is inactive' });
      }

      if (source === 'users') {
        roles = await resolveUserRoles(user.id);
        if (!roles.length) roles = ['worker'];
      }

      const normalizedRoles = Array.isArray(roles)
        ? roles.map((role) => String(role || '').toLowerCase())
        : [];
      const isWorkerLogin = normalizedRoles.includes('worker') || normalizedRoles.includes('wk');
      let workerId = null;

      if (source === 'worker_accounts') {
        const directId = Number(user.id);
        workerId = Number.isFinite(directId) ? directId : null;
      } else if (isWorkerLogin) {
        try {
          workerId = await resolveWorkerIdForUserRecord(user);
        } catch (mappingError) {
          console.warn('Worker mapping failed at login', mappingError?.message || mappingError);
        }
      }

      const token = jwt.sign(
        { id: user.id, roles, full_name: user.full_name || '', worker_id: workerId },
        env.JWT_SECRET,
        { expiresIn: env.JWT_EXPIRES_IN }
      );

      await writeAuditLog({
        req,
        userId: source === 'users' ? user.id : null,
        action: 'เข้าสู่ระบบ',
        details: {
          event: 'login_success',
          source,
          user_name: user.full_name || '',
          identifier,
          roles
        }
      });

      res.json({
        token,
        user: {
          id: user.id,
          full_name: user.full_name || '',
          phone: user.phone || '',
          email: user.email || '',
          roles,
          worker_id: workerId
        }
      });
    } catch (error) {
      console.error('Login failed', error);
      res.status(500).json({ error: 'Login failed' });
    }
  }
};

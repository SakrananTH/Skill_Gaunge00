import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { queryOne } from '../utils/db.js';

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

  function normalizeWorkerRole(roleCode) {
    if (!roleCode) return 'worker';
    const value = String(roleCode).toLowerCase();
    if (value === 'admin') return 'admin';
    if (value === 'project_manager' || value === 'pm') return 'pm';
    if (value === 'foreman' || value === 'fm') return 'fm';
    return value === 'worker' || value === 'wk' ? 'wk' : 'worker';
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

      const token = jwt.sign(
        { id: user.id, roles, full_name: user.full_name || '' },
        env.JWT_SECRET,
        { expiresIn: env.JWT_EXPIRES_IN }
      );

      res.json({
        token,
        user: {
          id: user.id,
          full_name: user.full_name || '',
          phone: user.phone || '',
          email: user.email || '',
          roles
        }
      });
    } catch (error) {
      console.error('Login failed', error);
      res.status(500).json({ error: 'Login failed' });
    }
  }
};

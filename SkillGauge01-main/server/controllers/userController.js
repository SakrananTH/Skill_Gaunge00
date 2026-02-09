import { query, queryOne, execute, buildUpdateClause, writeAuditLog } from '../utils/db.js';
import { userListQuerySchema, createUserSchema, updateUserSchema, roleKeySchema } from '../schemas/userSchemas.js';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';

export const userController = {
  async listUsers(req, res) {
      try {
          const { limit, offset, search, status } = userListQuerySchema.parse(req.query);
          
          let sql = `SELECT u.id, u.full_name, u.email, u.phone, u.status, u.created_at,
                     (SELECT JSON_ARRAYAGG(r.key) FROM user_roles ur JOIN roles r ON ur.role_id = r.id WHERE ur.user_id = u.id) as roles
                     FROM users u WHERE 1=1`;
          const params = [];

          if (status) {
              sql += ' AND u.status = ?';
              params.push(status);
          }
          if (search) {
              sql += ' AND (u.full_name LIKE ? OR u.email LIKE ? OR u.phone LIKE ?)';
              params.push(`%${search}%`, `%${search}%`, `%${search}%`);
          }

          sql += ' ORDER BY u.created_at DESC LIMIT ? OFFSET ?';
          params.push(limit, offset);

          const users = await query(sql, params);
          
          // Count total
          const [countRow] = await query('SELECT COUNT(*) as total FROM users'); // simplified count (needs filtering too ideally)
          
          res.json({
              data: users,
              meta: { total: countRow.total, limit, offset }
          });
      } catch (error) {
           res.status(500).json({ error: 'List users failed' });
      }
  },

  async createUser(req, res) {
      try {
           const payload = createUserSchema.parse(req.body);
           // ... Validation checks (duplicate phone/email)
           
           const salt = await bcrypt.genSalt(10);
           const hash = await bcrypt.hash(payload.password, salt);
           const userId = randomUUID();

           await execute(
               `INSERT INTO users (id, full_name, phone, email, password_hash, status, created_at)
                VALUES (?, ?, ?, ?, ?, ?, NOW())`,
               [userId, payload.full_name, payload.phone, payload.email, hash, payload.status]
           );

           // Assign roles
           if (payload.roles && payload.roles.length > 0) {
               const roleRows = await query('SELECT id FROM roles WHERE `key` IN (?)', [payload.roles]);
               for (const r of roleRows) {
                   await execute('INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)', [userId, r.id]);
               }
           }

           await writeAuditLog({ req, action: 'USER_CREATE', details: { id: userId, name: payload.full_name }});
           res.status(201).json({ id: userId });
      } catch (error) {
          if (error.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Duplicate entry' });
          if (error.issues) return res.status(400).json({ errors: error.issues });
          console.error(error);
          res.status(500).json({ error: 'Create user failed' });
      }
  }
};

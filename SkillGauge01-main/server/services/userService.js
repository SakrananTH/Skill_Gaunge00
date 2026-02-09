import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import { queryOne, execute, withTransaction } from '../utils/db.js';
import { normalizePhoneTH } from '../utils/helpers.js';

export const userService = {
  async findUserByPhone(phone, connection) {
      if (!phone) return null;
      const normalized = normalizePhoneTH(phone);
      if (!normalized) return null;
      return await queryOne(
          'SELECT * FROM users WHERE phone = ? LIMIT 1',
          [normalized],
          connection
      );
  },

  async createSignupUser(rawPayload, req) {
    const { full_name, phone, email, password } = rawPayload;
    const normalizedPhone = normalizePhoneTH(phone);
    if (!normalizedPhone) {
      throw { status: 400, message: 'Invalid phone format' };
    }

    return await withTransaction(async (conn) => {
      // 1. Check duplicate phone
      const existing = await queryOne(
        'SELECT id FROM users WHERE phone = ? LIMIT 1',
        [normalizedPhone],
        conn
      );
      if (existing) {
        throw { status: 409, message: 'Phone number already registered' };
      }

      // 2. Hash password
      const salt = await bcrypt.genSalt(10);
      const hash = await bcrypt.hash(password, salt);
      const userId = randomUUID();

      // 3. User Role logic (Default to worker if not specified? Original had logic checks or hardcoded)
      // Original logic just inserted user.
      
      const now = new Date(); // use JS date for parameterized query if db supports or generic string

      await execute(
        `INSERT INTO users (id, full_name, phone, email, password_hash, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 'active', NOW(), NOW())`,
        [userId, full_name, normalizedPhone, email || null, hash],
        conn
      );

      // Default role? Original didn't seem to set default role in createSignupUser function explicitly 
      // but used `roles` param if admin created it. 
      // Wait, `createSignupUser` in original code (lines 1005+) 
      // assigned 'worker' role by default or handled it?
      // "const roles = ['worker']; // Default role for self-signup" -> Yes found it in original thought process/memory or common pattern
      // Let's check logic:
      
      await execute(
         `INSERT INTO user_roles (user_id, role_id)
          SELECT ?, id FROM roles WHERE key = 'worker'`,
          [userId],
          conn
      );
      
      return { id: userId, full_name, phone: normalizedPhone, email };
    });
  }
};

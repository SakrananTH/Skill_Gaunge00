import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { env } from '../config/env.js';
import { queryOne, query, writeAuditLog } from '../utils/db.js';
import { normalizePhoneTH, getRequestIp, getRoleLabel } from '../utils/helpers.js';
import { signupSchema, loginSchema } from '../schemas/authSchemas.js';
import { userService } from '../services/userService.js';
import { ADMIN_BYPASS } from '../config/constants.js';

export const authController = {
  async signup(req, res) {
    try {
      const payload = signupSchema.parse(req.body);
      const user = await userService.createSignupUser(payload, req);
      
      await writeAuditLog({
        req,
        action: 'AUTH_SIGNUP',
        details: { userId: user.id },
        username: user.phone,
        role: 'guest'
      });

      res.status(201).json({ message: 'User created successfully', userId: user.id });
    } catch (error) {
       if (error.status) {
           return res.status(error.status).json({ error: error.message });
       }
       if (error.issues) { // Zod error
           return res.status(400).json({ error: 'Validation Error', details: error.issues });
       }
       console.error('Signup error:', error);
       res.status(500).json({ error: 'Internal Server Error' });
    }
  },

  async login(req, res) {
    try {
      const { identifier, phone, password } = loginSchema.parse(req.body);
      let targetPhone = phone;

      // Logic to resolve identifier/phone
      if (!targetPhone && identifier) {
          // simple heuristic
          if (/^[0-9+]+$/.test(identifier)) {
              targetPhone = identifier;
          }
      }
      
      const normalizedPhone = normalizePhoneTH(targetPhone);

      // Admin Bypass
      if (
          normalizedPhone === ADMIN_BYPASS.normalizedPhone && 
          password === ADMIN_BYPASS.password
      ) {
           const token = jwt.sign(
               { 
                   id: ADMIN_BYPASS.id, 
                   roles: ['admin', 'project_manager'], 
                   full_name: ADMIN_BYPASS.fullName 
               },
               env.JWT_SECRET,
               { expiresIn: env.JWT_EXPIRES_IN }
           );
           
           return res.json({
               token,
               user: {
                   id: ADMIN_BYPASS.id,
                   full_name: ADMIN_BYPASS.fullName,
                   roles: ['admin', 'project_manager'],
                   roles_label: ['ผู้ดูแลระบบ', 'ผู้จัดการโครงการ (PM)']
               }
           });
      }

      if (!normalizedPhone) {
          return res.status(400).json({ error: 'Invalid phone number format' });
      }

      const user = await queryOne(
          `SELECT u.*, 
           (SELECT JSON_ARRAYAGG(r.key) 
            FROM user_roles ur 
            JOIN roles r ON r.id = ur.role_id 
            WHERE ur.user_id = u.id) as roles
           FROM users u 
           WHERE u.phone = ? 
           LIMIT 1`,
          [normalizedPhone]
      );

      if (!user) {
          // Fake delay/verify to prevent timing attacks?
          await bcrypt.compare(password, '$2a$10$abcdefghijklmnopqrstuvwxyz123456'); 
          return res.status(401).json({ error: 'Invalid credentials' });
      }

       const isMatch = await bcrypt.compare(password, user.password_hash || '');
       if (!isMatch) {
            await writeAuditLog({
                req,
                username: normalizedPhone,
                action: 'AUTH_LOGIN_FAILED',
                status: 'failure',
                details: 'Incorrect password'
            });
            return res.status(401).json({ error: 'Invalid credentials' });
       }

       if (user.status !== 'active') {
            return res.status(403).json({ error: 'Account is inactive' });
       }

       const roles = user.roles || []; // MySQL JSON might return null if no roles
       // Clean up roles (if JSON_ARRAYAGG returns null/string weirdness)
       const rolesArray = Array.isArray(roles) ? roles : [];
       
       const token = jwt.sign(
           { id: user.id, roles: rolesArray, full_name: user.full_name },
           env.JWT_SECRET,
           { expiresIn: env.JWT_EXPIRES_IN }
       );

       await writeAuditLog({
          req,
          username: user.full_name,
          role: rolesArray[0] || 'user',
          action: 'AUTH_LOGIN',
          details: { userId: user.id }
       });

       res.json({
           token,
           user: {
               id: user.id,
               full_name: user.full_name,
               roles: rolesArray,
               roles_label: rolesArray.map(r => getRoleLabel(r))
           }
       });

    } catch (error) {
        if (error.issues) return res.status(400).json({ error: 'Validation Error', details: error.issues });
        console.error('Login error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
  }
};

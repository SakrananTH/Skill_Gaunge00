const { validationResult } = require('express-validator');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const JWT_SECRET = process.env.JWT_SECRET || 'please_change_this_secret';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

// --- Register ---
exports.registerUser = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  // รับค่าทั้งหมดจาก Body
  const {
    prefix, first_name, last_name, citizen_id, technician_type,
    phone_number, birth_date, address_details, zip_code, sub_district, province,
    email, password, role
  } = req.body;

  try {
    // เช็ค Email ซ้ำ
    const existingUser = await User.findByEmail(email);
    if (existingUser) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    // สร้าง User
    const newUser = await User.create({
      prefix, first_name, last_name, citizen_id, technician_type,
      phone_number, birth_date, address_details, zip_code, sub_district, province,
      email, password, role
    });

    res.status(201).json(newUser);

  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Server error' });
  }
};

// --- Login ---
exports.loginUser = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { identifier, email, password } = req.body;

  const loginEmail = typeof email === 'string' ? email.trim() : '';
  const loginPhone = typeof identifier === 'string' ? identifier.trim() : '';

  if (!loginEmail && !loginPhone) {
    return res.status(400).json({ error: 'Email or phone is required' });
  }

  try {
    let user = null;
    let loginMode = '';

    if (loginEmail) {
      user = await User.findByEmail(loginEmail);
      loginMode = 'email';
      if (user && user.role === 'admin') {
        return res.status(403).json({ error: 'Admin must login with phone number' });
      }
    } else {
      user = await User.findByPhone(loginPhone);
      loginMode = 'phone';
    }

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    if (loginMode === 'phone' && user.role !== 'admin') {
      return res.status(403).json({ error: 'Please login with email' });
    }

    if (loginMode === 'email' && user.role === 'admin') {
      return res.status(403).json({ error: 'Admin must login with phone number' });
    }

    if (user.source === 'worker_accounts' && user.account_status && user.account_status !== 'active') {
      return res.status(403).json({ error: 'Account is inactive' });
    }

    const match = User.comparePassword(password, user.password);
    if (!match) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const payload = {
      id: user.id,
      email: user.email,
      role: user.role
    };

    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

    const { password: _, ...userWithoutPassword } = user;

    res.json({
      token,
      user: userWithoutPassword
    });

  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Server error' });
  }
};
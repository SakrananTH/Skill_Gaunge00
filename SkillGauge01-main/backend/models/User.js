const bcrypt = require('bcryptjs');
const pool = require('../config/db');

function buildPhoneCandidates(input) {
  const raw = String(input || '').trim();
  if (!raw) {
    return [];
  }

  const candidates = new Set([raw]);
  const digitsOnly = raw.replace(/\D/g, '');

  if (digitsOnly) {
    candidates.add(digitsOnly);

    if (digitsOnly.startsWith('66') && digitsOnly.length >= 10) {
      const local = digitsOnly.slice(2);
      if (local.length) {
        candidates.add(`0${local}`);
        candidates.add(`+66${local}`);
      }
      candidates.add(`+${digitsOnly}`);
    } else if (digitsOnly.startsWith('0') && digitsOnly.length >= 9) {
      const withoutZero = digitsOnly.slice(1);
      if (withoutZero.length) {
        candidates.add(`+66${withoutZero}`);
      }
    }
  }

  return Array.from(candidates).filter(Boolean);
}

function mapDbUserRow(row) {
  if (!row) {
    return null;
  }
  return {
    id: row.id,
    prefix: row.prefix,
    first_name: row.first_name,
    last_name: row.last_name,
    citizen_id: row.citizen_id,
    technician_type: row.trade_type, // Map จาก DB trade_type
    phone_number: row.phone_number,
    birth_date: row.birth_date,
    address_details: row.address_details,
    zip_code: row.zip_code,
    sub_district: row.sub_district,
    province: row.province,
    email: row.email,
    password: row.password,
    role: row.role_code, // Map จาก DB role_code
    source: 'dbuser'
  };
}

function mapWorkerAccountRow(row) {
  if (!row) {
    return null;
  }

  const fullName = row.full_name || '';
  return {
    id: row.worker_id,
    prefix: null,
    first_name: fullName,
    last_name: null,
    citizen_id: row.national_id || null,
    technician_type: row.trade_type || null,
    phone_number: row.phone || null,
    birth_date: row.birth_date || null,
    address_details: row.current_address || null,
    zip_code: row.postal_code || null,
    sub_district: row.subdistrict || null,
    province: row.province || null,
    email: row.email,
    password: row.password_hash,
    role: row.role_code || 'worker',
    account_status: row.status,
    source: 'worker_accounts'
  };
}

async function findWorkerAccountByEmail(email) {
  const normalized = String(email || '').trim();
  if (!normalized) {
    return null;
  }

  try {
    const sql = `
      SELECT 
        a.worker_id,
        a.email,
        a.password_hash,
        a.status,
        w.full_name,
        w.phone,
        w.role_code,
        w.trade_type,
        w.national_id,
        w.birth_date,
        w.postal_code,
        w.subdistrict,
        w.province,
        w.current_address
      FROM worker_accounts a
      INNER JOIN workers w ON w.id = a.worker_id
      WHERE LOWER(a.email) = LOWER(?)
      LIMIT 1
    `;
    const [rows] = await pool.query(sql, [normalized]);
    return mapWorkerAccountRow(rows[0]);
  } catch (err) {
    if (err?.code !== 'ER_NO_SUCH_TABLE') {
      console.error('Error finding worker by email:', err);
    }
    return null;
  }
}

async function findDbUserByEmail(email) {
  const normalized = String(email || '').trim();
  if (!normalized) {
    return null;
  }

  try {
    const sql = `
      SELECT 
        id, prefix, first_name, last_name, citizen_id, trade_type,
        phone_number, birth_date, address_details, zip_code, sub_district, province,
        email, password, role_code
      FROM dbuser 
      WHERE LOWER(email) = LOWER(?)
      LIMIT 1
    `;
    const [rows] = await pool.query(sql, [normalized]);
    return mapDbUserRow(rows[0]);
  } catch (err) {
    console.error('Error finding user by email:', err);
    throw err;
  }
}

// ค้นหา User ด้วย Email (เปรียบเทียบแบบไม่แยกตัวพิมพ์เล็กใหญ่) รองรับทั้ง worker และ admin
exports.findByEmail = async (email) => {
  const workerAccount = await findWorkerAccountByEmail(email);
  if (workerAccount) {
    return workerAccount;
  }

  return findDbUserByEmail(email);
};

exports.findByPhone = async (phone) => {
  const candidates = buildPhoneCandidates(phone);
  if (!candidates.length) {
    return null;
  }

  try {
    const placeholders = candidates.map(() => '?').join(',');
    const sql = `
      SELECT 
        id, prefix, first_name, last_name, citizen_id, trade_type,
        phone_number, birth_date, address_details, zip_code, sub_district, province,
        email, password, role_code
      FROM dbuser 
      WHERE phone_number IN (${placeholders})
        AND role_code = 'admin'
      LIMIT 1
    `;
    const [rows] = await pool.query(sql, candidates);
    return mapDbUserRow(rows[0]);
  } catch (err) {
    console.error('Error finding admin by phone:', err);
    throw err;
  }
};

exports.findByIdentifier = async (identifier) => {
  const raw = String(identifier || '').trim();
  if (!raw) {
    return null;
  }

  if (raw.includes('@')) {
    return exports.findByEmail(raw);
  }

  const admin = await exports.findByPhone(raw);
  if (admin) {
    return admin;
  }

  return exports.findByEmail(raw);
};

// สร้าง User ใหม่
exports.create = async (userData) => {
  const {
    prefix, first_name, last_name, citizen_id, technician_type,
    phone_number, birth_date, address_details, zip_code, sub_district, province,
    email, password, role
  } = userData;

  try {
    const sql = `
      INSERT INTO dbuser (
        prefix, first_name, last_name, citizen_id, trade_type,
        phone_number, birth_date, address_details, zip_code, sub_district, province,
        email, password, role_code
      ) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    // กำหนดค่า default ให้ technician_type ถ้าไม่ได้ส่งมา
    const finalTechType = technician_type || 'ไม่มี';
    // กำหนดค่า default ให้ role ถ้าไม่ได้ส่งมา (เป็น worker)
    const finalRole = role || 'worker';

    const [result] = await pool.query(sql, [
      prefix, first_name, last_name, citizen_id, finalTechType,
      phone_number, birth_date, address_details, zip_code, sub_district, province,
      email, password, finalRole
    ]);

    return {
      id: result.insertId,
      ...userData,
      role: finalRole,
      technician_type: finalTechType,
      password: undefined // ไม่ส่งรหัสผ่านกลับไป
    };
  } catch (err) {
    console.error('Error creating user:', err);
    throw err;
  }
};

exports.comparePassword = (password, storedValue) => {
  const plain = String(password || '');
  const stored = String(storedValue || '');

  if (!stored) {
    return false;
  }

  if (stored.startsWith('$2a$') || stored.startsWith('$2b$') || stored.startsWith('$2y$')) {
    try {
      return bcrypt.compareSync(plain, stored);
    } catch (err) {
      console.error('Error comparing bcrypt password:', err);
      return false;
    }
  }

  return plain === stored;
};
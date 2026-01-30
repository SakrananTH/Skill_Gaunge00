const express = require('express');
const router = express.Router();
const db = require('../config/db'); // ตรวจสอบ path นี้ให้ตรงกับไฟล์ connect DB ของคุณ

// Helper function: ดึง IP Address ของผู้ใช้
const getIpAddress = (req) => {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) return forwarded.split(',')[0].trim();
  return req.socket.remoteAddress || null;
};

// ----------------------------------------------------------------------
// 1. POST /api/admin/audit-logs
// สำหรับบันทึก Log กิจกรรมต่างๆ
// ----------------------------------------------------------------------
router.post('/', async (req, res) => {
  try {
    const { action, details, status = 'success' } = req.body;

    // ดึงข้อมูลผู้ใช้จาก req.user (ถ้ามี Middleware Auth) หรือใช้ค่า Default
    const userId = req.user ? req.user.id : null;
    const username = req.user ? (req.user.username || req.user.email) : 'System/Admin';
    const role = req.user ? req.user.role : 'admin';
    const ipAddress = getIpAddress(req);

    const sql = `
      INSERT INTO audit_logs 
      (user_id, username, role, action, details, ip_address, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, NOW())
    `;

    await db.execute(sql, [
      userId, 
      username, 
      role, 
      action, 
      details, 
      ipAddress, 
      status
    ]);

    res.status(201).json({ success: true, message: 'Audit log saved successfully' });

  } catch (error) {
    console.error('Error saving audit log:', error);
    res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
});

// ----------------------------------------------------------------------
// 2. GET /api/admin/audit-logs
// สำหรับดึงข้อมูลไปแสดงในหน้า AdminAuditLog.js
// ----------------------------------------------------------------------
router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 10, search = '', status, startDate, endDate } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    // สร้าง Query แบบ Dynamic ตาม Filter
    let whereClause = 'WHERE 1=1';
    const params = [];

    if (search) {
      whereClause += ` AND (username LIKE ? OR action LIKE ? OR details LIKE ?)`;
      const term = `%${search}%`;
      params.push(term, term, term);
    }

    if (status && status !== 'all') {
      whereClause += ` AND status = ?`;
      params.push(status);
    }

    if (startDate) {
      whereClause += ` AND DATE(created_at) >= ?`;
      params.push(startDate);
    }

    if (endDate) {
      whereClause += ` AND DATE(created_at) <= ?`;
      params.push(endDate);
    }

    // 1. หาจำนวนรายการทั้งหมด (Total Count)
    const [countResult] = await db.execute(
      `SELECT COUNT(*) as total FROM audit_logs ${whereClause}`, 
      params
    );
    const total = countResult[0].total;

    // 2. ดึงข้อมูลตาม Page
    const sql = `
      SELECT * FROM audit_logs 
      ${whereClause} 
      ORDER BY created_at DESC 
      LIMIT ? OFFSET ?
    `;
    
    // เพิ่ม limit และ offset ต่อท้าย params
    const queryParams = [...params, Number(limit), Number(offset)];
    
    const [rows] = await db.execute(sql, queryParams);

    // Map ข้อมูลให้ตรงกับที่ Frontend ต้องการ
    const items = rows.map(row => ({
      id: row.id,
      timestamp: row.created_at,
      user: row.username || 'Unknown',
      role: row.role || '-',
      action: row.action,
      details: row.details,
      ip: row.ip_address,
      status: row.status
    }));

    res.json({ items, total });

  } catch (error) {
    console.error('Error fetching audit logs:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch logs' });
  }
});

module.exports = router;
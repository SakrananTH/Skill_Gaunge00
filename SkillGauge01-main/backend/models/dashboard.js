const express = require('express');
const router = express.Router();
const pool = require('../config/db');

// GET /api/admin/dashboard/stats
// (Endpoint เดิมสำหรับ KPI Cards - ใส่ไว้เพื่อให้ไฟล์สมบูรณ์)
router.get('/stats', async (req, res) => {
  try {
    // ในการใช้งานจริง ควร Query จาก DB เพื่อหาค่าเฉลี่ย
    // อันนี้ Mock ไว้ก่อนเพื่อให้ Frontend ไม่ Error 404
    const stats = {
      avgScore: 76.5,
      passRate: 88.2,
      belowThreshold: 5,
      weakestSkill: 'งานหลังคา (Roofing)',
      trend: {
        avgScore: '+1.2%',
        passRate: '+3.5%',
        belowThreshold: '-1'
      }
    };
    res.json(stats);
  } catch (error) {
    console.error('Dashboard stats error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// GET /api/admin/dashboard/skill-gap
// Endpoint ใหม่สำหรับดึงข้อมูลจาก View v_skill_gap_analysis
router.get('/skill-gap', async (req, res) => {
  try {
    const sql = 'SELECT * FROM v_skill_gap_analysis ORDER BY skill_gap DESC';
    const [rows] = await pool.query(sql);
    res.json(rows);
  } catch (error) {
    console.error('Error fetching skill gap analysis:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router;
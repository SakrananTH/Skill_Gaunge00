const mysql = require('mysql2/promise');
require('dotenv').config(); // โหลด .env เผื่อไว้

// สร้างและ export pool การเชื่อมต่อ
// เราจะใช้ค่าจาก .env ที่ถูกโหลดโดย index.js หลัก
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASS || '1234',
  database: process.env.DB_NAME || 'dbweb',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// พิมพ์ log เพื่อยืนยันว่าเชื่อมต่อสำเร็จ (optional)
pool.getConnection()
  .then(connection => {
    console.log('MySQL Database connected successfully!');
    connection.release();
  })
  .catch(err => {
    console.error('MySQL Database connection error:', err.message);
  });

module.exports = pool;
import 'dotenv/config';
import mysql from 'mysql2/promise';

const pool = mysql.createPool({
  host: process.env.MYSQL_HOST || 'localhost',
  port: Number(process.env.MYSQL_PORT) || 3306,
  database: process.env.MYSQL_DATABASE || 'admin-worker-registration',
  user: process.env.MYSQL_USER || 'root',
  password: process.env.MYSQL_PASSWORD || 'rootpassword',
  waitForConnections: true,
  connectionLimit: 1
});

const updates = [
  { phone: '+66853334444', hash: '$2a$10$ayx0DPLBCM19zlDKFuVBBOAe9yxq1wTLxBkNBrkhKUpPsis/XNRRK', role: 'PM' },
  { phone: '+66861234567', hash: '$2a$10$Uvvw6T3A8k57J1CY5Ar7IO1jejCxC9h6UWj1OBq3/9Rv9yp3Wc3iS', role: 'FM' },
  { phone: '+66869876543', hash: '$2a$10$mJfJoA6ty62i4eJWEfLlu.q9h4jGcr1ljS1Dw1fvdUiZreQRbLPI6', role: 'WK' }
];

(async () => {
  try {
    for (const { phone, hash, role } of updates) {
      const [result] = await pool.execute(
        'UPDATE users SET password_hash = ? WHERE phone = ?',
        [hash, phone]
      );
      console.log(`✓ Updated ${role} (${phone}) - ${result.affectedRows} row(s)`);
    }
    console.log('\n=== Login Credentials ===');
    console.log('Admin: 0863125891 / 0863503381');
    console.log('PM: +66853334444 / pm123456');
    console.log('FM: +66861234567 / fm123456');
    console.log('WK: +66869876543 / wk123456');
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await pool.end();
  }
})();

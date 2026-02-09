import { pool } from '../config/database.js';

export async function execute(sql, params = [], connection) {
  const executor = connection ?? pool;
  const [result] = await executor.execute(sql, params);
  return result;
}

export async function query(sql, params = [], connection) {
  const result = await execute(sql, params, connection);
  return Array.isArray(result) ? result : [];
}

export async function queryOne(sql, params = [], connection) {
  const rows = await query(sql, params, connection);
  return rows[0] ?? null;
}

export async function withTransaction(handler) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const result = await handler(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export function buildUpdateClause(data) {
  const entries = Object.entries(data).filter(([, value]) => value !== undefined);
  return {
    sets: entries.map(([column]) => `${column} = ?`),
    values: entries.map(([, value]) => value)
  };
}

export async function writeAuditLog({ req, username, role, action, details, status, connection }) {
  try {
    const ipAddress = req ? (req.ip || req.connection?.remoteAddress || 'unknown') : 'system';
    const userAgent = req ? (req.headers['user-agent'] || 'unknown') : 'system';
    
    // Minimal normalization if req is passed but username/role missing
    const finalUsername = username || (req?.user?.phone) || 'system';
    const finalRole = role || (req?.user?.roles?.[0]) || 'system';
    
    // Clean up details
    let detailsStr = '';
    if (typeof details === 'string') detailsStr = details;
    else if (details) detailsStr = JSON.stringify(details);

    await execute(
      `INSERT INTO audit_logs (username, role, action, details, status, ip_address, user_agent)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        finalUsername,
        finalRole,
        action,
        detailsStr,
        status || 'success',
        ipAddress,
        userAgent
      ],
      connection // Optional passing of connection to be transactional
    );
  } catch (error) {
    console.error('Audit log failed:', error);
    // Don't throw, we don't want to break the main flow for audit log failure
  }
}

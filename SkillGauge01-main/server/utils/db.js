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

export async function ensureAuditLogSchema(connection) {
  await execute(
    `CREATE TABLE IF NOT EXISTS audit_logs (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      actor_user_id CHAR(36) NULL,
      action VARCHAR(120) NOT NULL,
      details JSON NULL,
      ip_address VARCHAR(45) NULL,
      created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
      PRIMARY KEY (id),
      KEY idx_audit_logs_actor (actor_user_id),
      CONSTRAINT fk_audit_logs_actor FOREIGN KEY (actor_user_id) REFERENCES users(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    [],
    connection
  );
}

export async function writeAuditLog({ req, userId, action, details, connection }) {
  try {
    const ipAddress = req ? (req.ip || req.connection?.remoteAddress || null) : null;
    const rawActorUserId = userId || req?.user?.id || null;
    let actorUserId = null;
    if (rawActorUserId !== null && rawActorUserId !== undefined) {
      const userRow = await queryOne(
        'SELECT id FROM users WHERE id = ? LIMIT 1',
        [rawActorUserId],
        connection
      );
      if (userRow?.id) {
        actorUserId = userRow.id;
      }
    }
    let detailsJson = null;
    if (details !== undefined) {
      detailsJson = JSON.stringify(details);
    }

    await ensureAuditLogSchema(connection);
    await execute(
      `INSERT INTO audit_logs (actor_user_id, action, details, ip_address)
       VALUES (?, ?, ?, ?)`,
      [
        actorUserId,
        action,
        detailsJson,
        ipAddress
      ],
      connection
    );
  } catch (error) {
    console.error('Audit log failed:', error);
    // Don't throw, we don't want to break the main flow for audit log failure
  }
}

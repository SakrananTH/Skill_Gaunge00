import express from 'express';
import { query, queryOne, execute } from '../utils/db.js';

const columnCache = new Map();
const RESERVED_QUERY_KEYS = new Set(['limit', 'offset', 'orderBy', 'orderDir']);

async function getTableColumns(table) {
  if (columnCache.has(table)) return columnCache.get(table);
  const rows = await query(`SHOW COLUMNS FROM \`${table}\``);
  const columns = new Set(rows.map((row) => row.Field));
  columnCache.set(table, columns);
  return columns;
}

function pickAllowedFields(payload, allowedColumns) {
  if (!payload || typeof payload !== 'object') return {};
  const entries = Object.entries(payload).filter(([key, value]) => {
    return allowedColumns.has(key) && value !== undefined;
  });
  return Object.fromEntries(entries);
}

function parsePagination(queryParams) {
  const limitRaw = Number(queryParams.limit ?? 100);
  const offsetRaw = Number(queryParams.offset ?? 0);
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 200) : 100;
  const offset = Number.isFinite(offsetRaw) ? Math.max(offsetRaw, 0) : 0;
  return { limit, offset };
}

function buildFilters(queryParams, allowedColumns) {
  const filters = [];
  const values = [];
  for (const [key, value] of Object.entries(queryParams)) {
    if (RESERVED_QUERY_KEYS.has(key)) continue;
    if (!allowedColumns.has(key)) continue;
    filters.push(`\`${key}\` = ?`);
    values.push(value);
  }
  return { filters, values };
}

function sanitizeOrderBy(orderBy, allowedColumns) {
  if (!orderBy || !allowedColumns.has(orderBy)) return null;
  return `\`${orderBy}\``;
}

function normalizeOrderDir(orderDir) {
  return String(orderDir || 'asc').toLowerCase() === 'desc' ? 'DESC' : 'ASC';
}

function registerCrudRoutes(router, config) {
  const { path, table, idColumn, compositeKeys } = config;

  router.get(`/${path}`, async (req, res) => {
    try {
      const columns = await getTableColumns(table);
      const { limit, offset } = parsePagination(req.query);
      const { filters, values } = buildFilters(req.query, columns);
      const orderBy = sanitizeOrderBy(req.query.orderBy, columns) || (idColumn ? `\`${idColumn}\`` : null);
      const orderDir = normalizeOrderDir(req.query.orderDir);

      const whereClause = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
      const orderClause = orderBy ? `ORDER BY ${orderBy} ${orderDir}` : '';

      const rows = await query(
        `SELECT * FROM \`${table}\` ${whereClause} ${orderClause} LIMIT ${limit} OFFSET ${offset}`,
        values
      );

      res.json({ data: rows, meta: { limit, offset } });
    } catch (error) {
      console.error(`List ${table} failed`, error);
      res.status(500).json({ error: 'Failed to fetch records' });
    }
  });

  if (compositeKeys && compositeKeys.length === 2) {
    const [keyA, keyB] = compositeKeys;

    router.get(`/${path}/:${keyA}/:${keyB}`, async (req, res) => {
      try {
        const row = await queryOne(
          `SELECT * FROM \`${table}\` WHERE \`${keyA}\` = ? AND \`${keyB}\` = ? LIMIT 1`,
          [req.params[keyA], req.params[keyB]]
        );
        if (!row) return res.status(404).json({ error: 'Record not found' });
        res.json(row);
      } catch (error) {
        console.error(`Get ${table} failed`, error);
        res.status(500).json({ error: 'Failed to fetch record' });
      }
    });

    router.post(`/${path}`, async (req, res) => {
      try {
        const columns = await getTableColumns(table);
        const payload = pickAllowedFields(req.body, columns);
        const missing = compositeKeys.filter((key) => payload[key] === undefined);
        if (missing.length) {
          return res.status(400).json({ error: `Missing required keys: ${missing.join(', ')}` });
        }
        const fields = Object.keys(payload);
        if (!fields.length) return res.status(400).json({ error: 'No valid fields provided' });
        const placeholders = fields.map(() => '?');

        await execute(
          `INSERT INTO \`${table}\` (${fields.map((field) => `\`${field}\``).join(', ')}) VALUES (${placeholders.join(', ')})`,
          fields.map((field) => payload[field])
        );

        res.status(201).json({ message: 'Created', keys: Object.fromEntries(compositeKeys.map((key) => [key, payload[key]])) });
      } catch (error) {
        console.error(`Create ${table} failed`, error);
        res.status(500).json({ error: 'Failed to create record' });
      }
    });

    router.put(`/${path}/:${keyA}/:${keyB}`, async (req, res) => {
      try {
        const columns = await getTableColumns(table);
        const payload = pickAllowedFields(req.body, columns);
        compositeKeys.forEach((key) => delete payload[key]);
        const fields = Object.keys(payload);
        if (!fields.length) return res.status(400).json({ error: 'No valid fields provided' });

        const setClause = fields.map((field) => `\`${field}\` = ?`).join(', ');
        const values = fields.map((field) => payload[field]);

        const result = await execute(
          `UPDATE \`${table}\` SET ${setClause} WHERE \`${keyA}\` = ? AND \`${keyB}\` = ?`,
          [...values, req.params[keyA], req.params[keyB]]
        );

        if (result.affectedRows === 0) return res.status(404).json({ error: 'Record not found' });
        res.json({ message: 'Updated' });
      } catch (error) {
        console.error(`Update ${table} failed`, error);
        res.status(500).json({ error: 'Failed to update record' });
      }
    });

    router.delete(`/${path}/:${keyA}/:${keyB}`, async (req, res) => {
      try {
        const result = await execute(
          `DELETE FROM \`${table}\` WHERE \`${keyA}\` = ? AND \`${keyB}\` = ?`,
          [req.params[keyA], req.params[keyB]]
        );
        if (result.affectedRows === 0) return res.status(404).json({ error: 'Record not found' });
        res.json({ message: 'Deleted' });
      } catch (error) {
        console.error(`Delete ${table} failed`, error);
        res.status(500).json({ error: 'Failed to delete record' });
      }
    });

    return;
  }

  if (idColumn) {
    router.get(`/${path}/:${idColumn}`, async (req, res) => {
      try {
        const row = await queryOne(
          `SELECT * FROM \`${table}\` WHERE \`${idColumn}\` = ? LIMIT 1`,
          [req.params[idColumn]]
        );
        if (!row) return res.status(404).json({ error: 'Record not found' });
        res.json(row);
      } catch (error) {
        console.error(`Get ${table} failed`, error);
        res.status(500).json({ error: 'Failed to fetch record' });
      }
    });

    router.post(`/${path}`, async (req, res) => {
      try {
        const columns = await getTableColumns(table);
        const payload = pickAllowedFields(req.body, columns);
        const fields = Object.keys(payload).filter((field) => {
          if (field !== idColumn) return true;
          return payload[idColumn] !== undefined && payload[idColumn] !== null && payload[idColumn] !== '';
        });
        if (!fields.length) return res.status(400).json({ error: 'No valid fields provided' });

        const placeholders = fields.map(() => '?');
        const result = await execute(
          `INSERT INTO \`${table}\` (${fields.map((field) => `\`${field}\``).join(', ')}) VALUES (${placeholders.join(', ')})`,
          fields.map((field) => payload[field])
        );

        res.status(201).json({ message: 'Created', id: result.insertId || payload[idColumn] || null });
      } catch (error) {
        console.error(`Create ${table} failed`, error);
        res.status(500).json({ error: 'Failed to create record' });
      }
    });

    router.put(`/${path}/:${idColumn}`, async (req, res) => {
      try {
        const columns = await getTableColumns(table);
        const payload = pickAllowedFields(req.body, columns);
        delete payload[idColumn];
        const fields = Object.keys(payload);
        if (!fields.length) return res.status(400).json({ error: 'No valid fields provided' });

        const setClause = fields.map((field) => `\`${field}\` = ?`).join(', ');
        const values = fields.map((field) => payload[field]);

        const result = await execute(
          `UPDATE \`${table}\` SET ${setClause} WHERE \`${idColumn}\` = ?`,
          [...values, req.params[idColumn]]
        );

        if (result.affectedRows === 0) return res.status(404).json({ error: 'Record not found' });
        res.json({ message: 'Updated' });
      } catch (error) {
        console.error(`Update ${table} failed`, error);
        res.status(500).json({ error: 'Failed to update record' });
      }
    });

    router.delete(`/${path}/:${idColumn}`, async (req, res) => {
      try {
        const result = await execute(
          `DELETE FROM \`${table}\` WHERE \`${idColumn}\` = ?`,
          [req.params[idColumn]]
        );
        if (result.affectedRows === 0) return res.status(404).json({ error: 'Record not found' });
        res.json({ message: 'Deleted' });
      } catch (error) {
        console.error(`Delete ${table} failed`, error);
        res.status(500).json({ error: 'Failed to delete record' });
      }
    });
  }
}

function registerViewRoutes(router, view) {
  router.get(`/views/${view.path}`, async (req, res) => {
    try {
      const columns = await getTableColumns(view.name);
      const { limit, offset } = parsePagination(req.query);
      const { filters, values } = buildFilters(req.query, columns);
      const orderBy = sanitizeOrderBy(req.query.orderBy, columns);
      const orderDir = normalizeOrderDir(req.query.orderDir);

      const whereClause = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
      const orderClause = orderBy ? `ORDER BY ${orderBy} ${orderDir}` : '';

      const rows = await query(
        `SELECT * FROM \`${view.name}\` ${whereClause} ${orderClause} LIMIT ${limit} OFFSET ${offset}`,
        values
      );

      res.json({ data: rows, meta: { limit, offset } });
    } catch (error) {
      console.error(`List view ${view.name} failed`, error);
      res.status(500).json({ error: 'Failed to fetch view' });
    }
  });
}

export function buildRoleRouter({ requireAuth, authorizeRoles, allowedRoles, tables, views = [] }) {
  const router = express.Router();
  router.use(requireAuth, authorizeRoles(...allowedRoles));

  tables.forEach((tableConfig) => registerCrudRoutes(router, tableConfig));
  views.forEach((view) => registerViewRoutes(router, view));

  return router;
}

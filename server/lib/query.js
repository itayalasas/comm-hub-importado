import { dbQuery, withClient } from './db.js';

function quoteIdent(value) {
  return String(value)
    .split('.')
    .map((segment) => `"${segment.replace(/"/g, '""')}"`)
    .join('.');
}

function normalizeTableName(table) {
  const cleaned = String(table || '').trim();
  if (!cleaned) {
    throw new Error('table is required');
  }
  return quoteIdent(cleaned);
}

function normalizeSelect(select) {
  const cleaned = String(select || '*').trim();
  return cleaned || '*';
}

function buildWhereClause(filters = [], startIndex = 1) {
  if (!Array.isArray(filters) || filters.length === 0) {
    return { text: '', values: [], nextIndex: startIndex };
  }

  const parts = [];
  const values = [];
  let index = startIndex;

  for (const filter of filters) {
    if (!filter || typeof filter !== 'object') continue;

    const column = quoteIdent(filter.column);
    const op = String(filter.op || 'eq').toLowerCase();
    const value = filter.value;

    switch (op) {
      case 'eq':
        parts.push(`${column} = $${index}`);
        values.push(value);
        index++;
        break;
      case 'neq':
        parts.push(`${column} <> $${index}`);
        values.push(value);
        index++;
        break;
      case 'gt':
        parts.push(`${column} > $${index}`);
        values.push(value);
        index++;
        break;
      case 'gte':
        parts.push(`${column} >= $${index}`);
        values.push(value);
        index++;
        break;
      case 'lt':
        parts.push(`${column} < $${index}`);
        values.push(value);
        index++;
        break;
      case 'lte':
        parts.push(`${column} <= $${index}`);
        values.push(value);
        index++;
        break;
      case 'like':
        parts.push(`${column} LIKE $${index}`);
        values.push(value);
        index++;
        break;
      case 'ilike':
        parts.push(`${column} ILIKE $${index}`);
        values.push(value);
        index++;
        break;
      case 'in': {
        const list = Array.isArray(value) ? value : [value];
        const placeholders = list.map((item) => {
          values.push(item);
          return `$${index++}`;
        });
        parts.push(`${column} IN (${placeholders.join(', ')})`);
        break;
      }
      case 'is':
        if (value === null) {
          parts.push(`${column} IS NULL`);
        } else if (value === true || value === false) {
          parts.push(`${column} IS ${value ? 'TRUE' : 'FALSE'}`);
        } else {
          parts.push(`${column} IS NOT DISTINCT FROM $${index}`);
          values.push(value);
          index++;
        }
        break;
      default:
        parts.push(`${column} = $${index}`);
        values.push(value);
        index++;
        break;
    }
  }

  if (parts.length === 0) {
    return { text: '', values: [], nextIndex: startIndex };
  }

  return {
    text: ` WHERE ${parts.join(' AND ')}`,
    values,
    nextIndex: index,
  };
}

function buildOrderClause(order) {
  if (!order || !order.column) return '';
  const direction = order.ascending === false ? 'DESC' : 'ASC';
  return ` ORDER BY ${quoteIdent(order.column)} ${direction}`;
}

function buildLimitClause(limit) {
  if (typeof limit !== 'number' || !Number.isFinite(limit) || limit < 0) return '';
  return ` LIMIT ${Math.floor(limit)}`;
}

function buildOffsetClause(offset) {
  if (typeof offset !== 'number' || !Number.isFinite(offset) || offset < 0) return '';
  return ` OFFSET ${Math.floor(offset)}`;
}

function normalizeRows(data) {
  if (Array.isArray(data)) return data.filter((row) => row && typeof row === 'object');
  if (data && typeof data === 'object') return [data];
  return [];
}

function normalizeReturning(returning) {
  const value = String(returning || '*').trim();
  return value || '*';
}

function normalizeCount(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function buildInsertSql(table, rows, returning) {
  const columns = Object.keys(rows[0] || {});
  if (columns.length === 0) {
    throw new Error('insert data is empty');
  }

  const values = [];
  const valueRows = rows.map((row) => {
    const placeholders = columns.map((column) => {
      values.push(row[column]);
      return `$${values.length}`;
    });
    return `(${placeholders.join(', ')})`;
  });

  const text = `INSERT INTO ${normalizeTableName(table)} (${columns.map(quoteIdent).join(', ')}) VALUES ${valueRows.join(', ')} RETURNING ${normalizeReturning(returning)}`;
  return { text, values };
}

function buildUpdateSql(table, data, filters, returning) {
  const entries = Object.entries(data || {});
  if (entries.length === 0) {
    throw new Error('update data is empty');
  }

  const setParts = [];
  const values = [];

  for (const [column, value] of entries) {
    values.push(value);
    setParts.push(`${quoteIdent(column)} = $${values.length}`);
  }

  const where = buildWhereClause(filters, values.length + 1);
  values.push(...where.values);

  const text = `UPDATE ${normalizeTableName(table)} SET ${setParts.join(', ')}${where.text} RETURNING ${normalizeReturning(returning)}`;
  return { text, values };
}

function buildDeleteSql(table, filters, returning) {
  const where = buildWhereClause(filters);
  const text = `DELETE FROM ${normalizeTableName(table)}${where.text} RETURNING ${normalizeReturning(returning)}`;
  return { text, values: where.values };
}

function buildUpsertSql(table, data, onConflict, returning) {
  const rows = normalizeRows(data);
  if (rows.length === 0) {
    throw new Error('upsert data is empty');
  }

  const { text, values } = buildInsertSql(table, rows, returning);
  if (!onConflict) {
    return { text, values };
  }

  const columns = Object.keys(rows[0] || {});
  const updateColumns = columns.filter((column) => column !== onConflict && column !== 'id');
  const updateClause = updateColumns.length > 0
    ? updateColumns.map((column) => `${quoteIdent(column)} = EXCLUDED.${quoteIdent(column)}`).join(', ')
    : `${quoteIdent(onConflict)} = EXCLUDED.${quoteIdent(onConflict)}`;

  return {
    text: `${text.replace(/ RETURNING .*$/, '')} ON CONFLICT (${quoteIdent(onConflict)}) DO UPDATE SET ${updateClause} RETURNING ${normalizeReturning(returning)}`,
    values,
  };
}

export async function executeQueryRequest(request) {
  const table = normalizeTableName(request.table);
  const operation = String(request.operation || 'select').toLowerCase();
  const select = normalizeSelect(request.select);
  const returning = normalizeReturning(request.returning || request.select || '*');
  const filters = Array.isArray(request.filters) ? request.filters : [];
  const orderClause = buildOrderClause(request.order);
  const limitClause = buildLimitClause(request.limit);
  const offsetClause = buildOffsetClause(request.offset);

  if (operation === 'select') {
    const where = buildWhereClause(filters);
    const baseSql = `FROM ${table}${where.text}`;
    const countRequested = request.count === 'exact';

    if (request.head) {
      const countResult = await dbQuery(`SELECT COUNT(*)::int AS count ${baseSql}`, where.values);
      return {
        data: null,
        count: normalizeCount(countResult.rows[0]?.count),
      };
    }

    const selectSql = `SELECT ${select} ${baseSql}${orderClause}${limitClause}${offsetClause}`;
    const selectResult = await dbQuery(selectSql, where.values);
    let count = selectResult.rowCount;

    if (countRequested) {
      const countResult = await dbQuery(`SELECT COUNT(*)::int AS count ${baseSql}`, where.values);
      count = normalizeCount(countResult.rows[0]?.count);
    }

    return {
      data: selectResult.rows,
      count,
    };
  }

  if (operation === 'insert') {
    const rows = normalizeRows(request.data);
    const { text, values } = buildInsertSql(table, rows, returning);
    const result = await dbQuery(text, values);
    return {
      data: result.rows,
      count: result.rowCount,
    };
  }

  if (operation === 'update') {
    const { text, values } = buildUpdateSql(table, request.update ?? request.data ?? {}, filters, returning);
    const result = await dbQuery(text, values);
    return {
      data: result.rows,
      count: result.rowCount,
    };
  }

  if (operation === 'delete') {
    const { text, values } = buildDeleteSql(table, filters, returning);
    const result = await dbQuery(text, values);
    return {
      data: result.rows,
      count: result.rowCount,
    };
  }

  if (operation === 'upsert') {
    const { text, values } = buildUpsertSql(table, request.data ?? request.update ?? {}, request.onConflict, returning);
    const result = await dbQuery(text, values);
    return {
      data: result.rows,
      count: result.rowCount,
    };
  }

  throw new Error(`Unsupported operation: ${operation}`);
}

export function buildCountSql(request) {
  const table = normalizeTableName(request.table);
  const filters = Array.isArray(request.filters) ? request.filters : [];
  const where = buildWhereClause(filters);
  return {
    text: `SELECT COUNT(*)::int AS count FROM ${table}${where.text}`,
    values: where.values,
  };
}

export function buildSelectSql(request) {
  const table = normalizeTableName(request.table);
  const select = normalizeSelect(request.select);
  const filters = Array.isArray(request.filters) ? request.filters : [];
  const where = buildWhereClause(filters);
  const orderClause = buildOrderClause(request.order);
  const limitClause = buildLimitClause(request.limit);
  const offsetClause = buildOffsetClause(request.offset);

  return {
    text: `SELECT ${select} FROM ${table}${where.text}${orderClause}${limitClause}${offsetClause}`,
    values: where.values,
  };
}

export function buildAdminLookupSql(query) {
  return {
    text: `SELECT id, name, api_key, user_id, tenant_id FROM ${normalizeTableName('applications')} WHERE api_key = $1 LIMIT 1`,
    values: [String(query || '').trim()],
  };
}

export async function countRows(table, filters = []) {
  const { text, values } = buildCountSql({ table, filters });
  const result = await dbQuery(text, values);
  return normalizeCount(result.rows[0]?.count);
}

export async function selectRows(request) {
  const { text, values } = buildSelectSql(request);
  const result = await dbQuery(text, values);
  return result.rows;
}

export async function withTransaction(work) {
  return withClient(async (client) => {
    await client.query('BEGIN');
    try {
      const result = await work(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
  });
}

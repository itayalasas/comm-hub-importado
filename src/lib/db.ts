import { configManager } from './config';

type FilterOp = 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'like' | 'ilike' | 'in' | 'is';

interface Filter {
  column: string;
  op: FilterOp;
  value: unknown;
}

interface OrderClause {
  column: string;
  ascending: boolean;
}

interface QueryPayload {
  table: string;
  operation: 'select' | 'insert' | 'update' | 'delete' | 'upsert';
  select?: string;
  data?: Record<string, unknown>;
  filters?: Filter[];
  order?: OrderClause;
  limit?: number;
  offset?: number;
  onConflict?: string;
  count?: 'exact';
  head?: boolean;
}

interface DbResponse<T = any> {
  data: T | null;
  error: { message: string; code?: string; hint?: string | null } | null;
  count: number;
}

async function executeQuery<T = unknown>(payload: QueryPayload): Promise<DbResponse<T>> {
  let apiUrl: string;
  let apiKey: string;

  try {
    apiUrl = configManager.apiUrl;
    apiKey = configManager.apiKey;
  } catch {
    return { data: null, error: { message: 'API config not loaded', code: 'CONFIG_ERROR', hint: null }, count: 0 };
  }

  if (!apiUrl) {
    return { data: null, error: { message: 'API_URL not configured', code: 'CONFIG_ERROR', hint: null }, count: 0 };
  }

  const response = await fetch(`${apiUrl}/api/query`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => response.statusText);
    return { data: null, error: { message: text, code: String(response.status), hint: null }, count: 0 };
  }

  return response.json();
}

class QueryBuilder<T = any> {
  private payload: QueryPayload;

  constructor(table: string) {
    this.payload = { table, operation: 'select' };
  }

  select(columns = '*', opts?: { count?: 'exact'; head?: boolean }): this {
    this.payload.operation = 'select';
    this.payload.select = columns;
    if (opts?.count) this.payload.count = opts.count;
    if (opts?.head) this.payload.head = opts.head;
    return this;
  }

  insert(data: Record<string, unknown>): this {
    this.payload.operation = 'insert';
    this.payload.data = data;
    return this;
  }

  update(data: Record<string, unknown>): this {
    this.payload.operation = 'update';
    this.payload.data = data;
    return this;
  }

  delete(): this {
    this.payload.operation = 'delete';
    return this;
  }

  upsert(data: Record<string, unknown>, opts?: { onConflict?: string }): this {
    this.payload.operation = 'upsert';
    this.payload.data = data;
    if (opts?.onConflict) this.payload.onConflict = opts.onConflict;
    return this;
  }

  eq(column: string, value: unknown): this {
    return this.addFilter(column, 'eq', value);
  }

  neq(column: string, value: unknown): this {
    return this.addFilter(column, 'neq', value);
  }

  gt(column: string, value: unknown): this {
    return this.addFilter(column, 'gt', value);
  }

  gte(column: string, value: unknown): this {
    return this.addFilter(column, 'gte', value);
  }

  lt(column: string, value: unknown): this {
    return this.addFilter(column, 'lt', value);
  }

  lte(column: string, value: unknown): this {
    return this.addFilter(column, 'lte', value);
  }

  like(column: string, value: string): this {
    return this.addFilter(column, 'like', value);
  }

  ilike(column: string, value: string): this {
    return this.addFilter(column, 'ilike', value);
  }

  in(column: string, value: unknown[]): this {
    return this.addFilter(column, 'in', value);
  }

  is(column: string, value: unknown): this {
    return this.addFilter(column, 'is', value);
  }

  order(column: string, opts?: { ascending?: boolean }): this {
    this.payload.order = { column, ascending: opts?.ascending ?? true };
    return this;
  }

  limit(n: number): this {
    this.payload.limit = n;
    return this;
  }

  range(from: number, to: number): this {
    this.payload.offset = from;
    this.payload.limit = to - from + 1;
    return this;
  }

  maybeSingle(): Promise<DbResponse<T>> {
    this.payload.limit = 1;
    return executeQuery<T>(this.payload).then((res) => ({
      ...res,
      data: Array.isArray(res.data) ? (res.data[0] ?? null) : res.data,
    }));
  }

  then<R>(
    resolve: (value: DbResponse<T>) => R,
    reject?: (reason: unknown) => R
  ): Promise<R> {
    return executeQuery<T>(this.payload).then(resolve, reject);
  }

  private addFilter(column: string, op: FilterOp, value: unknown): this {
    if (!this.payload.filters) this.payload.filters = [];
    this.payload.filters.push({ column, op, value });
    return this;
  }
}

class DbClient {
  from<T = any>(table: string): QueryBuilder<T> {
    return new QueryBuilder<T>(table);
  }
}

export const db = new DbClient();

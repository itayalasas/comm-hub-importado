
import geoip from "npm:geoip-lite@1.4.10";
import { Pool } from "https://deno.land/x/postgres@v0.19.3/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-Api-Key, Authorization",
};

const allowedTables = [
  "applications",
  "api_keys",
  "branding_configs",
  "email_credentials",
  "communication_templates",
  "email_logs",
  "environments",
  "pdf_generation_logs",
  "user_preferences",
  "predefined_variables",
  "pending_communications",
  "web_access_attempts",
  "whatsapp_configs",
  "whatsapp_templates",
  "whatsapp_logs"
];

const allowedOperations = ["select", "insert", "update", "delete", "upsert"];

const allowedOperators: Record<string, string> = {
  eq: "=",
  neq: "!=",
  gt: ">",
  gte: ">=",
  lt: "<",
  lte: "<=",
  like: "LIKE",
  ilike: "ILIKE",
  in: "IN",
  is: "IS",
};

const pool = new Pool({ connectionString: Deno.env.get("DATABASE_URL") || "", connectionTimeoutMillis: 5000 }, 3, true);

const COUNTRY_DISPLAY_NAMES = (() => {
  try {
    return new Intl.DisplayNames(["es"], { type: "region" });
  } catch {
    return null;
  }
})();

function jsonResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function parseTokens(raw?: string): string[] {
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.map(String);
  } catch {
    // fallback CSV
  }

  return raw.split(",").map((x) => x.trim()).filter(Boolean);
}

function isPrivateIp(ip: string): boolean {
  return /^(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|::1$|fc00:|fd00:)/i.test(ip);
}

function getClientIp(req: Request): string {
  const headerNames = [
    "cf-connecting-ip",
    "x-forwarded-for",
    "x-real-ip",
    "x-client-ip",
    "true-client-ip",
    "x-azure-clientip",
  ];

  for (const headerName of headerNames) {
    const raw = req.headers.get(headerName)?.trim();
    if (!raw) continue;

    const candidate = raw.split(",")[0]?.trim().replace(/^::ffff:/, "");
    if (candidate) {
      return candidate;
    }
  }

  return "";
}

function isCountryCodeLike(value: string): boolean {
  const normalized = String(value || "").trim().toUpperCase();
  return normalized === "LO" || normalized === "??" || /^[A-Z]{2}$/.test(normalized);
}

function hasMeaningfulCountryCode(value: string): boolean {
  const normalized = String(value || "").trim().toUpperCase();
  return normalized === "LO" || /^[A-Z]{2}$/.test(normalized);
}

function getCountryName(countryCode: string): string {
  const normalized = String(countryCode || "").trim().toUpperCase();

  if (!normalized || normalized === "??") {
    return "Desconocido";
  }

  if (normalized === "LO") {
    return "Local";
  }

  if (!/^[A-Z]{2}$/.test(normalized)) {
    return normalized;
  }

  return COUNTRY_DISPLAY_NAMES?.of(normalized) || normalized;
}

function lookupCountryByIp(ipAddress: string): { country_code: string; country_name: string } {
  const cleanedIp = String(ipAddress || "").trim();

  if (!cleanedIp || cleanedIp === "127.0.0.1" || cleanedIp === "::1") {
    return { country_code: "LO", country_name: "Local" };
  }

  const geo = geoip.lookup(cleanedIp);
  if (!geo?.country) {
    return { country_code: "??", country_name: "Desconocido" };
  }

  const countryCode = String(geo.country).trim().toUpperCase();
  return {
    country_code: countryCode,
    country_name: getCountryName(countryCode),
  };
}

function getCountryFromRequest(req: Request, ipAddress: string): { country_code: string; country_name: string } {
  const headerNames = [
    "cf-ipcountry",
    "x-vercel-ip-country",
    "x-country-code",
    "x-country",
    "cloudfront-viewer-country",
  ];

  for (const headerName of headerNames) {
    const raw = req.headers.get(headerName)?.trim();
    if (!raw) continue;

    const countryCode = raw.toUpperCase();
    if (!hasMeaningfulCountryCode(countryCode)) {
      continue;
    }

    if (countryCode === "LO") {
      return { country_code: "LO", country_name: "Local" };
    }

    return {
      country_code: countryCode,
      country_name: getCountryName(countryCode),
    };
  }

  if (ipAddress && isPrivateIp(ipAddress)) {
    return { country_code: "LO", country_name: "Local" };
  }

  return lookupCountryByIp(ipAddress);
}

function normalizeWebAccessAttemptRow(row: Record<string, any>, req: Request): Record<string, any> {
  const normalized = { ...row };
  const rawIp = String(
    normalized.ip_address ??
    normalized.ip ??
    normalized.client_ip ??
    normalized.remote_ip ??
    "",
  ).trim();
  const ipAddress = rawIp || getClientIp(req);
  const rawCountryCode = String(
    normalized.country_code ??
    normalized.countryCode ??
    normalized.iso_code ??
    normalized.isoCode ??
    "",
  ).trim().toUpperCase();
  const rawCountryName = String(
    normalized.country_name ??
    normalized.countryName ??
    normalized.country ??
    normalized.label ??
    "",
  ).trim();
  const requestCountry = getCountryFromRequest(req, ipAddress);

  if (ipAddress) {
    normalized.ip_address = ipAddress;
  }

  if (rawCountryCode && hasMeaningfulCountryCode(rawCountryCode)) {
    normalized.country_code = rawCountryCode;
    normalized.country_name = rawCountryName || getCountryName(rawCountryCode);
  } else {
    normalized.country_code = requestCountry.country_code;
    normalized.country_name = rawCountryName || requestCountry.country_name;
  }

  delete normalized.ip;
  delete normalized.client_ip;
  delete normalized.remote_ip;
  delete normalized.country;
  delete normalized.countryCode;
  delete normalized.countryName;
  delete normalized.iso_code;
  delete normalized.isoCode;

  return normalized;
}

function enrichWebAccessAttemptData(table: string, operation: string, data: any, req: Request): any {
  if (table !== "web_access_attempts" || !["insert", "upsert"].includes(operation)) {
    return data;
  }

  if (Array.isArray(data)) {
    return data.map((row) => (
      row && typeof row === "object" && !Array.isArray(row)
        ? normalizeWebAccessAttemptRow(row, req)
        : row
    ));
  }

  if (data && typeof data === "object" && !Array.isArray(data)) {
    return normalizeWebAccessAttemptRow(data, req);
  }

  return data;
}

function getAllowedApiKeys(): string[] {
  return [
    Deno.env.get("API_KEY"),
    Deno.env.get("FPM_API_KEY"),
    ...parseTokens(Deno.env.get("API_KEYS")),
    ...parseTokens(Deno.env.get("API_KEYS_CSV")),
    ...parseTokens(Deno.env.get("FPM_API_KEYS")),
    ...parseTokens(Deno.env.get("FPM_API_KEYS_CSV")),
    ...parseTokens(Deno.env.get("FPM_AUTH_TOKENS")),
  ].filter((key): key is string => !!key);
}

function validateApiKey(req: Request): Response | null {
  const apiKey = req.headers.get("x-api-key");
  const allowedApiKeys = getAllowedApiKeys();

  if (!apiKey || !allowedApiKeys.includes(apiKey)) {
    return jsonResponse({
      data: null,
      error: {
        message: "Unauthorized",
        code: "UNAUTHORIZED",
        hint: null,
      },
      count: 0,
    }, 401);
  }

  return null;
}

function isSafeIdentifier(value: string): boolean {
  return /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(value);
}

function quoteIdentifier(value: string): string {
  if (!isSafeIdentifier(value)) {
    throw new Error(`Invalid identifier: ${value}`);
  }

  return `"${value}"`;
}

function parseSelect(select?: string): string {
  if (!select || select.trim() === "*" || select.trim() === "") {
    return "*";
  }

  return select
    .split(",")
    .map((col) => col.trim())
    .filter(Boolean)
    .map(quoteIdentifier)
    .join(", ");
}

function parseConflictColumns(onConflict?: string): string {
  if (!onConflict || !onConflict.trim()) {
    throw new Error("Upsert requires onConflict");
  }

  return onConflict
    .split(",")
    .map((col) => col.trim())
    .filter(Boolean)
    .map(quoteIdentifier)
    .join(", ");
}

function buildWhere(filters: any[] = [], values: any[]): string {
  if (!filters.length) return "";

  const clauses: string[] = [];

  for (const filter of filters) {
    const column = filter.column;
    const op = filter.op;
    const value = filter.value;

    if (!column || !isSafeIdentifier(column)) {
      throw new Error(`Invalid filter column: ${column}`);
    }

    if (!allowedOperators[op]) {
      throw new Error(`Invalid operator: ${op}`);
    }

    const sqlOp = allowedOperators[op];

    if (op === "in") {
      if (!Array.isArray(value)) {
        throw new Error("Operator 'in' requires array value");
      }

      const placeholders = value.map((item) => {
        values.push(item);
        return `$${values.length}`;
      });

      clauses.push(`${quoteIdentifier(column)} IN (${placeholders.join(", ")})`);
    } else if (op === "is") {
      if (value !== null && value !== true && value !== false) {
        throw new Error("Operator 'is' only supports null, true or false");
      }

      if (value === null) {
        clauses.push(`${quoteIdentifier(column)} IS NULL`);
      } else {
        clauses.push(`${quoteIdentifier(column)} IS ${value ? "TRUE" : "FALSE"}`);
      }
    } else {
      values.push(value);
      clauses.push(`${quoteIdentifier(column)} ${sqlOp} $${values.length}`);
    }
  }

  return `WHERE ${clauses.join(" AND ")}`;
}

export default async function handler(req: Request) {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const unauthorizedResponse = validateApiKey(req);

  if (unauthorizedResponse) {
    return unauthorizedResponse;
  }

  if (req.method !== "POST") {
    return jsonResponse({
      data: null,
      error: {
        message: "Method not allowed",
        code: "METHOD_NOT_ALLOWED",
        hint: null,
      },
      count: 0,
    }, 405);
  }

  const databaseUrl = Deno.env.get("DATABASE_URL");

  if (!databaseUrl) {
    return jsonResponse({
      data: null,
      error: {
        message: "Missing DATABASE_URL",
        code: "CONFIG_ERROR",
        hint: null,
      },
      count: 0,
    }, 500);
  }

  const client = await pool.connect();

  try {
    const body = await req.json();

    const {
      table,
      operation,
      select,
      filters = [],
      data,
      update,
      order,
      limit,
      offset,
      returning = "*",
      onConflict,
    } = body;

    if (!table || !allowedTables.includes(table)) {
      throw new Error(`Table not allowed: ${table}`);
    }

    if (!operation || !allowedOperations.includes(operation)) {
      throw new Error(`Operation not allowed: ${operation}`);
    }

    const tableSql = quoteIdentifier(table);
    const mutationData = enrichWebAccessAttemptData(table, operation, data, req);
    const params: any[] = [];
    let sql = "";

    if (operation === "select") {
      const selectSql = parseSelect(select);
      const whereSql = buildWhere(filters, params);

      let orderSql = "";

      if (order?.column) {
        if (!isSafeIdentifier(order.column)) {
          throw new Error(`Invalid order column: ${order.column}`);
        }

        orderSql = `ORDER BY ${quoteIdentifier(order.column)} ${
          order.ascending === false ? "DESC" : "ASC"
        }`;
      }

      let limitSql = "";

      if (typeof limit === "number") {
        params.push(limit);
        limitSql = `LIMIT $${params.length}`;
      }

      let offsetSql = "";

      if (typeof offset === "number") {
        params.push(offset);
        offsetSql = `OFFSET $${params.length}`;
      }

      sql = `
        SELECT ${selectSql}
        FROM ${tableSql}
        ${whereSql}
        ${orderSql}
        ${limitSql}
        ${offsetSql}
      `;
    }

    if (operation === "insert") {
      const rows = Array.isArray(mutationData) ? mutationData : [mutationData];

      if (!rows.length || !rows[0]) {
        throw new Error("Insert requires data");
      }

      const columns = Object.keys(rows[0]);

      for (const column of columns) {
        if (!isSafeIdentifier(column)) {
          throw new Error(`Invalid insert column: ${column}`);
        }
      }

      const columnSql = columns.map(quoteIdentifier).join(", ");

      const rowsSql = rows
        .map((row) => {
          const placeholders = columns.map((column) => {
            params.push(row[column]);
            return `$${params.length}`;
          });

          return `(${placeholders.join(", ")})`;
        })
        .join(", ");

      sql = `
        INSERT INTO ${tableSql} (${columnSql})
        VALUES ${rowsSql}
        RETURNING ${parseSelect(returning)}
      `;
    }

    if (operation === "update") {
      const updateData = update || data;

      if (!updateData || typeof updateData !== "object") {
        throw new Error("Update requires data");
      }

      const columns = Object.keys(updateData);

      if (!columns.length) {
        throw new Error("Update requires at least one column");
      }

      const setSql = columns
        .map((column) => {
          if (!isSafeIdentifier(column)) {
            throw new Error(`Invalid update column: ${column}`);
          }

          params.push(updateData[column]);
          return `${quoteIdentifier(column)} = $${params.length}`;
        })
        .join(", ");

      const whereSql = buildWhere(filters, params);

      if (!whereSql) {
        throw new Error("Update requires filters");
      }

      sql = `
        UPDATE ${tableSql}
        SET ${setSql}
        ${whereSql}
        RETURNING ${parseSelect(returning)}
      `;
    }

    if (operation === "delete") {
      const whereSql = buildWhere(filters, params);

      if (!whereSql) {
        throw new Error("Delete requires filters");
      }

      sql = `
        DELETE FROM ${tableSql}
        ${whereSql}
        RETURNING id
      `;
    }

    if (operation === "upsert") {
      const rows = Array.isArray(mutationData) ? mutationData : [mutationData];

      if (!rows.length || !rows[0]) {
        throw new Error("Upsert requires data");
      }

      const columns = Object.keys(rows[0]);

      for (const column of columns) {
        if (!isSafeIdentifier(column)) {
          throw new Error(`Invalid upsert column: ${column}`);
        }
      }

      const conflictSql = parseConflictColumns(onConflict);
      const columnSql = columns.map(quoteIdentifier).join(", ");

      const rowsSql = rows
        .map((row) => {
          const placeholders = columns.map((column) => {
            params.push(row[column]);
            return `$${params.length}`;
          });

          return `(${placeholders.join(", ")})`;
        })
        .join(", ");

      const conflictColumns = onConflict
        .split(",")
        .map((col: string) => col.trim());

      const updateColumns = columns.filter(
        (column) => !conflictColumns.includes(column),
      );

      const updateSql = updateColumns.length
        ? updateColumns
          .map((column) => `${quoteIdentifier(column)} = EXCLUDED.${quoteIdentifier(column)}`)
          .join(", ")
        : columns
          .map((column) => `${quoteIdentifier(column)} = EXCLUDED.${quoteIdentifier(column)}`)
          .join(", ");

      sql = `
        INSERT INTO ${tableSql} (${columnSql})
        VALUES ${rowsSql}
        ON CONFLICT (${conflictSql})
        DO UPDATE SET ${updateSql}
        RETURNING ${parseSelect(returning)}
      `;
    }

    const result = await client.queryObject(sql, params);

    if (operation === "delete") {
      return jsonResponse({
        data: [],
        error: null,
        count: result.rows.length,
      });
    }

    return jsonResponse({
      data: result.rows,
      error: null,
      count: result.rows.length,
    });
  } catch (error: any) {
    return jsonResponse({
      data: null,
      error: {
        message: error.message || String(error),
        code: error.code || "QUERY_ERROR",
        hint: error.hint || null,
      },
      count: 0,
    }, 400);
  } finally {
    client.release();
  }
}


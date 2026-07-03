import { Pool } from 'pg';
import { serverConfig } from './config.js';

let pool;

function buildPool() {
  if (!serverConfig.databaseUrl) {
    throw new Error('DATABASE_URL is not configured');
  }

  const ssl = process.env.DATABASE_SSL === 'false'
    ? false
    : { rejectUnauthorized: false };

  return new Pool({
    connectionString: serverConfig.databaseUrl,
    ssl,
    max: Number(process.env.DATABASE_POOL_SIZE || 10),
  });
}

export function getPool() {
  if (!pool) {
    pool = buildPool();
  }

  return pool;
}

export async function withClient(work) {
  const client = await getPool().connect();
  try {
    return await work(client);
  } finally {
    client.release();
  }
}

export async function dbQuery(text, values = []) {
  return getPool().query(text, values);
}

import { Pool, QueryResult, PoolClient } from 'pg';
import { config } from './config';

const pool = new Pool({
  connectionString: config.databaseUrl,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

pool.on('error', (err: Error) => {
  console.error('Unexpected error on idle client', err);
});

export const query = (text: string, params?: any[]): Promise<QueryResult> => {
  return pool.query(text, params);
};

export const getClient = async (): Promise<PoolClient> => {
  return pool.connect();
};

export const disconnect = async (): Promise<void> => {
  await pool.end();
};

export default pool;

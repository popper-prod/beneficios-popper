import { Pool, QueryResult, PoolClient } from 'pg';
import dns from 'dns';
import { config } from './config';

// Forzar IPv4 - Render usa IPv6 por defecto y Supabase no lo soporta
dns.setDefaultResultOrder('ipv4first');

const isProduction = config.nodeEnv === 'production';
const needsSSL = isProduction || config.databaseUrl.includes('supabase') || config.databaseUrl.includes('neon') || config.databaseUrl.includes('railway');

const pool = new Pool({
  connectionString: config.databaseUrl,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
  ssl: needsSSL ? { rejectUnauthorized: false } : false,
});

pool.on('connect', () => {
  console.log('DB: Conexion establecida');
});

pool.on('error', (err: Error) => {
  console.error('DB Pool error:', err.message);
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

import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

export const config = {
  port: parseInt(process.env.PORT || '3001', 10),
  databaseUrl: process.env.DATABASE_URL || '',
  jwtSecret: process.env.JWT_SECRET || '',
  nodeEnv: process.env.NODE_ENV || 'development',
};

if (!config.databaseUrl || !config.jwtSecret) {
  console.warn('⚠️ Variables de entorno incompletas. Asegúrate de tener .env.local configurado');
}

import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { config } from './config';
import authRoutes from './routes/auth';
import verificacionRoutes from './routes/verificacion';
import publicRoutes from './routes/public';
import adminRoutes from './routes/admin';

const app = express();

app.use(cors());
app.use(express.json());

app.get('/api/health', async (req: Request, res: Response) => {
  let dbStatus = 'unknown';
  try {
    const { query } = await import('./db');
    const result = await query('SELECT NOW() as time');
    dbStatus = 'connected - ' + result.rows[0].time;
  } catch (err: any) {
    dbStatus = 'error - ' + (err.message || 'unknown');
  }

  res.json({
    status: 'ok',
    timestamp: new Date(),
    environment: config.nodeEnv,
    port: config.port,
    database: dbStatus,
  });
});

app.get('/', (req: Request, res: Response) => {
  res.json({
    message: '🚀 Sistema BENEFICIOS GRUPO POPPER - Backend',
    version: '1.0.0',
    endpoints: {
      health: '/api/health',
      auth: '/api/auth',
      verificacion: '/api/verificacion'
    }
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/verificacion', verificacionRoutes);
app.use('/api/public', publicRoutes);
app.use('/api/admin', adminRoutes);

app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error('❌ Error:', err);
  res.status(500).json({ error: 'Error interno del servidor' });
});

// Escuchar en todos los ambientes
app.listen(config.port, () => {
  console.log(`\n${'='.repeat(50)}`);
  console.log(`✅ Servidor BENEFICIOS POPPER iniciado`);
  console.log(`📍 Puerto: ${config.port}`);
  console.log(`📍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔗 http://localhost:${config.port}`);
  console.log(`🔗 http://localhost:${config.port}/api/health`);
  console.log(`${'='.repeat(50)}\n`);

  // Keep-alive: ping cada 14 minutos para evitar que Render duerma el servidor
  if (process.env.NODE_ENV === 'production') {
    const KEEP_ALIVE_URL = 'https://beneficios-backend-jfpx.onrender.com/api/health';
    const INTERVAL = 14 * 60 * 1000; // 14 minutos en ms

    setInterval(async () => {
      try {
        const res = await fetch(KEEP_ALIVE_URL);
        console.log(`🏓 Keep-alive ping: ${res.status} - ${new Date().toISOString()}`);
      } catch (err) {
        console.log(`⚠️ Keep-alive falló: ${new Date().toISOString()}`);
      }
    }, INTERVAL);

    console.log(`🏓 Keep-alive activado: ping cada 14 min`);
  }
});

export default app;

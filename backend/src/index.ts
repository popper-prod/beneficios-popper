import express, { Request, Response, NextFunction } from 'express';
import { runSyncNaaloo } from './services/syncService';
import cors from 'cors';
import { config } from './config';
import authRoutes from './routes/auth';
import verificacionRoutes from './routes/verificacion';
import publicRoutes from './routes/public';
import adminRoutes from './routes/admin';

const app = express();

const ALLOWED_ORIGINS = [
  'https://beneficios-qr.vercel.app',
  'https://beneficios.recluta.com.ar',
  // Vercel preview deployments
  /^https:\/\/beneficios-.*\.vercel\.app$/,
  // Desarrollo local
  'http://localhost:5173',
  'http://localhost:4173',
  'http://localhost:3000',
];

app.use(cors({
  origin: (origin, callback) => {
    // Requests sin origin (curl, Postman, keep-alive interno)
    if (!origin) return callback(null, true);
    const allowed = ALLOWED_ORIGINS.some(o =>
      typeof o === 'string' ? o === origin : o.test(origin)
    );
    if (allowed) return callback(null, true);
    callback(new Error(`CORS: origin no permitido: ${origin}`));
  },
  credentials: true,
}));
app.use(express.json());

app.get('/api/health', async (req: Request, res: Response) => {
  const startTime = Date.now();
  let dbOk = false;
  let dbDetail = 'unknown';
  let stats: any = {};

  try {
    const { query } = await import('./db');
    const [timeRes, statsRes, expiringRes] = await Promise.all([
      query('SELECT NOW() as time'),
      query(`SELECT
        (SELECT COUNT(*) FROM beneficiarios WHERE activo = TRUE) AS beneficiarios_activos,
        (SELECT COUNT(*) FROM comercios WHERE activo = TRUE) AS comercios_activos,
        (SELECT COUNT(*) FROM beneficios WHERE activo = TRUE) AS beneficios_activos,
        (SELECT COUNT(*) FROM verificaciones WHERE fecha_verificacion >= CURRENT_DATE) AS canjes_hoy
      `),
      query(`SELECT COUNT(*) AS total FROM beneficios
        WHERE activo = TRUE AND fecha_fin IS NOT NULL
          AND fecha_fin BETWEEN NOW() AND NOW() + INTERVAL '7 days'`),
    ]);

    dbOk = true;
    dbDetail = 'connected';
    const s = statsRes.rows[0];
    stats = {
      beneficiarios_activos: parseInt(s.beneficiarios_activos),
      comercios_activos: parseInt(s.comercios_activos),
      beneficios_activos: parseInt(s.beneficios_activos),
      canjes_hoy: parseInt(s.canjes_hoy),
      beneficios_por_vencer: parseInt(expiringRes.rows[0].total),
    };
  } catch (err: any) {
    dbDetail = 'error: ' + (err.message || 'unknown');
  }

  const status = dbOk ? 'ok' : 'degraded';
  const httpStatus = dbOk ? 200 : 503;
  const responseMs = Date.now() - startTime;

  res.status(httpStatus).json({
    status,
    timestamp: new Date(),
    environment: config.nodeEnv,
    database: dbDetail,
    response_ms: responseMs,
    ...(dbOk ? stats : {}),
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

// Endpoint para cron jobs externos — protegido por CRON_SECRET
// Fire-and-forget: responde 202 inmediato y corre el sync en background.
// El resultado se loguea en Render logs.
app.get('/api/internal/sync', (req: Request, res: Response) => {
  const secret = req.query.secret || req.headers['x-cron-secret'];
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || secret !== cronSecret) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const startedAt = new Date().toISOString();
  res.status(202).json({ status: 'sync iniciado en background', startedAt });

  console.log(`🔄 Sync iniciado (cron) — ${startedAt}`);
  const t0 = Date.now();
  runSyncNaaloo('Cron')
    .then((result) => {
      const ms = Date.now() - t0;
      const r = result.resumen;
      console.log(`✅ Sync OK (${ms}ms) — total:${r.totalNaaloo} altas:${r.altas} bajas:${r.bajas} reactivados:${r.reactivados} actualizados:${r.actualizados}`);
    })
    .catch((err: any) => {
      const ms = Date.now() - t0;
      console.error(`❌ Sync falló (${ms}ms): ${err.message}`);
    });
});

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

    // Auto-sync con Naaloo cada 2 horas
    const SYNC_INTERVAL = 2 * 60 * 60 * 1000;
    setInterval(async () => {
      try {
        const result = await runSyncNaaloo('Cron interno');
        const { altas, bajas, actualizados } = result.resumen;
        console.log(`🔄 Auto-sync Naaloo: ${altas} altas, ${bajas} bajas, ${actualizados} actualizados — ${new Date().toISOString()}`);
      } catch (err: any) {
        console.log(`⚠️ Auto-sync Naaloo falló: ${err.message} — ${new Date().toISOString()}`);
      }
    }, SYNC_INTERVAL);

    console.log(`🔄 Auto-sync Naaloo activado: cada 2 horas`);
  }
});

export default app;

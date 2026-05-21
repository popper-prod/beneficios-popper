import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { config } from './config';
import authRoutes from './routes/auth';
import verificacionRoutes from './routes/verificacion';

const app = express();

app.use(cors());
app.use(express.json());

app.get('/api/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: new Date(),
    environment: config.nodeEnv,
    port: config.port
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

app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error('❌ Error:', err);
  res.status(500).json({ error: 'Error interno del servidor' });
});

app.listen(config.port, () => {
  console.log(`\n${'='.repeat(50)}`);
  console.log(`✅ Servidor BENEFICIOS POPPER iniciado`);
  console.log(`📍 Puerto: ${config.port}`);
  console.log(`🔗 http://localhost:${config.port}`);
  console.log(`🔗 http://localhost:${config.port}/api/health`);
  console.log(`${'='.repeat(50)}\n`);
});

export default app;

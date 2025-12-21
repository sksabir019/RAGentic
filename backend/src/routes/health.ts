import { Router, Request, Response } from 'express';
import { AppDataSource } from '../database/connection';
import { getRedis } from '../cache/redis';

export const healthRoutes = Router();

interface HealthResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  checks: {
    api: boolean;
    database: boolean;
    cache: boolean;
  };
  uptime: number;
  timestamp: string;
}

healthRoutes.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const checks = {
      api: true,
      database: AppDataSource.isInitialized,
      cache: (await checkRedis()).status === 'ok',
    };

    const status = checks.database && checks.cache ? 'healthy' : 'degraded';

    const response: HealthResponse = {
      status,
      checks,
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    };

    res.status(status === 'healthy' ? 200 : 503).json(response);
  } catch (error) {
    console.error('Health check error:', error);
    res.status(503).json({
      status: 'unhealthy',
      checks: {
        api: false,
        database: false,
        cache: false,
      },
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    });
  }
});

healthRoutes.get('/ready', async (req: Request, res: Response): Promise<void> => {
  const ready =
    AppDataSource.isInitialized &&
    (await checkRedis()).status === 'ok';

  res.status(ready ? 200 : 503).json({
    ready,
    reason: ready ? 'All dependencies initialized' : 'Some dependencies not ready',
  });
});

async function checkRedis(): Promise<{ status: string }> {
  try {
    const redis = getRedis();
    if (redis) {
      return { status: 'ok' };
    }
    return { status: 'error' };
  } catch {
    return { status: 'error' };
  }
}

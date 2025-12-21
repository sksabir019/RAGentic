import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import 'express-async-errors';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Import routes and middleware
import { setupDatabaseAdapter, closeDatabaseAdapter } from './database/connection';
import { setupRedis } from './cache/redis';
import { errorHandler } from './middleware/errorHandler';
import { requestLogger } from './middleware/logger';
import authRoutes from './routes/auth';
import documentRoutes from './routes/documents';
import queryRoutes from './routes/queries';
import systemRoutes from './routes/system';
import { authMiddleware, adminMiddleware } from './middleware/authMiddleware';
import { healthRoutes } from './routes/health';

const app: Express = express();
const PORT = process.env.BACKEND_PORT || 3000;

// ============ Middleware Setup ============

app.use(helmet());
app.use(compression());
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3001',
  credentials: true,
  optionsSuccessStatus: 200,
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(cookieParser());
app.use(morgan('combined'));
app.use(requestLogger);

// ============ Routes ============

app.use('/health', healthRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/queries', queryRoutes);
app.use('/api/system', authMiddleware, adminMiddleware, systemRoutes);

// ============ 404 Handler ============

app.use((req: Request, res: Response): void => {
  res.status(404).json({
    error: 'Resource not found',
  });
});

// ============ Error Handler ============

app.use(errorHandler);

// ============ Server Initialization ============

async function startServer(): Promise<void> {
  try {
    // Initialize database
    await setupDatabaseAdapter();
    console.log('✓ Database connected');

    // Initialize Redis
    await setupRedis();
    console.log('✓ Redis connected');

    // Start server
    const server = app.listen(PORT, () => {
      console.log(`✓ Server running on http://localhost:${PORT}`);
    });

    // Handle graceful shutdown
    const handleShutdown = async (signal: string): Promise<void> => {
      console.log(`${signal} received, shutting down gracefully...`);
      
      server.close(async () => {
        await closeDatabaseAdapter();
        console.log('Database connection closed');
        process.exit(0);
      });
    };

    process.on('SIGTERM', () => handleShutdown('SIGTERM'));
    process.on('SIGINT', () => handleShutdown('SIGINT'));
  } catch (error) {
    console.error('✗ Server startup failed:', error);
    process.exit(1);
  }
}

// eslint-disable-next-line @typescript-eslint/no-floating-promises
startServer();

export default app;

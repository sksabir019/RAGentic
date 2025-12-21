import { Request, Response, NextFunction } from 'express';
import logger from './logger';

export interface AppError extends Error {
  statusCode?: number;
  code?: string;
}

export function errorHandler(
  err: AppError,
  req: Request,
  res: Response,
  next: NextFunction
) {
  const statusCode = err.statusCode || 500;
  const code = err.code || 'INTERNAL_ERROR';
  const message = err.message || 'An unexpected error occurred';

  logger.error('Error', {
    code,
    message,
    statusCode,
    stack: err.stack,
    traceId: req.headers['x-trace-id']
  });

  res.status(statusCode).json({
    success: false,
    error: {
      code,
      message,
      details: process.env.NODE_ENV === 'development' ? { stack: err.stack } : {}
    },
    metadata: {
      timestamp: new Date().toISOString(),
      traceId: req.headers['x-trace-id']
    }
  });
}

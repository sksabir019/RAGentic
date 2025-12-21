import { Request, Response, NextFunction } from 'express';
import { AuthUtils } from '../utils/AuthUtils';

declare global {
  namespace Express {
    interface Request {
      userId?: string;
      user?: {
        userId: string;
        email: string;
        role: 'admin' | 'user';
      };
    }
  }
}

export function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader?.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Missing or invalid authorization header' });
      return;
    }

    const token = authHeader.substring(7);
    const payload = AuthUtils.verifyToken(token);

    req.userId = payload.userId;
    req.user = payload;

    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(401).json({ error: 'Invalid token' });
  }
}

export function adminMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (!req.user?.role || req.user.role !== 'admin') {
    res.status(403).json({ error: 'Insufficient permissions' });
    return;
  }

  next();
}

export function optionalAuthMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  try {
    const authHeader = req.headers.authorization;
    
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const payload = AuthUtils.verifyToken(token);
      req.userId = payload.userId;
      req.user = payload;
    }

    next();
  } catch (error) {
    console.error('Optional auth error:', error);
    // If token is invalid, just continue without auth
    next();
  }
}

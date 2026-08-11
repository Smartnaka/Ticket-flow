import { NextFunction, Request, Response } from 'express';

interface RateLimitRecord {
  count: number;
  resetTime: number;
}

const ipMap = new Map<string, RateLimitRecord>();

/**
 * Express Rate Limiting Middleware
 * @param windowMs Time window in milliseconds (e.g. 15 minutes = 900,000 ms)
 * @param maxRequests Maximum requests permitted per window
 */
export function createRateLimiter(windowMs: number = 15 * 60 * 1000, maxRequests: number = 100) {
  return (req: Request, res: Response, next: NextFunction) => {
    const ip = (req.headers['x-forwarded-for'] as string) || req.ip || '127.0.0.1';
    const now = Date.now();
    const record = ipMap.get(ip);

    if (!record || now > record.resetTime) {
      ipMap.set(ip, { count: 1, resetTime: now + windowMs });
      return next();
    }

    if (record.count >= maxRequests) {
      return res.status(429).json({
        error: 'Too many requests from this IP. Please try again later.',
        retryAfterSeconds: Math.ceil((record.resetTime - now) / 1000),
      });
    }

    record.count++;
    next();
  };
}

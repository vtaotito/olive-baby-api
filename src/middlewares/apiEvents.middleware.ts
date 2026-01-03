// Olive Baby API - API Events Logging Middleware
// Logs 4xx/5xx errors and latency for analytics
import { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthenticatedRequest } from '../types';

const prisma = new PrismaClient();

// Routes to skip logging (high volume, low value)
const SKIP_ROUTES = [
  '/health',
  '/api/v1/health',
  '/favicon.ico',
];

// Log only errors (4xx/5xx) and slow requests (> 2s)
const SLOW_REQUEST_THRESHOLD_MS = 2000;

export function apiEventsMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const startTime = Date.now();
  const authReq = req as AuthenticatedRequest;

  // Skip certain routes
  if (SKIP_ROUTES.some(r => req.path.startsWith(r))) {
    return next();
  }

  // Override res.end to capture response
  const originalEnd = res.end.bind(res);
  res.end = function (this: Response, chunk?: any, encoding?: BufferEncoding | (() => void), cb?: () => void) {
    const durationMs = Date.now() - startTime;
    const statusCode = res.statusCode;

    // Only log errors (4xx/5xx) or slow requests
    if (statusCode >= 400 || durationMs >= SLOW_REQUEST_THRESHOLD_MS) {
      // Extract error message from response if available
      let errorMessage: string | undefined;
      if (statusCode >= 400 && chunk) {
        try {
          const body = typeof chunk === 'string' ? JSON.parse(chunk) : chunk;
          errorMessage = body.error || body.message;
        } catch {
          // Ignore parsing errors
        }
      }

      // Log asynchronously - don't block response
      logApiEvent({
        userId: authReq.user?.userId || null,
        route: normalizeRoute(req.path),
        method: req.method,
        statusCode,
        durationMs,
        errorMessage,
        userAgent: req.headers['user-agent'] || null,
        ipAddress: getClientIp(req),
      }).catch(err => {
        console.error('Failed to log API event:', err);
      });
    }

    if (typeof encoding === 'function') {
      return originalEnd(chunk, encoding);
    }
    return originalEnd(chunk, encoding, cb);
  } as typeof res.end;

  next();
}

/**
 * Normalize route to avoid high cardinality (e.g., /users/123 -> /users/:id)
 */
function normalizeRoute(path: string): string {
  return path
    // Replace numeric IDs
    .replace(/\/\d+/g, '/:id')
    // Replace UUIDs
    .replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '/:uuid')
    // Limit length
    .substring(0, 250);
}

/**
 * Get client IP address
 */
function getClientIp(req: Request): string | null {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }
  return req.ip || req.socket?.remoteAddress || null;
}

/**
 * Log API event to database
 */
async function logApiEvent(data: {
  userId: number | null;
  route: string;
  method: string;
  statusCode: number;
  durationMs: number;
  errorMessage?: string | null;
  userAgent: string | null;
  ipAddress: string | null;
}): Promise<void> {
  await prisma.apiEvent.create({
    data: {
      userId: data.userId,
      route: data.route,
      method: data.method,
      statusCode: data.statusCode,
      durationMs: data.durationMs,
      errorMessage: data.errorMessage || null,
      userAgent: data.userAgent,
      ipAddress: data.ipAddress,
    },
  });
}


// Olive Baby API - Correlation ID Middleware
// Adds unique correlation ID to each request for traceability
import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../config/logger';

// Header name for correlation ID
const CORRELATION_ID_HEADER = 'x-correlation-id';

// Extend Request type to include correlationId
declare global {
  namespace Express {
    interface Request {
      correlationId: string;
      logger: typeof logger;
    }
  }
}

/**
 * Middleware that adds correlation ID to requests
 * - Uses existing X-Correlation-ID header if provided (for frontend-to-backend tracing)
 * - Generates new UUID if not provided
 * - Adds correlationId to request object
 * - Returns correlationId in response header
 * - Creates child logger with correlationId for structured logging
 */
export function correlationMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // Get correlation ID from header or generate new one
  const correlationId = (req.headers[CORRELATION_ID_HEADER] as string) || uuidv4();
  
  // Add to request object for use in handlers
  req.correlationId = correlationId;
  
  // Add to response header for client-side correlation
  res.setHeader(CORRELATION_ID_HEADER, correlationId);
  
  // Create child logger with correlation ID for structured logging
  // This ensures all logs from this request include the correlation ID
  req.logger = logger.child({ correlationId });
  
  next();
}

/**
 * Helper to get correlation ID from request
 */
export function getCorrelationId(req: Request): string {
  return req.correlationId || 'unknown';
}

export default correlationMiddleware;

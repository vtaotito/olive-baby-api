// Olive Baby API - Monitoring Routes
import { Router, Request, Response, NextFunction } from 'express';
import { monitoringService } from '../services/monitoring.service';
import { logger } from '../config/logger';
import { env } from '../config/env';

const router = Router();

/**
 * Bearer-token guard for sensitive monitoring endpoints.
 * Requires MONITORING_TOKEN to be set; if unset, all detailed
 * monitoring routes are locked down (403).
 */
function requireMonitoringToken(req: Request, res: Response, next: NextFunction): void {
  const token = env.MONITORING_TOKEN;
  if (!token) {
    res.status(403).json({ success: false, message: 'Monitoring access is disabled (no token configured)' });
    return;
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ') || authHeader.split(' ')[1] !== token) {
    res.status(401).json({ success: false, message: 'Invalid or missing monitoring token' });
    return;
  }

  next();
}

/**
 * GET /monitoring/status
 * Status simplificado (público — para load balancers e uptime checks)
 */
router.get('/status', async (req, res) => {
  try {
    const health = await monitoringService.getHealthStatus();
    
    if (health.status === 'unhealthy') {
      return res.status(503).json({
        status: 'unhealthy',
      });
    }

    res.json({
      status: 'ok',
    });
  } catch (error) {
    res.status(503).json({
      status: 'error',
    });
  }
});

// --- Protected endpoints below require MONITORING_TOKEN ---
router.use(requireMonitoringToken);

/**
 * GET /monitoring/health
 * Health check completo com métricas (protegido)
 */
router.get('/health', async (req, res) => {
  try {
    const health = await monitoringService.getHealthStatus();
    
    const statusCode = health.status === 'healthy' 
      ? 200 
      : health.status === 'degraded' 
        ? 200 
        : 503;

    res.status(statusCode).json({
      success: true,
      data: health,
    });
  } catch (error: any) {
    logger.error('Health check failed', { error: error.message });
    res.status(503).json({
      success: false,
      status: 'unhealthy',
      message: 'Health check failed',
    });
  }
});

/**
 * GET /monitoring/metrics
 * Métricas do sistema (protegido)
 */
router.get('/metrics', async (req, res) => {
  try {
    const health = await monitoringService.getHealthStatus();
    
    res.json({
      success: true,
      data: {
        ...health.metrics,
        checks: health.checks,
      },
    });
  } catch (error: any) {
    logger.error('Failed to get metrics', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve metrics',
    });
  }
});

export default router;

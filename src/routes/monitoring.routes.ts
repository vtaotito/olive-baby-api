// Olive Baby API - Monitoring Routes
import { Router } from 'express';
import { monitoringService } from '../services/monitoring.service';
import { logger } from '../config/logger';

const router = Router();

/**
 * GET /monitoring/health
 * Health check completo com métricas
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
 * Métricas do sistema
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

/**
 * GET /monitoring/status
 * Status simplificado (para load balancers)
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

export default router;

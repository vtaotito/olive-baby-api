// Olive Baby API - Monitoring Utilities

/**
 * Inicia monitoramento periódico de saúde
 */
export function startHealthMonitoring(intervalMs: number = 60000) {
  const { monitoringService } = require('../services/monitoring.service');
  
  setInterval(async () => {
    try {
      const health = await monitoringService.getHealthStatus();
      
      if (health.status === 'unhealthy') {
        // Já envia alerta no monitoring service
        console.error('⚠️ System unhealthy:', health);
      } else if (health.status === 'degraded') {
        console.warn('⚠️ System degraded:', health);
      }
    } catch (error) {
      console.error('❌ Health monitoring failed:', error);
    }
  }, intervalMs);
}

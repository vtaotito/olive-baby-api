// Olive Baby API - Monitoring Middleware
import { Request, Response, NextFunction } from 'express';
import { monitoringService } from '../services/monitoring.service';
import { logger } from '../config/logger';

/**
 * Middleware para monitoramento de requisições
 */
export function monitoringMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const start = Date.now();
  
  // Registrar requisição
  monitoringService.recordRequest();

  // Interceptar resposta
  const originalSend = res.send;
  res.send = function (body) {
    const duration = Date.now() - start;
    
    // Log da requisição
    logger.info('HTTP Request', {
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip,
      userAgent: req.get('user-agent'),
    });

    // Registrar erro se status >= 400
    if (res.statusCode >= 400) {
      monitoringService.recordError();
      
      // Enviar alerta para erros críticos
      if (res.statusCode >= 500) {
        monitoringService.sendAlert({
          level: 'error',
          title: 'Server Error',
          message: `${req.method} ${req.url} returned ${res.statusCode}`,
          component: 'api',
          metadata: {
            method: req.method,
            url: req.url,
            statusCode: res.statusCode,
            duration,
          },
        });
      }
    }

    return originalSend.call(this, body);
  };

  next();
}

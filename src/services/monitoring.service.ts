// Olive Baby API - Monitoring Service
import os from 'os';
import { Redis } from 'ioredis';
import { logger } from '../config/logger';
import { env } from '../config/env';
import * as emailService from './email.service';
import { AlertService } from './alert.service';
import { prisma } from '../config/database';

// Cache para evitar alertas duplicados
const alertCache = new Map<string, number>();
const ALERT_COOLDOWN = 5 * 60 * 1000; // 5 minutos

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  checks: {
    database: { status: 'up' | 'down'; responseTime?: number };
    redis: { status: 'up' | 'down'; responseTime?: number };
    disk: { status: 'ok' | 'warning' | 'critical'; usage?: number };
    memory: { status: 'ok' | 'warning' | 'critical'; usage?: number };
  };
  metrics: {
    uptime: number;
    requestsPerMinute: number;
    errorRate: number;
    activeConnections: number;
  };
}

interface Alert {
  level: 'info' | 'warning' | 'error' | 'critical';
  title: string;
  message: string;
  component: string;
  metadata?: Record<string, any>;
}

class MonitoringService {
  private redis: Redis | null = null;
  private requestCount = 0;
  private errorCount = 0;
  private startTime = Date.now();
  private requestTimestamps: number[] = [];

  constructor() {
    this.initializeRedis();
    this.startMetricsCollection();
  }

  private async initializeRedis() {
    try {
      if (!env.REDIS_URL) {
        logger.warn('REDIS_URL not configured, skipping Redis initialization');
        return;
      }
      
      this.redis = new Redis(env.REDIS_URL, {
        maxRetriesPerRequest: 3,
        retryStrategy: (times) => {
          if (times > 3) {
            this.sendAlert({
              level: 'critical',
              title: 'Redis Connection Failed',
              message: 'Redis não conseguiu conectar após múltiplas tentativas',
              component: 'redis',
            });
            return null;
          }
          return Math.min(times * 50, 2000);
        },
      });

      this.redis.on('error', (error) => {
        logger.error('Redis error', { error: error.message });
        this.sendAlert({
          level: 'error',
          title: 'Redis Error',
          message: error.message,
          component: 'redis',
        });
      });
    } catch (error) {
      logger.error('Failed to initialize Redis', { error });
    }
  }

  private startMetricsCollection() {
    // Limpar timestamps antigos a cada minuto
    setInterval(() => {
      const oneMinuteAgo = Date.now() - 60000;
      this.requestTimestamps = this.requestTimestamps.filter(
        (timestamp) => timestamp > oneMinuteAgo
      );
    }, 60000);
  }

  /**
   * Registra uma requisição
   */
  recordRequest() {
    this.requestCount++;
    this.requestTimestamps.push(Date.now());
  }

  /**
   * Registra um erro
   */
  recordError() {
    this.errorCount++;
  }

  /**
   * Health check completo
   */
  async getHealthStatus(): Promise<HealthStatus> {
    const checks = {
      database: await this.checkDatabase(),
      redis: await this.checkRedis(),
      disk: await this.checkDisk(),
      memory: await this.checkMemory(),
    };

    // Determinar status geral
    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    if (
      checks.database.status === 'down' ||
      checks.redis.status === 'down' ||
      checks.disk.status === 'critical' ||
      checks.memory.status === 'critical'
    ) {
      status = 'unhealthy';
    } else if (
      checks.disk.status === 'warning' ||
      checks.memory.status === 'warning'
    ) {
      status = 'degraded';
    }

    // Calcular métricas
    const uptime = Math.floor((Date.now() - this.startTime) / 1000);
    const requestsPerMinute = this.requestTimestamps.length;
    const errorRate = this.requestCount > 0 
      ? (this.errorCount / this.requestCount) * 100 
      : 0;

    return {
      status,
      timestamp: new Date().toISOString(),
      checks,
      metrics: {
        uptime,
        requestsPerMinute,
        errorRate: parseFloat(errorRate.toFixed(2)),
        activeConnections: 0, // Pode ser implementado com tracking de conexões
      },
    };
  }

  /**
   * Verifica status do banco de dados
   */
  private async checkDatabase(): Promise<{ status: 'up' | 'down'; responseTime?: number }> {
    try {
      const start = Date.now();
      await prisma.$queryRaw`SELECT 1`;
      const responseTime = Date.now() - start;

      if (responseTime > 1000) {
        this.sendAlert({
          level: 'warning',
          title: 'Database Slow Response',
          message: `Database response time: ${responseTime}ms`,
          component: 'database',
          metadata: { responseTime },
        });
      }

      return { status: 'up', responseTime };
    } catch (error: any) {
      logger.error('Database health check failed', { error: error.message });
      this.sendAlert({
        level: 'critical',
        title: 'Database Unavailable',
        message: error.message,
        component: 'database',
      });
      return { status: 'down' };
    }
  }

  /**
   * Verifica status do Redis
   */
  private async checkRedis(): Promise<{ status: 'up' | 'down'; responseTime?: number }> {
    if (!this.redis) {
      return { status: 'down' };
    }

    try {
      const start = Date.now();
      await this.redis.ping();
      const responseTime = Date.now() - start;

      return { status: 'up', responseTime };
    } catch (error: any) {
      logger.error('Redis health check failed', { error: error.message });
      return { status: 'down' };
    }
  }

  /**
   * Verifica uso de disco
   */
  private async checkDisk(): Promise<{ status: 'ok' | 'warning' | 'critical'; usage?: number }> {
    try {
      // Usar módulo 'diskusage' se disponível, senão retornar ok
      // Em produção, considere instalar: npm install diskusage
      // Por enquanto, retornamos ok (pode ser implementado depois)
      return { status: 'ok' };
    } catch (error: any) {
      // Em Windows ou sem permissões, retorna ok
      logger.debug('Disk check not available', { error: error.message });
      return { status: 'ok' };
    }
  }

  /**
   * Verifica uso de memória.
   * Compara RSS (memória real do processo) contra a memória total do sistema
   * ou um limite configurável via MEMORY_LIMIT_MB.
   * O cálculo antigo (heapUsed/heapTotal) gerava alarmes falsos porque
   * o V8 expande heapTotal dinamicamente.
   */
  private async checkMemory(): Promise<{ status: 'ok' | 'warning' | 'critical'; usage?: number }> {
    try {
      const memUsage = process.memoryUsage();
      const rssBytes = memUsage.rss;

      const memoryLimitMb = env.MEMORY_LIMIT_MB
        ? parseInt(env.MEMORY_LIMIT_MB, 10)
        : 0;
      const totalBytes = memoryLimitMb > 0
        ? memoryLimitMb * 1024 * 1024
        : os.totalmem();

      const memoryPercent = (rssBytes / totalBytes) * 100;

      const metadata = {
        usage: memoryPercent,
        rssMb: Math.round(rssBytes / 1024 / 1024),
        totalMb: Math.round(totalBytes / 1024 / 1024),
        heapUsedMb: Math.round(memUsage.heapUsed / 1024 / 1024),
        heapTotalMb: Math.round(memUsage.heapTotal / 1024 / 1024),
        externalMb: Math.round(memUsage.external / 1024 / 1024),
      };

      if (memoryPercent > 90) {
        this.sendAlert({
          level: 'critical',
          title: 'Memory Usage Critical',
          message: `RSS: ${metadata.rssMb}MB / ${metadata.totalMb}MB (${memoryPercent.toFixed(1)}%)`,
          component: 'memory',
          metadata,
        });
        return { status: 'critical', usage: memoryPercent };
      } else if (memoryPercent > 75) {
        this.sendAlert({
          level: 'warning',
          title: 'Memory Usage Warning',
          message: `RSS: ${metadata.rssMb}MB / ${metadata.totalMb}MB (${memoryPercent.toFixed(1)}%)`,
          component: 'memory',
          metadata,
        });
        return { status: 'warning', usage: memoryPercent };
      }

      return { status: 'ok', usage: memoryPercent };
    } catch (error: any) {
      logger.error('Memory check failed', { error: error.message });
      return { status: 'ok' };
    }
  }

  /**
   * Envia alerta
   */
  async sendAlert(alert: Alert) {
    const alertKey = `${alert.component}-${alert.level}-${alert.title}`;
    const lastSent = alertCache.get(alertKey);

    // Evitar alertas duplicados
    if (lastSent && Date.now() - lastSent < ALERT_COOLDOWN) {
      return;
    }

    alertCache.set(alertKey, Date.now());

    const logLevel = alert.level === 'critical' 
      ? 'error' 
      : alert.level === 'warning' 
        ? 'warn' 
        : alert.level;
    
    logger[logLevel as 'error' | 'info' | 'warn'](alert.message, {
      title: alert.title,
      component: alert.component,
      alertLevel: alert.level,
      ...alert.metadata,
    });

    const severityMap: Record<string, 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL'> = {
      info: 'INFO', warning: 'WARNING', error: 'ERROR', critical: 'CRITICAL',
    };
    try {
      await AlertService.create({
        type: alert.component === 'memory' ? (alert.level === 'critical' ? 'memory_critical' : 'memory_warning') :
              alert.component === 'database' ? (alert.level === 'critical' ? 'db_down' : 'db_slow') :
              alert.component === 'redis' ? 'redis_down' : alert.component,
        severity: severityMap[alert.level] ?? 'WARNING',
        title: alert.title,
        message: alert.message,
        component: alert.component,
        metadata: alert.metadata,
      });
    } catch (err) {
      logger.warn('[Monitoring] Failed to persist alert to DB', { error: (err as Error).message });
    }

    // Enviar email para alertas críticos e erros
    if (alert.level === 'critical' || alert.level === 'error') {
      try {
        await emailService.sendAlert({
          level: alert.level,
          title: alert.title,
          message: alert.message,
          component: alert.component,
          metadata: alert.metadata,
        });
      } catch (error) {
        logger.error('Failed to send alert email', { error });
      }
    }

    // Enviar webhook se configurado
    if (env.ALERT_WEBHOOK_URL) {
      try {
        // Usar fetch nativo do Node.js 18+ ou node-fetch
        const response = await fetch(env.ALERT_WEBHOOK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...alert,
            timestamp: new Date().toISOString(),
            service: 'olive-baby-api',
          }),
        });

        if (!response.ok) {
          throw new Error(`Webhook returned ${response.status}`);
        }
      } catch (error: any) {
        logger.error('Failed to send webhook alert', { error: error.message });
      }
    }
  }

  /**
   * Reseta métricas
   */
  resetMetrics() {
    this.requestCount = 0;
    this.errorCount = 0;
    this.requestTimestamps = [];
  }

  /**
   * Limpa cache de alertas
   */
  clearAlertCache() {
    alertCache.clear();
  }
}

export const monitoringService = new MonitoringService();
export default monitoringService;

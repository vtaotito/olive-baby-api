// Olive Baby API - Rate Limiting Service
import { Redis } from 'ioredis';
import { env } from '../config/env';
import { logger } from '../config/logger';
import crypto from 'crypto';

let redisClient: Redis | null = null;

// Fallback em memória para desenvolvimento
const memoryStore = new Map<string, { count: number; resetTime: number }>();

/**
 * Inicializa cliente Redis ou usa fallback em memória
 */
function getRedisClient(): Redis | null {
  if (redisClient) {
    return redisClient;
  }

  if (env.REDIS_URL) {
    try {
      redisClient = new Redis(env.REDIS_URL, {
        maxRetriesPerRequest: 3,
        retryStrategy: (times) => {
          if (times > 3) {
            logger.warn('Redis connection failed, using memory fallback');
            return null;
          }
          return Math.min(times * 50, 2000);
        },
      });

      redisClient.on('error', (error) => {
        logger.error('Redis error', { error: error.message });
      });

      return redisClient;
    } catch (error) {
      logger.warn('Failed to connect to Redis, using memory fallback', { error });
      return null;
    }
  }

  return null;
}

/**
 * Rate limit por chave (IP ou email)
 * @param key - Chave única (ex: IP ou hash do email)
 * @param windowMs - Janela de tempo em milissegundos
 * @param maxRequests - Número máximo de requisições na janela
 * @returns true se permitido, false se bloqueado
 */
export async function checkRateLimit(
  key: string,
  windowMs: number = 10 * 60 * 1000, // 10 minutos padrão
  maxRequests: number = 5 // 5 requisições padrão
): Promise<{ allowed: boolean; remaining: number; resetAt: Date }> {
  const redis = getRedisClient();
  const now = Date.now();
  const resetAt = new Date(now + windowMs);

  if (redis) {
    // Usar Redis com sliding window
    const redisKey = `rate_limit:${key}`;
    
    try {
      // Incrementar contador
      const count = await redis.incr(redisKey);
      
      // Se é a primeira requisição, definir expiração
      if (count === 1) {
        await redis.pexpire(redisKey, windowMs);
      }

      // Calcular requisições restantes
      const remaining = Math.max(0, maxRequests - count);
      const allowed = count <= maxRequests;

      return { allowed, remaining, resetAt };
    } catch (error) {
      logger.error('Redis rate limit error', { error, key });
      // Fallback para memória em caso de erro
    }
  }

  // Fallback em memória
  const memoryKey = `${key}:${Math.floor(now / windowMs)}`;
  const stored = memoryStore.get(memoryKey);

  if (!stored || stored.resetTime < now) {
    memoryStore.set(memoryKey, { count: 1, resetTime: now + windowMs });
    return { allowed: true, remaining: maxRequests - 1, resetAt };
  }

  stored.count++;
  const remaining = Math.max(0, maxRequests - stored.count);
  const allowed = stored.count <= maxRequests;

  // Limpar entradas antigas periodicamente
  if (Math.random() < 0.01) {
    for (const [k, v] of memoryStore.entries()) {
      if (v.resetTime < now) {
        memoryStore.delete(k);
      }
    }
  }

  return { allowed, remaining, resetAt };
}

/**
 * Cria hash seguro do email para rate limiting (sem revelar o email)
 */
export function hashEmailForRateLimit(email: string): string {
  return crypto.createHash('sha256').update(email.toLowerCase().trim()).digest('hex').substring(0, 16);
}

/**
 * Obtém IP do request (considerando proxies)
 */
export function getClientIp(req: any): string {
  return (
    req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    req.headers['x-real-ip'] ||
    req.ip ||
    req.connection?.remoteAddress ||
    'unknown'
  );
}


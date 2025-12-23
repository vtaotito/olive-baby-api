// Olive Baby API - Password Reset Service
import crypto from 'crypto';
import { prisma } from '../config/database';
import { logger } from '../config/logger';
import { AppError } from '../utils/errors/AppError';

/**
 * Gera um token seguro para reset de senha
 * Retorna o token em texto plano (para enviar por email) e o hash (para armazenar)
 */
export function generateResetToken(): { token: string; tokenHash: string } {
  // Gerar token aleatório de 32 bytes (256 bits)
  const token = crypto.randomBytes(32).toString('hex');
  
  // Criar hash SHA-256 do token para armazenar no banco
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  
  return { token, tokenHash };
}

/**
 * Valida um token de reset comparando com o hash armazenado
 */
export function validateResetToken(token: string, storedHash: string): boolean {
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  return crypto.timingSafeEqual(
    Buffer.from(tokenHash),
    Buffer.from(storedHash)
  );
}

/**
 * Cria um registro de reset de senha no banco
 */
export async function createPasswordReset(
  userId: number,
  tokenHash: string,
  expiresAt: Date,
  requestIp?: string,
  userAgent?: string
) {
  // Invalidar tokens anteriores não usados do mesmo usuário
  await prisma.passwordReset.updateMany({
    where: {
      userId,
      usedAt: null,
      expiresAt: { gt: new Date() },
    },
    data: {
      usedAt: new Date(), // Marcar como usado para invalidar
    },
  });

  // Criar novo registro
  return prisma.passwordReset.create({
    data: {
      userId,
      tokenHash,
      expiresAt,
      requestIp: requestIp?.substring(0, 45) || null,
      userAgent: userAgent?.substring(0, 500) || null,
    },
  });
}

/**
 * Busca um token de reset válido (não usado e não expirado)
 */
export async function findValidResetToken(tokenHash: string) {
  const resetRecord = await prisma.passwordReset.findUnique({
    where: { tokenHash },
    include: { user: true },
  });

  if (!resetRecord) {
    return null;
  }

  // Verificar se já foi usado
  if (resetRecord.usedAt) {
    return null;
  }

  // Verificar se expirou
  if (resetRecord.expiresAt < new Date()) {
    return null;
  }

  return resetRecord;
}

/**
 * Marca um token como usado
 */
export async function markTokenAsUsed(tokenHash: string) {
  return prisma.passwordReset.update({
    where: { tokenHash },
    data: { usedAt: new Date() },
  });
}

/**
 * Limpa tokens expirados (manutenção)
 */
export async function cleanupExpiredTokens() {
  const result = await prisma.passwordReset.deleteMany({
    where: {
      expiresAt: { lt: new Date() },
    },
  });

  logger.info(`Cleaned up ${result.count} expired password reset tokens`);
  return result.count;
}

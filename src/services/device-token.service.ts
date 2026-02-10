// Olive Baby API - Device Token Service
// Gerencia tokens de dispositivos para push notifications (FCM, APNS, Expo, Web Push)
import { prisma } from '../config/database';
import { DevicePlatform } from '@prisma/client';
import { AppError } from '../utils/errors/AppError';
import { logger } from '../config/logger';

// ==========================================
// Types
// ==========================================

export interface RegisterDeviceTokenInput {
  userId: number;
  token: string;
  platform: DevicePlatform;
  deviceName?: string;
  deviceModel?: string;
  osVersion?: string;
  appVersion?: string;
}

export interface DeviceTokenInfo {
  id: number;
  token: string;
  platform: DevicePlatform;
  deviceName: string | null;
  deviceModel: string | null;
  osVersion: string | null;
  appVersion: string | null;
  isActive: boolean;
  lastUsedAt: Date;
  createdAt: Date;
}

// ==========================================
// Service
// ==========================================

export class DeviceTokenService {
  /**
   * Register or update a device token
   * Upsert: if token already exists for this user, update metadata
   */
  static async registerToken(input: RegisterDeviceTokenInput): Promise<DeviceTokenInfo> {
    const { userId, token, platform, deviceName, deviceModel, osVersion, appVersion } = input;

    // Upsert: cria ou atualiza o token existente
    const deviceToken = await prisma.deviceToken.upsert({
      where: {
        userId_token: { userId, token },
      },
      create: {
        userId,
        token,
        platform,
        deviceName: deviceName || null,
        deviceModel: deviceModel || null,
        osVersion: osVersion || null,
        appVersion: appVersion || null,
        isActive: true,
        lastUsedAt: new Date(),
      },
      update: {
        platform,
        deviceName: deviceName || undefined,
        deviceModel: deviceModel || undefined,
        osVersion: osVersion || undefined,
        appVersion: appVersion || undefined,
        isActive: true,
        lastUsedAt: new Date(),
      },
    });

    logger.info(`[DeviceToken] Token registrado para user ${userId} (${platform})`, {
      userId,
      platform,
      deviceTokenId: deviceToken.id,
    });

    return deviceToken;
  }

  /**
   * Unregister a device token (on logout or when user removes device)
   */
  static async unregisterToken(userId: number, token: string): Promise<void> {
    const existing = await prisma.deviceToken.findUnique({
      where: {
        userId_token: { userId, token },
      },
    });

    if (!existing) {
      // Token não existe, tudo bem - idempotente
      return;
    }

    await prisma.deviceToken.delete({
      where: {
        userId_token: { userId, token },
      },
    });

    logger.info(`[DeviceToken] Token removido para user ${userId}`, { userId });
  }

  /**
   * Deactivate a token (mark as inactive instead of deleting)
   * Useful when push delivery fails (invalid token)
   */
  static async deactivateToken(token: string): Promise<void> {
    await prisma.deviceToken.updateMany({
      where: { token },
      data: { isActive: false },
    });

    logger.info(`[DeviceToken] Token desativado: ${token.substring(0, 20)}...`);
  }

  /**
   * Deactivate all tokens for a user (on account deletion)
   */
  static async deactivateAllForUser(userId: number): Promise<number> {
    const result = await prisma.deviceToken.updateMany({
      where: { userId, isActive: true },
      data: { isActive: false },
    });

    return result.count;
  }

  /**
   * List active device tokens for a user
   */
  static async listUserTokens(userId: number): Promise<DeviceTokenInfo[]> {
    return prisma.deviceToken.findMany({
      where: { userId, isActive: true },
      orderBy: { lastUsedAt: 'desc' },
    });
  }

  /**
   * Get all active tokens for a user (for sending push notifications)
   */
  static async getActiveTokensForUser(userId: number): Promise<{ token: string; platform: DevicePlatform }[]> {
    return prisma.deviceToken.findMany({
      where: { userId, isActive: true },
      select: { token: true, platform: true },
    });
  }

  /**
   * Get active tokens for multiple users (batch push notification)
   */
  static async getActiveTokensForUsers(userIds: number[]): Promise<{ userId: number; token: string; platform: DevicePlatform }[]> {
    return prisma.deviceToken.findMany({
      where: {
        userId: { in: userIds },
        isActive: true,
      },
      select: { userId: true, token: true, platform: true },
    });
  }

  /**
   * Update the lastUsedAt timestamp (called when a push is sent successfully)
   */
  static async touchToken(token: string): Promise<void> {
    await prisma.deviceToken.updateMany({
      where: { token },
      data: { lastUsedAt: new Date() },
    });
  }

  /**
   * Cleanup: remove tokens that haven't been used in X days
   */
  static async cleanupStaleTokens(staleDays: number = 90): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - staleDays);

    const result = await prisma.deviceToken.deleteMany({
      where: {
        lastUsedAt: { lt: cutoffDate },
      },
    });

    if (result.count > 0) {
      logger.info(`[DeviceToken] Cleanup: ${result.count} tokens antigos removidos (>${staleDays} dias)`);
    }

    return result.count;
  }

  /**
   * Get statistics about device tokens (admin)
   */
  static async getStats(): Promise<{
    total: number;
    active: number;
    byPlatform: Record<string, number>;
  }> {
    const [total, active, platformCounts] = await Promise.all([
      prisma.deviceToken.count(),
      prisma.deviceToken.count({ where: { isActive: true } }),
      prisma.deviceToken.groupBy({
        by: ['platform'],
        _count: true,
        where: { isActive: true },
      }),
    ]);

    const byPlatform: Record<string, number> = {};
    for (const item of platformCounts) {
      byPlatform[item.platform] = item._count;
    }

    return { total, active, byPlatform };
  }
}

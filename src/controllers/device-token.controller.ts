// Olive Baby API - Device Token Controller
// Endpoints para registro e gerenciamento de device tokens (push notifications)
import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { AuthenticatedRequest, ApiResponse } from '../types';
import { DeviceTokenService } from '../services/device-token.service';
import { PushNotificationService } from '../services/push-notification.service';
import { getVapidPublicKey } from '../config/webpush';
import { prisma } from '../config/database';
import { AppError } from '../utils/errors/AppError';

// ==========================================
// Validation Schemas
// ==========================================

export const registerTokenSchema = z.object({
  token: z.string().min(1, 'Token é obrigatório').max(4000), // Web Push subscriptions can be long JSON
  platform: z.enum(['WEB', 'ANDROID', 'IOS', 'EXPO'], {
    errorMap: () => ({ message: 'Plataforma deve ser WEB, ANDROID, IOS ou EXPO' }),
  }),
  deviceName: z.string().max(100).optional(),
  deviceModel: z.string().max(100).optional(),
  osVersion: z.string().max(50).optional(),
  appVersion: z.string().max(20).optional(),
});

export const unregisterTokenSchema = z.object({
  token: z.string().min(1, 'Token é obrigatório').max(4000),
});

// ==========================================
// Controller
// ==========================================

export class DeviceTokenController {
  /**
   * GET /device-tokens/vapid-public-key
   * Returns the VAPID public key needed by the frontend to subscribe to Web Push
   * This endpoint is public (no auth required) so the frontend can get it before login
   */
  static async getVapidPublicKey(
    req: Request,
    res: Response<ApiResponse>,
    next: NextFunction
  ): Promise<void> {
    try {
      const publicKey = getVapidPublicKey();

      if (!publicKey) {
        throw AppError.internal('Web Push não está configurado no servidor');
      }

      res.json({
        success: true,
        data: { publicKey },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /device-tokens/capabilities
   * Returns which push notification providers are configured
   */
  static async getCapabilities(
    req: Request,
    res: Response<ApiResponse>,
    next: NextFunction
  ): Promise<void> {
    try {
      const capabilities = PushNotificationService.getCapabilities();

      res.json({
        success: true,
        data: capabilities,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /device-tokens
   * Register a device token for push notifications
   */
  static async register(
    req: AuthenticatedRequest,
    res: Response<ApiResponse>,
    next: NextFunction
  ): Promise<void> {
    try {
      const userId = req.user!.userId;
      const data = registerTokenSchema.parse(req.body);

      const deviceToken = await DeviceTokenService.registerToken({
        userId,
        token: data.token,
        platform: data.platform,
        deviceName: data.deviceName,
        deviceModel: data.deviceModel,
        osVersion: data.osVersion,
        appVersion: data.appVersion,
      });

      res.status(201).json({
        success: true,
        message: 'Device token registrado com sucesso',
        data: {
          id: deviceToken.id,
          platform: deviceToken.platform,
          deviceName: deviceToken.deviceName,
          isActive: deviceToken.isActive,
          lastUsedAt: deviceToken.lastUsedAt,
          createdAt: deviceToken.createdAt,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * DELETE /device-tokens
   * Unregister a device token (e.g., on logout)
   */
  static async unregister(
    req: AuthenticatedRequest,
    res: Response<ApiResponse>,
    next: NextFunction
  ): Promise<void> {
    try {
      const userId = req.user!.userId;
      const data = unregisterTokenSchema.parse(req.body);

      await DeviceTokenService.unregisterToken(userId, data.token);

      res.json({
        success: true,
        message: 'Device token removido com sucesso',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /device-tokens
   * List all active device tokens for the authenticated user
   */
  static async list(
    req: AuthenticatedRequest,
    res: Response<ApiResponse>,
    next: NextFunction
  ): Promise<void> {
    try {
      const userId = req.user!.userId;

      const tokens = await DeviceTokenService.listUserTokens(userId);

      // Sanitize: don't expose full token in list response
      const sanitized = tokens.map((t) => ({
        id: t.id,
        platform: t.platform,
        deviceName: t.deviceName,
        deviceModel: t.deviceModel,
        osVersion: t.osVersion,
        appVersion: t.appVersion,
        isActive: t.isActive,
        lastUsedAt: t.lastUsedAt,
        createdAt: t.createdAt,
        tokenPrefix: t.token.substring(0, 20) + '...',
      }));

      res.json({
        success: true,
        data: sanitized,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * DELETE /device-tokens/:id
   * Remove a specific device token by ID
   */
  static async removeById(
    req: AuthenticatedRequest,
    res: Response<ApiResponse>,
    next: NextFunction
  ): Promise<void> {
    try {
      const userId = req.user!.userId;
      const tokenId = parseInt(req.params.id, 10);

      if (isNaN(tokenId)) {
        throw AppError.badRequest('ID inválido');
      }

      const deviceToken = await prisma.deviceToken.findFirst({
        where: { id: tokenId, userId },
      });

      if (!deviceToken) {
        throw AppError.notFound('Device token não encontrado');
      }

      await prisma.deviceToken.delete({
        where: { id: tokenId },
      });

      res.json({
        success: true,
        message: 'Device token removido com sucesso',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /device-tokens/test
   * Send a real test push notification to all user's registered devices
   */
  static async testPush(
    req: AuthenticatedRequest,
    res: Response<ApiResponse>,
    next: NextFunction
  ): Promise<void> {
    try {
      const userId = req.user!.userId;

      const tokens = await DeviceTokenService.getActiveTokensForUser(userId);

      if (tokens.length === 0) {
        throw AppError.badRequest('Nenhum device token registrado. Registre um token primeiro.');
      }

      // Send real test push notification
      const results = await PushNotificationService.sendToUser(userId, {
        title: '🫒 Olive Baby - Teste',
        body: 'Push notification funcionando! Você receberá alertas importantes do seu bebê aqui.',
        icon: '/icon-192x192.png',
        clickAction: '/',
        tag: 'test-notification',
        data: {
          type: 'TEST',
          timestamp: new Date().toISOString(),
        },
      });

      const successCount = results.filter((r) => r.success).length;
      const failures = results.filter((r) => !r.success);

      res.json({
        success: true,
        message: `Push enviado: ${successCount}/${results.length} sucesso`,
        data: {
          total: results.length,
          success: successCount,
          failed: failures.length,
          results: results.map((r) => ({
            platform: r.platform,
            success: r.success,
            error: r.error || null,
          })),
          capabilities: PushNotificationService.getCapabilities(),
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /device-tokens/stats (Admin)
   * Get device token statistics
   */
  static async getStats(
    req: AuthenticatedRequest,
    res: Response<ApiResponse>,
    next: NextFunction
  ): Promise<void> {
    try {
      const stats = await DeviceTokenService.getStats();
      const capabilities = PushNotificationService.getCapabilities();

      res.json({
        success: true,
        data: {
          ...stats,
          capabilities,
        },
      });
    } catch (error) {
      next(error);
    }
  }
}

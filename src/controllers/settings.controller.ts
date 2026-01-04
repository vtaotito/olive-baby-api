// Olive Baby API - Settings Controller
import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { SettingsService } from '../services/settings.service';
import { ApiResponse, AuthenticatedRequest } from '../types';
import { AppError } from '../utils/errors/AppError';

// Schemas de validação
export const notificationSettingsSchema = z.object({
  pushEnabled: z.boolean().optional(),
  emailEnabled: z.boolean().optional(),
  soundEnabled: z.boolean().optional(),
  quietHoursEnabled: z.boolean().optional(),
  quietHoursStart: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Formato de hora inválido (HH:MM)').optional(),
  quietHoursEnd: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Formato de hora inválido (HH:MM)').optional(),
  routineNotifications: z.object({
    feeding: z.boolean().optional(),
    sleep: z.boolean().optional(),
    diaper: z.boolean().optional(),
    bath: z.boolean().optional(),
    extraction: z.boolean().optional(),
  }).optional(),
});

export const appearanceSettingsSchema = z.object({
  theme: z.enum(['light', 'dark', 'system']).optional(),
  language: z.string().min(2).max(10).optional(),
  timezone: z.string().min(1).max(50).optional(),
});

export const timezoneSchema = z.object({
  timezone: z.string().min(1).max(50),
});

export class SettingsController {
  static async getSettings(
    req: AuthenticatedRequest,
    res: Response<ApiResponse>,
    next: NextFunction
  ): Promise<void> {
    try {
      const userId = req.user?.userId;

      if (!userId) {
        throw AppError.unauthorized('Usuário não autenticado');
      }

      const settings = await SettingsService.getSettings(userId);

      res.status(200).json({
        success: true,
        data: settings,
      });
    } catch (error) {
      next(error);
    }
  }

  static async updateNotifications(
    req: AuthenticatedRequest,
    res: Response<ApiResponse>,
    next: NextFunction
  ): Promise<void> {
    try {
      const userId = req.user?.userId;

      if (!userId) {
        throw AppError.unauthorized('Usuário não autenticado');
      }

      const data = req.body;
      const notifications = await SettingsService.updateNotifications(userId, data);

      res.status(200).json({
        success: true,
        message: 'Configurações de notificações atualizadas',
        data: notifications,
      });
    } catch (error) {
      next(error);
    }
  }

  static async updateAppearance(
    req: AuthenticatedRequest,
    res: Response<ApiResponse>,
    next: NextFunction
  ): Promise<void> {
    try {
      const userId = req.user?.userId;

      if (!userId) {
        throw AppError.unauthorized('Usuário não autenticado');
      }

      const data = req.body;
      const appearance = await SettingsService.updateAppearance(userId, data);

      res.status(200).json({
        success: true,
        message: 'Configurações de aparência atualizadas',
        data: appearance,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /settings/timezone
   * Get user's timezone
   */
  static async getTimezone(
    req: AuthenticatedRequest,
    res: Response<ApiResponse>,
    next: NextFunction
  ): Promise<void> {
    try {
      const userId = req.user?.userId;

      if (!userId) {
        throw AppError.unauthorized('Usuário não autenticado');
      }

      const timezone = await SettingsService.getUserTimezone(userId);

      res.status(200).json({
        success: true,
        data: { timezone },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PUT /settings/timezone
   * Update user's timezone
   */
  static async updateTimezone(
    req: AuthenticatedRequest,
    res: Response<ApiResponse>,
    next: NextFunction
  ): Promise<void> {
    try {
      const userId = req.user?.userId;

      if (!userId) {
        throw AppError.unauthorized('Usuário não autenticado');
      }

      const { timezone } = req.body;
      const updatedTimezone = await SettingsService.updateTimezone(userId, timezone);

      res.status(200).json({
        success: true,
        message: 'Fuso horário atualizado',
        data: { timezone: updatedTimezone },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /settings/timezones
   * Get available timezones list
   */
  static async getAvailableTimezones(
    req: AuthenticatedRequest,
    res: Response<ApiResponse>,
    next: NextFunction
  ): Promise<void> {
    try {
      const timezones = SettingsService.getAvailableTimezones();

      res.status(200).json({
        success: true,
        data: timezones,
      });
    } catch (error) {
      next(error);
    }
  }
}


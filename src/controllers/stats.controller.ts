// Olive Baby API - Stats Controller
import { Response, NextFunction } from 'express';
import { z } from 'zod';
import { StatsService } from '../services/stats.service';
import { CaregiverService } from '../services/caregiver.service';
import { AuthenticatedRequest, ApiResponse } from '../types';
import { AppError } from '../utils/errors/AppError';

// Schemas de validação
export const statsQuerySchema = z.object({
  range: z.enum(['24h', '7d', '14d', '30d', '90d']).optional().default('7d'),
});

export class StatsController {
  private static async getCaregiverId(userId: number): Promise<number> {
    const caregiver = await CaregiverService.getByUserId(userId);
    return caregiver.id;
  }

  static async getStats(
    req: AuthenticatedRequest,
    res: Response<ApiResponse>,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user) {
        throw AppError.unauthorized();
      }

      const babyId = parseInt(req.params.babyId, 10);
      const range = (req.query.range as string) || '7d';
      
      // Converter range para dias
      const daysMap: Record<string, number> = {
        '24h': 1,
        '7d': 7,
        '14d': 14,
        '30d': 30,
        '90d': 90,
      };
      const days = daysMap[range] || 7;

      const caregiverId = await StatsController.getCaregiverId(req.user.userId);
      const stats = await StatsService.getStats(caregiverId, babyId, days);

      res.status(200).json({
        success: true,
        data: stats,
      });
    } catch (error) {
      next(error);
    }
  }
}

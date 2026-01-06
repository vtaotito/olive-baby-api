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

      // Mapear para formato esperado pelo frontend
      const mappedStats = {
        feeding: {
          count: stats.feedingCount24h || 0,
          totalMinutes: stats.totalFeedingMinutes24h || 0,
          complementMl: stats.totalComplementMl24h || 0,
          breastSideDistribution: stats.breastSideDistribution,
        },
        sleep: {
          count: (stats.sleepHoursPerDay || []).filter(h => h > 0).length,
          totalMinutes: Math.round((stats.totalSleepHours24h || 0) * 60),
        },
        diaper: {
          count: stats.totalDiaper24h || 0,
          wetCount: 0, // Calcular se necessário
          dirtyCount: 0, // Calcular se necessário
        },
        bath: {
          count: 0, // Calcular se necessário
        },
        extraction: {
          count: (stats.extractionMlPerDay || []).filter(ml => ml > 0).length,
          totalMl: stats.totalExtractionMl24h || 0,
        },
      };

      res.status(200).json({
        success: true,
        data: mappedStats,
      });
    } catch (error) {
      next(error);
    }
  }

  // Endpoint de volumetria por tipo de leite
  static async getVolumeByType(
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
      
      const daysMap: Record<string, number> = {
        '7d': 7,
        '14d': 14,
        '30d': 30,
      };
      const days = daysMap[range] || 7;

      const caregiverId = await StatsController.getCaregiverId(req.user.userId);
      const volumeData = await StatsService.getVolumeByType(caregiverId, babyId, days);

      res.status(200).json({
        success: true,
        data: volumeData,
      });
    } catch (error) {
      next(error);
    }
  }

  // Endpoint de histórico para gráficos
  static async getHistory(
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
      
      const daysMap: Record<string, number> = {
        '7d': 7,
        '14d': 14,
        '30d': 30,
      };
      const days = daysMap[range] || 7;

      const caregiverId = await StatsController.getCaregiverId(req.user.userId);
      const stats = await StatsService.getStats(caregiverId, babyId, days);

      // Formatar dados para gráficos do frontend
      const historyData = {
        labels: stats.labels || [],
        sleep_hours: stats.sleepHoursPerDay || [],
        feeding_counts: stats.feedingCountsPerDay || [],
        feeding_minutes: stats.feedingMinutesPerDay || [],
        diaper_counts: stats.diaperCountsPerDay || [],
        extraction_ml: stats.extractionMlPerDay || [],
        bottle_ml: stats.bottleMlPerDay || [],
        complement_ml: stats.complementMlPerDay || [],
      };

      res.status(200).json({
        success: true,
        data: historyData,
      });
    } catch (error) {
      next(error);
    }
  }
}

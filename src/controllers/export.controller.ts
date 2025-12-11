// Olive Baby API - Export Controller
import { Response, NextFunction } from 'express';
import { z } from 'zod';
import { ExportService } from '../services/export.service';
import { CaregiverService } from '../services/caregiver.service';
import { AuthenticatedRequest, ApiResponse } from '../types';
import { AppError } from '../utils/errors/AppError';
import { prisma } from '../config/database';

// Schemas de validação
export const exportRoutinesQuerySchema = z.object({
  startDate: z.string().datetime().optional().transform(val => val ? new Date(val) : undefined),
  endDate: z.string().datetime().optional().transform(val => val ? new Date(val) : undefined),
  types: z.string().optional().transform(val => {
    if (!val) return undefined;
    const types = val.split(',').map(t => t.trim().toUpperCase());
    const validTypes = ['FEEDING', 'SLEEP', 'DIAPER', 'BATH', 'MILK_EXTRACTION'];
    return types.filter(t => validTypes.includes(t)) as any;
  }),
});

export const exportGrowthQuerySchema = z.object({
  startDate: z.string().datetime().optional().transform(val => val ? new Date(val) : undefined),
  endDate: z.string().datetime().optional().transform(val => val ? new Date(val) : undefined),
});

export class ExportController {
  private static async getCaregiverId(userId: number): Promise<number> {
    const caregiver = await CaregiverService.getByUserId(userId);
    return caregiver.id;
  }

  // Exportar rotinas em CSV
  static async exportRoutines(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user) {
        throw AppError.unauthorized();
      }

      const babyId = parseInt(req.params.babyId, 10);
      const caregiverId = await ExportController.getCaregiverId(req.user.userId);
      const query = req.query as any;

      const csv = await ExportService.exportRoutinesCsv(caregiverId, {
        babyId,
        startDate: query.startDate,
        endDate: query.endDate,
        routineTypes: query.types,
      });

      // Buscar nome do bebê para o arquivo
      const baby = await prisma.baby.findUnique({
        where: { id: babyId },
        select: { name: true },
      });

      const filename = `rotinas_${baby?.name?.toLowerCase().replace(/\s/g, '_') || 'bebe'}_${new Date().toISOString().split('T')[0]}.csv`;

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send('\uFEFF' + csv); // BOM para Excel reconhecer UTF-8
    } catch (error) {
      next(error);
    }
  }

  // Exportar crescimento em CSV
  static async exportGrowth(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user) {
        throw AppError.unauthorized();
      }

      const babyId = parseInt(req.params.babyId, 10);
      const caregiverId = await ExportController.getCaregiverId(req.user.userId);
      const query = req.query as any;

      const csv = await ExportService.exportGrowthCsv(caregiverId, {
        babyId,
        startDate: query.startDate,
        endDate: query.endDate,
      });

      // Buscar nome do bebê para o arquivo
      const baby = await prisma.baby.findUnique({
        where: { id: babyId },
        select: { name: true },
      });

      const filename = `crescimento_${baby?.name?.toLowerCase().replace(/\s/g, '_') || 'bebe'}_${new Date().toISOString().split('T')[0]}.csv`;

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send('\uFEFF' + csv);
    } catch (error) {
      next(error);
    }
  }

  // Exportar marcos em CSV
  static async exportMilestones(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user) {
        throw AppError.unauthorized();
      }

      const babyId = parseInt(req.params.babyId, 10);
      const caregiverId = await ExportController.getCaregiverId(req.user.userId);

      const csv = await ExportService.exportMilestonesCsv(caregiverId, babyId);

      // Buscar nome do bebê para o arquivo
      const baby = await prisma.baby.findUnique({
        where: { id: babyId },
        select: { name: true },
      });

      const filename = `marcos_${baby?.name?.toLowerCase().replace(/\s/g, '_') || 'bebe'}_${new Date().toISOString().split('T')[0]}.csv`;

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send('\uFEFF' + csv);
    } catch (error) {
      next(error);
    }
  }

  // Exportar relatório completo
  static async exportFullReport(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user) {
        throw AppError.unauthorized();
      }

      const babyId = parseInt(req.params.babyId, 10);
      const caregiverId = await ExportController.getCaregiverId(req.user.userId);
      const query = req.query as any;

      const csv = await ExportService.exportFullReport(
        caregiverId,
        babyId,
        query.startDate,
        query.endDate
      );

      // Buscar nome do bebê para o arquivo
      const baby = await prisma.baby.findUnique({
        where: { id: babyId },
        select: { name: true },
      });

      const filename = `relatorio_completo_${baby?.name?.toLowerCase().replace(/\s/g, '_') || 'bebe'}_${new Date().toISOString().split('T')[0]}.csv`;

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send('\uFEFF' + csv);
    } catch (error) {
      next(error);
    }
  }
}

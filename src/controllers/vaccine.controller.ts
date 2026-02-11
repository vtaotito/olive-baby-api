// Olive Baby API - Vaccine Controller
import { Response, NextFunction } from 'express';
import { z } from 'zod';
import { VaccineService } from '../services/vaccine.service';
import { AuthenticatedRequest } from '../types';
import { AppError } from '../utils/errors/AppError';
import { VaccineStatus, VaccineCalendarSource } from '@prisma/client';
import { hasBabyAccess } from '../utils/helpers/baby-permission.helper';

// ==========================================
// Validation Schemas
// ==========================================

export const syncVaccinesSchema = z.object({
  source: z.enum(['PNI', 'SBIM']).optional().default('PNI'),
});

export const createManualRecordSchema = z.object({
  vaccineKey: z.string().min(1).max(50),
  vaccineName: z.string().min(1).max(100),
  doseLabel: z.string().min(1).max(50),
  doseNumber: z.number().int().positive().optional(),
  recommendedAt: z.string().refine((date) => !isNaN(Date.parse(date)), {
    message: 'Data inválida',
  }),
  appliedAt: z.string().refine((date) => !isNaN(Date.parse(date)), {
    message: 'Data inválida',
  }).optional().nullable(),
  source: z.enum(['PNI', 'SBIM']).optional().default('PNI'),
  lotNumber: z.string().max(50).optional().nullable(),
  clinicName: z.string().max(200).optional().nullable(),
  professionalName: z.string().max(200).optional().nullable(),
  notes: z.string().max(500).optional().nullable(),
});

export const updateRecordSchema = z.object({
  appliedAt: z.string().refine((date) => !isNaN(Date.parse(date)), {
    message: 'Data inválida',
  }).optional().nullable(),
  status: z.enum(['PENDING', 'APPLIED', 'SKIPPED']).optional(),
  lotNumber: z.string().max(50).optional().nullable(),
  clinicName: z.string().max(200).optional().nullable(),
  professionalName: z.string().max(200).optional().nullable(),
  notes: z.string().max(500).optional().nullable(),
});

export const markAsAppliedSchema = z.object({
  appliedAt: z.string().refine((date) => !isNaN(Date.parse(date)), {
    message: 'Data inválida',
  }),
  lotNumber: z.string().max(50).optional(),
  clinicName: z.string().max(200).optional(),
  professionalName: z.string().max(200).optional(),
  notes: z.string().max(500).optional(),
});

export const markAsSkippedSchema = z.object({
  notes: z.string().max(500).optional(),
});

// ==========================================
// Controller
// ==========================================

export class VaccineController {
  /**
   * GET /vaccines/calendars
   * Lista calendários de vacinas disponíveis
   */
  static async getCalendars(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) {
    try {
      const calendars = await VaccineService.getAvailableCalendars();
      
      res.json({
        success: true,
        data: calendars,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /vaccines/definitions
   * Lista definições de vacinas do calendário
   */
  static async getDefinitions(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) {
    try {
      const source = (req.query.source as VaccineCalendarSource) || VaccineCalendarSource.PNI;
      const definitions = await VaccineService.getVaccineDefinitions(source);
      
      res.json({
        success: true,
        data: definitions,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /babies/:babyId/vaccines/sync
   * Sincroniza vacinas do calendário para o bebê
   */
  static async syncVaccines(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) {
    try {
      const userId = req.user!.userId;
      const babyId = parseInt(req.params.babyId, 10);
      
      if (isNaN(babyId)) {
        throw AppError.badRequest('ID do bebê inválido');
      }

      // Buscar caregiverId do usuário
      const caregiver = await import('../config/database').then(m => 
        m.prisma.caregiver.findUnique({
          where: { userId },
          select: { id: true },
        })
      );

      if (!caregiver) {
        throw AppError.forbidden('Usuário não é um cuidador');
      }

      const parsed = syncVaccinesSchema.parse(req.body);
      const source = parsed.source as VaccineCalendarSource;

      const result = await VaccineService.syncVaccinesForBaby(caregiver.id, {
        babyId,
        source,
      });

      res.json({
        success: true,
        message: `Sincronização concluída: ${result.synced} vacinas adicionadas`,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /babies/:babyId/vaccines/summary
   * Obtém resumo das vacinas do bebê
   * Suporta acesso de cuidadores E profissionais de saúde
   */
  static async getSummary(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) {
    try {
      const userId = req.user!.userId;
      const babyId = parseInt(req.params.babyId, 10);
      
      if (isNaN(babyId)) {
        throw AppError.badRequest('ID do bebê inválido');
      }

      // Verificar acesso ao bebê (cuidador OU profissional)
      const hasAccess = await hasBabyAccess(userId, babyId);
      if (!hasAccess) {
        throw AppError.forbidden('Você não tem acesso a este bebê');
      }

      const summary = await VaccineService.getVaccineSummaryByBabyId(babyId);

      res.json({
        success: true,
        data: summary,
        disclaimer: 'O calendário pode variar por indicação médica e condições especiais. Confirme com seu pediatra/UBS.',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /babies/:babyId/vaccines/timeline
   * Lista todas as vacinas do bebê em formato timeline
   * Suporta acesso de cuidadores E profissionais de saúde
   */
  static async getTimeline(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) {
    try {
      const userId = req.user!.userId;
      const babyId = parseInt(req.params.babyId, 10);
      
      if (isNaN(babyId)) {
        throw AppError.badRequest('ID do bebê inválido');
      }

      // Verificar acesso ao bebê (cuidador OU profissional)
      const hasAccess = await hasBabyAccess(userId, babyId);
      if (!hasAccess) {
        throw AppError.forbidden('Você não tem acesso a este bebê');
      }

      const status = req.query.status as VaccineStatus | undefined;
      const source = req.query.source as VaccineCalendarSource | undefined;

      const timeline = await VaccineService.getVaccineTimelineByBabyId(babyId, {
        status,
        source,
      });

      res.json({
        success: true,
        data: timeline,
        disclaimer: 'O calendário pode variar por indicação médica e condições especiais. Confirme com seu pediatra/UBS.',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /babies/:babyId/vaccines/record/:id
   * Obtém detalhes de um registro específico
   * Suporta acesso de cuidadores E profissionais de saúde
   */
  static async getRecord(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) {
    try {
      const userId = req.user!.userId;
      const babyId = parseInt(req.params.babyId, 10);
      const recordId = parseInt(req.params.id, 10);
      
      if (isNaN(babyId) || isNaN(recordId)) {
        throw AppError.badRequest('ID inválido');
      }

      // Verificar acesso ao bebê (cuidador OU profissional)
      const hasAccess = await hasBabyAccess(userId, babyId);
      if (!hasAccess) {
        throw AppError.forbidden('Você não tem acesso a este bebê');
      }

      const record = await VaccineService.getVaccineRecordByBabyId(babyId, recordId);

      res.json({
        success: true,
        data: record,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /babies/:babyId/vaccines/record
   * Cria um registro manual de vacina
   */
  static async createRecord(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) {
    try {
      const userId = req.user!.userId;
      const babyId = parseInt(req.params.babyId, 10);
      
      if (isNaN(babyId)) {
        throw AppError.badRequest('ID do bebê inválido');
      }

      const caregiver = await import('../config/database').then(m => 
        m.prisma.caregiver.findUnique({
          where: { userId },
          select: { id: true },
        })
      );

      if (!caregiver) {
        throw AppError.forbidden('Usuário não é um cuidador');
      }

      const parsed = createManualRecordSchema.parse(req.body);

      const record = await VaccineService.createManualRecord(caregiver.id, {
        babyId,
        vaccineKey: parsed.vaccineKey,
        vaccineName: parsed.vaccineName,
        doseLabel: parsed.doseLabel,
        doseNumber: parsed.doseNumber,
        recommendedAt: new Date(parsed.recommendedAt),
        appliedAt: parsed.appliedAt ? new Date(parsed.appliedAt) : undefined,
        source: parsed.source as VaccineCalendarSource,
        lotNumber: parsed.lotNumber || undefined,
        clinicName: parsed.clinicName || undefined,
        professionalName: parsed.professionalName || undefined,
        notes: parsed.notes || undefined,
      });

      res.status(201).json({
        success: true,
        message: 'Registro de vacina criado com sucesso',
        data: record,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /babies/:babyId/vaccines/record/:id
   * Atualiza um registro de vacina
   */
  static async updateRecord(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) {
    try {
      const userId = req.user!.userId;
      const babyId = parseInt(req.params.babyId, 10);
      const recordId = parseInt(req.params.id, 10);
      
      if (isNaN(babyId) || isNaN(recordId)) {
        throw AppError.badRequest('ID inválido');
      }

      const caregiver = await import('../config/database').then(m => 
        m.prisma.caregiver.findUnique({
          where: { userId },
          select: { id: true },
        })
      );

      if (!caregiver) {
        throw AppError.forbidden('Usuário não é um cuidador');
      }

      const parsed = updateRecordSchema.parse(req.body);

      const record = await VaccineService.updateVaccineRecord(caregiver.id, babyId, recordId, {
        appliedAt: parsed.appliedAt ? new Date(parsed.appliedAt) : (parsed.appliedAt === null ? null : undefined),
        status: parsed.status as VaccineStatus | undefined,
        lotNumber: parsed.lotNumber,
        clinicName: parsed.clinicName,
        professionalName: parsed.professionalName,
        notes: parsed.notes,
      });

      res.json({
        success: true,
        message: 'Registro atualizado com sucesso',
        data: record,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /babies/:babyId/vaccines/record/:id/apply
   * Marca vacina como aplicada
   */
  static async markAsApplied(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) {
    try {
      const userId = req.user!.userId;
      const babyId = parseInt(req.params.babyId, 10);
      const recordId = parseInt(req.params.id, 10);
      
      if (isNaN(babyId) || isNaN(recordId)) {
        throw AppError.badRequest('ID inválido');
      }

      const caregiver = await import('../config/database').then(m => 
        m.prisma.caregiver.findUnique({
          where: { userId },
          select: { id: true },
        })
      );

      if (!caregiver) {
        throw AppError.forbidden('Usuário não é um cuidador');
      }

      const parsed = markAsAppliedSchema.parse(req.body);

      const record = await VaccineService.markAsApplied(caregiver.id, babyId, recordId, {
        appliedAt: new Date(parsed.appliedAt),
        lotNumber: parsed.lotNumber,
        clinicName: parsed.clinicName,
        professionalName: parsed.professionalName,
        notes: parsed.notes,
      });

      res.json({
        success: true,
        message: 'Vacina marcada como aplicada',
        data: record,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /babies/:babyId/vaccines/record/:id/skip
   * Marca vacina como pulada
   */
  static async markAsSkipped(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) {
    try {
      const userId = req.user!.userId;
      const babyId = parseInt(req.params.babyId, 10);
      const recordId = parseInt(req.params.id, 10);
      
      if (isNaN(babyId) || isNaN(recordId)) {
        throw AppError.badRequest('ID inválido');
      }

      const caregiver = await import('../config/database').then(m => 
        m.prisma.caregiver.findUnique({
          where: { userId },
          select: { id: true },
        })
      );

      if (!caregiver) {
        throw AppError.forbidden('Usuário não é um cuidador');
      }

      const parsed = markAsSkippedSchema.parse(req.body);

      const record = await VaccineService.markAsSkipped(
        caregiver.id,
        babyId,
        recordId,
        parsed.notes
      );

      res.json({
        success: true,
        message: 'Vacina marcada como pulada',
        data: record,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /babies/:babyId/vaccines/record/:id/reset
   * Reseta vacina para pendente
   */
  static async resetToPending(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) {
    try {
      const userId = req.user!.userId;
      const babyId = parseInt(req.params.babyId, 10);
      const recordId = parseInt(req.params.id, 10);
      
      if (isNaN(babyId) || isNaN(recordId)) {
        throw AppError.badRequest('ID inválido');
      }

      const caregiver = await import('../config/database').then(m => 
        m.prisma.caregiver.findUnique({
          where: { userId },
          select: { id: true },
        })
      );

      if (!caregiver) {
        throw AppError.forbidden('Usuário não é um cuidador');
      }

      const record = await VaccineService.markAsPending(caregiver.id, babyId, recordId);

      res.json({
        success: true,
        message: 'Vacina resetada para pendente',
        data: record,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * DELETE /babies/:babyId/vaccines/record/:id
   * Remove um registro de vacina
   */
  static async deleteRecord(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) {
    try {
      const userId = req.user!.userId;
      const babyId = parseInt(req.params.babyId, 10);
      const recordId = parseInt(req.params.id, 10);
      
      if (isNaN(babyId) || isNaN(recordId)) {
        throw AppError.badRequest('ID inválido');
      }

      const caregiver = await import('../config/database').then(m => 
        m.prisma.caregiver.findUnique({
          where: { userId },
          select: { id: true },
        })
      );

      if (!caregiver) {
        throw AppError.forbidden('Usuário não é um cuidador');
      }

      await VaccineService.deleteVaccineRecord(caregiver.id, babyId, recordId);

      res.json({
        success: true,
        message: 'Registro de vacina removido com sucesso',
      });
    } catch (error) {
      next(error);
    }
  }
}

export default VaccineController;

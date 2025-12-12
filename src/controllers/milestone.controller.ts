// Olive Baby API - Milestone Controller
import { Response, NextFunction } from 'express';
import { z } from 'zod';
import { MilestoneService } from '../services/milestone.service';
import { CaregiverService } from '../services/caregiver.service';
import { AuthenticatedRequest, ApiResponse } from '../types';
import { AppError } from '../utils/errors/AppError';

// Schemas de validação
export const createMilestoneSchema = z.object({
  babyId: z.number().positive(),
  milestoneKey: z.string().min(1, 'Chave do marco é obrigatória'),
  milestoneLabel: z.string().optional(),
  occurredOn: z.string().datetime().optional().transform(val => val ? new Date(val) : undefined),
  notes: z.string().optional(),
});

// Schema para rotas aninhadas (babyId vem dos params)
export const createMilestoneNestedSchema = z.object({
  milestoneKey: z.string().min(1, 'Chave do marco é obrigatória'),
  milestoneLabel: z.string().optional(),
  occurredOn: z.string().datetime().optional().transform(val => val ? new Date(val) : undefined),
  notes: z.string().optional(),
});

export const updateMilestoneSchema = z.object({
  milestoneLabel: z.string().optional(),
  occurredOn: z.string().datetime().optional().transform(val => val ? new Date(val) : undefined),
  notes: z.string().optional(),
});

export const markMilestoneSchema = z.object({
  babyId: z.number().positive(),
  milestoneKey: z.string().min(1, 'Chave do marco é obrigatória'),
  occurredOn: z.string().datetime().transform(val => new Date(val)),
  notes: z.string().optional(),
});

export const unmarkMilestoneSchema = z.object({
  babyId: z.number().positive(),
  milestoneKey: z.string().min(1, 'Chave do marco é obrigatória'),
});

export class MilestoneController {
  private static async getCaregiverId(userId: number): Promise<number> {
    const caregiver = await CaregiverService.getByUserId(userId);
    return caregiver.id;
  }

  // Retorna marcos pré-definidos
  static async getPredefined(
    req: AuthenticatedRequest,
    res: Response<ApiResponse>,
    next: NextFunction
  ): Promise<void> {
    try {
      const milestones = MilestoneService.getPredefinedMilestones();

      res.status(200).json({
        success: true,
        data: milestones,
      });
    } catch (error) {
      next(error);
    }
  }

  static async create(
    req: AuthenticatedRequest,
    res: Response<ApiResponse>,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user) {
        throw AppError.unauthorized();
      }

      const caregiverId = await MilestoneController.getCaregiverId(req.user.userId);
      // Support babyId from params (nested route) or body
      const babyId = req.params.babyId ? parseInt(req.params.babyId, 10) : req.body.babyId;
      const data = { ...req.body, babyId };
      const milestone = await MilestoneService.create(caregiverId, data);

      res.status(201).json({
        success: true,
        message: 'Marco registrado com sucesso',
        data: milestone,
      });
    } catch (error) {
      next(error);
    }
  }

  static async list(
    req: AuthenticatedRequest,
    res: Response<ApiResponse>,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user) {
        throw AppError.unauthorized();
      }

      const babyId = parseInt(req.params.babyId, 10);
      const caregiverId = await MilestoneController.getCaregiverId(req.user.userId);
      const result = await MilestoneService.listByBaby(caregiverId, babyId);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  static async getById(
    req: AuthenticatedRequest,
    res: Response<ApiResponse>,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user) {
        throw AppError.unauthorized();
      }

      const id = parseInt(req.params.id, 10);
      const caregiverId = await MilestoneController.getCaregiverId(req.user.userId);
      const milestone = await MilestoneService.getById(id, caregiverId);

      res.status(200).json({
        success: true,
        data: milestone,
      });
    } catch (error) {
      next(error);
    }
  }

  static async update(
    req: AuthenticatedRequest,
    res: Response<ApiResponse>,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user) {
        throw AppError.unauthorized();
      }

      const id = parseInt(req.params.id, 10);
      const caregiverId = await MilestoneController.getCaregiverId(req.user.userId);
      const data = req.body;
      const milestone = await MilestoneService.update(id, caregiverId, data);

      res.status(200).json({
        success: true,
        message: 'Marco atualizado com sucesso',
        data: milestone,
      });
    } catch (error) {
      next(error);
    }
  }

  static async delete(
    req: AuthenticatedRequest,
    res: Response<ApiResponse>,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user) {
        throw AppError.unauthorized();
      }

      const id = parseInt(req.params.id, 10);
      const caregiverId = await MilestoneController.getCaregiverId(req.user.userId);
      await MilestoneService.delete(id, caregiverId);

      res.status(200).json({
        success: true,
        message: 'Marco removido com sucesso',
      });
    } catch (error) {
      next(error);
    }
  }

  static async mark(
    req: AuthenticatedRequest,
    res: Response<ApiResponse>,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user) {
        throw AppError.unauthorized();
      }

      const caregiverId = await MilestoneController.getCaregiverId(req.user.userId);
      const { babyId, milestoneKey, occurredOn, notes } = req.body;
      
      const milestone = await MilestoneService.markAsCompleted(
        caregiverId,
        babyId,
        milestoneKey,
        occurredOn,
        notes
      );

      res.status(200).json({
        success: true,
        message: 'Marco marcado como alcançado',
        data: milestone,
      });
    } catch (error) {
      next(error);
    }
  }

  static async unmark(
    req: AuthenticatedRequest,
    res: Response<ApiResponse>,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user) {
        throw AppError.unauthorized();
      }

      const caregiverId = await MilestoneController.getCaregiverId(req.user.userId);
      const { babyId, milestoneKey } = req.body;
      
      await MilestoneService.unmark(caregiverId, babyId, milestoneKey);

      res.status(200).json({
        success: true,
        message: 'Marco desmarcado',
      });
    } catch (error) {
      next(error);
    }
  }

  static async getProgress(
    req: AuthenticatedRequest,
    res: Response<ApiResponse>,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user) {
        throw AppError.unauthorized();
      }

      const babyId = parseInt(req.params.babyId, 10);
      const caregiverId = await MilestoneController.getCaregiverId(req.user.userId);
      const progress = await MilestoneService.getProgress(caregiverId, babyId);

      res.status(200).json({
        success: true,
        data: progress,
      });
    } catch (error) {
      next(error);
    }
  }
}

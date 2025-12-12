// Olive Baby API - Growth Controller
import { Response, NextFunction } from 'express';
import { z } from 'zod';
import { GrowthService } from '../services/growth.service';
import { CaregiverService } from '../services/caregiver.service';
import { AuthenticatedRequest, ApiResponse } from '../types';
import { AppError } from '../utils/errors/AppError';

// Schemas de validação
export const createGrowthSchema = z.object({
  babyId: z.number().positive(),
  measuredAt: z.string().datetime().transform(val => new Date(val)),
  weightKg: z.number().positive().max(50).optional(),
  heightCm: z.number().positive().max(200).optional(),
  headCircumferenceCm: z.number().positive().max(100).optional(),
  source: z.enum(['home', 'medical_appointment']).optional(),
  notes: z.string().optional(),
});

// Schema para rotas aninhadas (babyId vem dos params)
export const createGrowthNestedSchema = z.object({
  measuredAt: z.string().datetime().transform(val => new Date(val)),
  weightKg: z.number().positive().max(50).optional(),
  heightCm: z.number().positive().max(200).optional(),
  headCircumferenceCm: z.number().positive().max(100).optional(),
  source: z.enum(['home', 'medical_appointment']).optional(),
  notes: z.string().optional(),
});

export const updateGrowthSchema = z.object({
  measuredAt: z.string().datetime().optional().transform(val => val ? new Date(val) : undefined),
  weightKg: z.number().positive().max(50).optional(),
  heightCm: z.number().positive().max(200).optional(),
  headCircumferenceCm: z.number().positive().max(100).optional(),
  source: z.enum(['home', 'medical_appointment']).optional(),
  notes: z.string().optional(),
});

export const listGrowthQuerySchema = z.object({
  startDate: z.string().datetime().optional().transform(val => val ? new Date(val) : undefined),
  endDate: z.string().datetime().optional().transform(val => val ? new Date(val) : undefined),
  page: z.string().optional().transform(val => val ? parseInt(val, 10) : 1),
  limit: z.string().optional().transform(val => val ? parseInt(val, 10) : 50),
});

export class GrowthController {
  private static async getCaregiverId(userId: number): Promise<number> {
    const caregiver = await CaregiverService.getByUserId(userId);
    return caregiver.id;
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

      const caregiverId = await GrowthController.getCaregiverId(req.user.userId);
      // Support babyId from params (nested route) or body
      const babyId = req.params.babyId ? parseInt(req.params.babyId, 10) : req.body.babyId;
      const data = { ...req.body, babyId };
      const growth = await GrowthService.create(caregiverId, data);

      res.status(201).json({
        success: true,
        message: 'Medição registrada com sucesso',
        data: growth,
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
      const caregiverId = await GrowthController.getCaregiverId(req.user.userId);
      const query = req.query as any;

      const result = await GrowthService.listByBaby(
        caregiverId,
        babyId,
        {
          startDate: query.startDate,
          endDate: query.endDate,
        },
        query.page,
        query.limit
      );

      res.status(200).json({
        success: true,
        data: result.data,
        pagination: result.pagination,
      } as any);
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
      const caregiverId = await GrowthController.getCaregiverId(req.user.userId);
      const growth = await GrowthService.getById(id, caregiverId);

      res.status(200).json({
        success: true,
        data: growth,
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
      const caregiverId = await GrowthController.getCaregiverId(req.user.userId);
      const data = req.body;
      const growth = await GrowthService.update(id, caregiverId, data);

      res.status(200).json({
        success: true,
        message: 'Medição atualizada com sucesso',
        data: growth,
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
      const caregiverId = await GrowthController.getCaregiverId(req.user.userId);
      await GrowthService.delete(id, caregiverId);

      res.status(200).json({
        success: true,
        message: 'Medição removida com sucesso',
      });
    } catch (error) {
      next(error);
    }
  }

  static async getLatest(
    req: AuthenticatedRequest,
    res: Response<ApiResponse>,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user) {
        throw AppError.unauthorized();
      }

      const babyId = parseInt(req.params.babyId, 10);
      const caregiverId = await GrowthController.getCaregiverId(req.user.userId);
      const growth = await GrowthService.getLatest(caregiverId, babyId);

      res.status(200).json({
        success: true,
        data: growth,
      });
    } catch (error) {
      next(error);
    }
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
      const caregiverId = await GrowthController.getCaregiverId(req.user.userId);
      const stats = await GrowthService.getGrowthStats(caregiverId, babyId);

      res.status(200).json({
        success: true,
        data: stats,
      });
    } catch (error) {
      next(error);
    }
  }
}

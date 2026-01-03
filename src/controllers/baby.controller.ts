// Olive Baby API - Baby Controller
import { Response, NextFunction } from 'express';
import { z } from 'zod';
import { BabyService } from '../services/baby.service';
import { CaregiverService } from '../services/caregiver.service';
import { AuthenticatedRequest, ApiResponse } from '../types';
import { AppError } from '../utils/errors/AppError';

// Schemas de validação
export const createBabySchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório'),
  birthDate: z.string().datetime().transform(val => new Date(val)),
  city: z.string().optional(),
  state: z.string().length(2, 'Estado deve ter 2 caracteres').optional(),
  country: z.string().length(2, 'País deve ter 2 caracteres').default('BR'),
  birthWeightGrams: z.number().positive().optional(),
  birthLengthCm: z.number().positive().optional(),
  relationship: z.enum([
    'MOTHER', 'FATHER', 'GRANDMOTHER', 'GRANDFATHER',
    'AUNT', 'UNCLE', 'NANNY', 'CAREGIVER', 'OTHER'
  ]),
  babyCpf: z.string().optional(), // CPF do bebê (será hashado no backend)
});

export const updateBabySchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório').optional(),
  birthDate: z.string().datetime().optional().transform(val => val ? new Date(val) : undefined),
  city: z.string().optional(),
  state: z.string().length(2, 'Estado deve ter 2 caracteres').optional(),
  country: z.string().length(2, 'País deve ter 2 caracteres').optional(),
  birthWeightGrams: z.number().positive().optional(),
  birthLengthCm: z.number().positive().optional(),
});

export const addCaregiverSchema = z.object({
  caregiverId: z.number().positive(),
  relationship: z.enum([
    'MOTHER', 'FATHER', 'GRANDMOTHER', 'GRANDFATHER',
    'AUNT', 'UNCLE', 'CAREGIVER', 'OTHER'
  ]),
  isPrimary: z.boolean().optional(),
});

export class BabyController {
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

      const caregiverId = await BabyController.getCaregiverId(req.user.userId);
      // req.body já foi validado e transformado pelo middleware validateBody
      const data = req.body as {
        name: string;
        birthDate: Date;
        city?: string;
        state?: string;
        country?: string;
        birthWeightGrams?: number;
        birthLengthCm?: number;
        relationship: string;
        babyCpf?: string;
      };
      const baby = await BabyService.create(caregiverId, data, req.user.userId);

      res.status(201).json({
        success: true,
        message: 'Bebê cadastrado com sucesso',
        data: baby,
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

      const caregiverId = await BabyController.getCaregiverId(req.user.userId);
      const babies = await BabyService.listByCaregiver(caregiverId);

      res.status(200).json({
        success: true,
        data: babies,
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

      const babyId = parseInt(req.params.id, 10);
      const caregiverId = await BabyController.getCaregiverId(req.user.userId);
      const baby = await BabyService.getById(babyId, caregiverId);

      res.status(200).json({
        success: true,
        data: baby,
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

      const babyId = parseInt(req.params.id, 10);
      const caregiverId = await BabyController.getCaregiverId(req.user.userId);
      const data = req.body;
      const baby = await BabyService.update(babyId, caregiverId, data);

      res.status(200).json({
        success: true,
        message: 'Bebê atualizado com sucesso',
        data: baby,
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

      const babyId = parseInt(req.params.id, 10);
      const caregiverId = await BabyController.getCaregiverId(req.user.userId);
      await BabyService.delete(babyId, caregiverId);

      res.status(200).json({
        success: true,
        message: 'Bebê removido com sucesso',
      });
    } catch (error) {
      next(error);
    }
  }

  static async listCaregivers(
    req: AuthenticatedRequest,
    res: Response<ApiResponse>,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user) {
        throw AppError.unauthorized();
      }

      const babyId = parseInt(req.params.id, 10);
      const caregivers = await BabyService.listCaregivers(babyId);

      res.status(200).json({
        success: true,
        data: caregivers,
      });
    } catch (error) {
      next(error);
    }
  }

  static async addCaregiver(
    req: AuthenticatedRequest,
    res: Response<ApiResponse>,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user) {
        throw AppError.unauthorized();
      }

      const babyId = parseInt(req.params.id, 10);
      const caregiverId = await BabyController.getCaregiverId(req.user.userId);
      const data = req.body;
      const result = await BabyService.addCaregiver(babyId, caregiverId, data);

      res.status(201).json({
        success: true,
        message: 'Cuidador adicionado com sucesso',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  static async removeCaregiver(
    req: AuthenticatedRequest,
    res: Response<ApiResponse>,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user) {
        throw AppError.unauthorized();
      }

      const babyId = parseInt(req.params.id, 10);
      const caregiverIdToRemove = parseInt(req.params.caregiverId, 10);
      const primaryCaregiverId = await BabyController.getCaregiverId(req.user.userId);
      
      await BabyService.removeCaregiver(babyId, primaryCaregiverId, caregiverIdToRemove);

      res.status(200).json({
        success: true,
        message: 'Cuidador removido com sucesso',
      });
    } catch (error) {
      next(error);
    }
  }
}

// Olive Baby API - Caregiver Controller
import { Response, NextFunction } from 'express';
import { z } from 'zod';
import { CaregiverService } from '../services/caregiver.service';
import { AuthenticatedRequest, ApiResponse } from '../types';
import { AppError } from '../utils/errors/AppError';

// Schemas de validação
export const updateCaregiverSchema = z.object({
  fullName: z.string().min(2, 'Nome deve ter no mínimo 2 caracteres').optional(),
  phone: z.string().optional(),
  dateOfBirth: z.string().datetime().optional().transform(val => val ? new Date(val) : undefined),
  gender: z.enum(['FEMALE', 'MALE', 'OTHER', 'NOT_INFORMED']).optional(),
  city: z.string().optional(),
  state: z.string().length(2, 'Estado deve ter 2 caracteres').optional(),
  country: z.string().length(2, 'País deve ter 2 caracteres').optional(),
});

export class CaregiverController {
  static async getMe(
    req: AuthenticatedRequest,
    res: Response<ApiResponse>,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user) {
        throw AppError.unauthorized();
      }

      const caregiver = await CaregiverService.getByUserId(req.user.userId);

      res.status(200).json({
        success: true,
        data: caregiver,
      });
    } catch (error) {
      next(error);
    }
  }

  static async updateMe(
    req: AuthenticatedRequest,
    res: Response<ApiResponse>,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user) {
        throw AppError.unauthorized();
      }

      const data = req.body;
      const caregiver = await CaregiverService.update(req.user.userId, data);

      res.status(200).json({
        success: true,
        message: 'Dados atualizados com sucesso',
        data: caregiver,
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
      const id = parseInt(req.params.id, 10);
      const caregiver = await CaregiverService.getById(id);

      res.status(200).json({
        success: true,
        data: caregiver,
      });
    } catch (error) {
      next(error);
    }
  }

  static async searchByEmail(
    req: AuthenticatedRequest,
    res: Response<ApiResponse>,
    next: NextFunction
  ): Promise<void> {
    try {
      const { email } = req.query as { email: string };
      
      if (!email) {
        throw AppError.badRequest('Email é obrigatório');
      }

      const caregiver = await CaregiverService.searchByEmail(email);

      res.status(200).json({
        success: true,
        data: caregiver,
      });
    } catch (error) {
      next(error);
    }
  }
}

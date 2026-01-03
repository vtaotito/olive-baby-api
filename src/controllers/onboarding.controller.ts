// Olive Baby API - Onboarding Controller
import { Response, NextFunction } from 'express';
import { prisma } from '../config/database';
import { AuthenticatedRequest, ApiResponse } from '../types';
import { AppError } from '../utils/errors/AppError';

export class OnboardingController {
  /**
   * POST /onboarding/skip
   * Skip the onboarding process and mark it as completed
   */
  static async skipOnboarding(
    req: AuthenticatedRequest,
    res: Response<ApiResponse>,
    next: NextFunction
  ): Promise<void> {
    try {
      const userId = req.user!.userId;

      // Check if user exists
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, onboardingCompletedAt: true },
      });

      if (!user) {
        throw AppError.notFound('Usuário não encontrado');
      }

      // Update onboarding status
      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: {
          onboardingCompletedAt: new Date(),
        },
        select: {
          id: true,
          email: true,
          role: true,
          onboardingCompletedAt: true,
        },
      });

      res.json({
        success: true,
        message: 'Onboarding marcado como concluído',
        data: {
          onboardingCompletedAt: updatedUser.onboardingCompletedAt,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /onboarding/complete
   * Mark onboarding as completed (after finishing all steps)
   */
  static async completeOnboarding(
    req: AuthenticatedRequest,
    res: Response<ApiResponse>,
    next: NextFunction
  ): Promise<void> {
    try {
      const userId = req.user!.userId;

      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: {
          onboardingCompletedAt: new Date(),
        },
        select: {
          id: true,
          onboardingCompletedAt: true,
        },
      });

      res.json({
        success: true,
        message: 'Onboarding concluído com sucesso',
        data: {
          onboardingCompletedAt: updatedUser.onboardingCompletedAt,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /onboarding/status
   * Get current onboarding status
   */
  static async getOnboardingStatus(
    req: AuthenticatedRequest,
    res: Response<ApiResponse>,
    next: NextFunction
  ): Promise<void> {
    try {
      const userId = req.user!.userId;

      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          onboardingCompletedAt: true,
          caregiver: {
            select: {
              babies: {
                select: { id: true },
              },
            },
          },
        },
      });

      if (!user) {
        throw AppError.notFound('Usuário não encontrado');
      }

      const hasBabies = (user.caregiver?.babies?.length ?? 0) > 0;
      const isCompleted = !!user.onboardingCompletedAt || hasBabies;

      res.json({
        success: true,
        data: {
          isCompleted,
          completedAt: user.onboardingCompletedAt,
          hasBabies,
        },
      });
    } catch (error) {
      next(error);
    }
  }
}

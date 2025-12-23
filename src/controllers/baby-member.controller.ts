// Olive Baby API - Baby Member Controller
import { Response, NextFunction } from 'express';
import { AuthenticatedRequest, ApiResponse } from '../types';
import * as babyMemberService from '../services/baby-member.service';
import { AppError } from '../utils/errors/AppError';

export class BabyMemberController {
  /**
   * GET /babies/:babyId/members
   * Lista todos os membros de um bebê
   */
  static async listMembers(
    req: AuthenticatedRequest,
    res: Response<ApiResponse>,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user) {
        throw AppError.unauthorized();
      }

      const babyId = parseInt(req.params.babyId, 10);
      const members = await babyMemberService.getBabyMembers(babyId, req.user.userId);

      res.json({
        success: true,
        data: members
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /babies/:babyId/members/:memberId
   * Atualiza um vínculo de membro
   */
  static async updateMember(
    req: AuthenticatedRequest,
    res: Response<ApiResponse>,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user) {
        throw AppError.unauthorized();
      }

      const memberId = parseInt(req.params.memberId, 10);
      const updated = await babyMemberService.updateBabyMember(
        memberId,
        req.user.userId,
        req.body
      );

      res.json({
        success: true,
        message: 'Vínculo atualizado com sucesso',
        data: updated
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * DELETE /babies/:babyId/members/:memberId
   * Revoga acesso de um membro ao bebê
   */
  static async revokeMember(
    req: AuthenticatedRequest,
    res: Response<ApiResponse>,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user) {
        throw AppError.unauthorized();
      }

      const memberId = parseInt(req.params.memberId, 10);
      await babyMemberService.revokeBabyMember(memberId, req.user.userId);

      res.json({
        success: true,
        message: 'Acesso revogado com sucesso'
      });
    } catch (error) {
      next(error);
    }
  }
}

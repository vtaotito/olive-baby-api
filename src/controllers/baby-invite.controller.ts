// Olive Baby API - Baby Invite Controller
import { Response, NextFunction } from 'express';
import { AuthenticatedRequest, ApiResponse } from '../types';
import * as babyInviteService from '../services/baby-invite.service';
import * as emailService from '../services/email.service';
import { AppError } from '../utils/errors/AppError';

export class BabyInviteController {
  /**
   * POST /babies/:babyId/invites
   * Cria um convite para um bebê
   */
  static async createInvite(
    req: AuthenticatedRequest,
    res: Response<ApiResponse>,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user) {
        throw AppError.unauthorized();
      }

      // Check Premium feature for multiple caregivers
      const { EntitlementsService } = await import('../core/entitlements');
      const entitlements = await EntitlementsService.getUserEntitlements(req.user.userId);
      
      if (!entitlements.features.multiCaregivers) {
        throw AppError.forbidden(
          'Compartilhamento com múltiplos cuidadores está disponível apenas no plano Premium',
          {
            errorCode: 'PLAN_UPGRADE_REQUIRED',
            feature: 'multiCaregivers',
            currentPlan: entitlements.planType,
          }
        );
      }

      const babyId = parseInt(req.params.babyId, 10);
      const { emailInvited, memberType, role, invitedName, message, expiresInHours } = req.body;

      const result = await babyInviteService.createBabyInvite(
        {
          babyId,
          emailInvited,
          memberType,
          role,
          invitedName,
          message,
          expiresInHours
        },
        req.user.userId
      );

      // Enviar email de convite
      try {
        await emailService.sendBabyInvite({
          emailInvited: result.invite.emailInvited,
          invitedName: result.invite.invitedName || result.invite.emailInvited,
          babyName: result.invite.baby.name,
          inviteToken: result.token,
          memberType: result.invite.memberType,
          role: result.invite.role,
          message: result.invite.message || undefined
        });
      } catch (emailError) {
        console.error('Error sending invite email:', emailError);
        // Não falhar a requisição se o email falhar
      }

      res.status(201).json({
        success: true,
        message: 'Convite enviado com sucesso',
        data: {
          id: result.invite.id,
          emailInvited: result.invite.emailInvited,
          memberType: result.invite.memberType,
          role: result.invite.role,
          expiresAt: result.invite.expiresAt
        }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /babies/:babyId/invites
   * Lista convites de um bebê
   */
  static async listInvites(
    req: AuthenticatedRequest,
    res: Response<ApiResponse>,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user) {
        throw AppError.unauthorized();
      }

      const babyId = parseInt(req.params.babyId, 10);
      const invites = await babyInviteService.getBabyInvites(babyId, req.user.userId);

      res.json({
        success: true,
        data: invites
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /invites/verify-token
   * Verifica token de convite (público, não requer autenticação)
   */
  static async verifyToken(
    req: AuthenticatedRequest,
    res: Response<ApiResponse>,
    next: NextFunction
  ): Promise<void> {
    try {
      const { token } = req.body;

      if (!token) {
        throw AppError.badRequest('Token é obrigatório');
      }

      const result = await babyInviteService.verifyInviteToken(token);

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /invites/accept
   * Aceita um convite (cria o vínculo)
   */
  static async acceptInvite(
    req: AuthenticatedRequest,
    res: Response<ApiResponse>,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user) {
        throw AppError.unauthorized();
      }

      const { token } = req.body;

      if (!token) {
        throw AppError.badRequest('Token é obrigatório');
      }

      const member = await babyInviteService.acceptInvite(token, req.user.userId);

      res.json({
        success: true,
        message: 'Convite aceito com sucesso! Você agora tem acesso ao bebê.',
        data: {
          memberId: member.id,
          babyId: member.babyId
        }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /babies/:babyId/invites/:inviteId/resend
   * Reenvia um convite
   */
  static async resendInvite(
    req: AuthenticatedRequest,
    res: Response<ApiResponse>,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user) {
        throw AppError.unauthorized();
      }

      const inviteId = parseInt(req.params.inviteId, 10);
      const result = await babyInviteService.resendBabyInvite(inviteId, req.user.userId);

      // Enviar email de convite
      try {
        await emailService.sendBabyInvite({
          emailInvited: result.invite.emailInvited,
          invitedName: result.invite.invitedName || result.invite.emailInvited,
          babyName: result.invite.baby.name,
          inviteToken: result.token,
          memberType: result.invite.memberType,
          role: result.invite.role,
          message: result.invite.message || undefined
        });
      } catch (emailError) {
        console.error('Error sending invite email:', emailError);
      }

      res.json({
        success: true,
        message: 'Convite reenviado com sucesso'
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * DELETE /babies/:babyId/invites/:inviteId
   * Revoga um convite
   */
  static async revokeInvite(
    req: AuthenticatedRequest,
    res: Response<ApiResponse>,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user) {
        throw AppError.unauthorized();
      }

      const inviteId = parseInt(req.params.inviteId, 10);
      await babyInviteService.revokeBabyInvite(inviteId, req.user.userId);

      res.json({
        success: true,
        message: 'Convite revogado com sucesso'
      });
    } catch (error) {
      next(error);
    }
  }
}

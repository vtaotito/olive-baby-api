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

  /**
   * GET /invites/pending
   * Lista convites pendentes recebidos pelo usuário logado
   */
  static async getPendingInvites(
    req: AuthenticatedRequest,
    res: Response<ApiResponse>,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user) {
        throw AppError.unauthorized();
      }

      const invites = await babyInviteService.getPendingInvitesForUser(req.user.email);

      // Formatando para o frontend
      const formattedInvites = invites.map(invite => ({
        id: invite.id,
        babyId: invite.babyId,
        babyName: invite.baby.name,
        babyBirthDate: invite.baby.birthDate,
        memberType: invite.memberType,
        role: invite.role,
        invitedName: invite.invitedName,
        message: invite.message,
        inviterEmail: invite.createdBy.email,
        inviterName: invite.createdBy.caregiver?.fullName || invite.createdBy.email,
        expiresAt: invite.expiresAt,
        createdAt: invite.createdAt,
      }));

      res.json({
        success: true,
        data: formattedInvites
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /invites/:inviteId/reject
   * Rejeita um convite recebido
   */
  static async rejectInvite(
    req: AuthenticatedRequest,
    res: Response<ApiResponse>,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user) {
        throw AppError.unauthorized();
      }

      const inviteId = parseInt(req.params.inviteId, 10);
      await babyInviteService.rejectInvite(inviteId, req.user.email);

      res.json({
        success: true,
        message: 'Convite recusado'
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /invites/:inviteId/accept-by-id
   * Aceita um convite recebido (pelo ID, não pelo token)
   */
  static async acceptInviteById(
    req: AuthenticatedRequest,
    res: Response<ApiResponse>,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user) {
        throw AppError.unauthorized();
      }

      const inviteId = parseInt(req.params.inviteId, 10);
      
      // Buscar o convite para obter informações
      const { prisma } = await import('../config/database');
      const invite = await prisma.babyInvite.findUnique({
        where: { id: inviteId },
        include: { baby: true }
      });

      if (!invite) {
        throw AppError.notFound('Convite não encontrado');
      }

      // Verificar se o convite é para este email
      if (invite.emailInvited.toLowerCase() !== req.user.email.toLowerCase()) {
        throw AppError.forbidden('Este convite foi enviado para outro email');
      }

      // Verificar se está pendente e não expirado
      if (invite.status !== 'PENDING') {
        throw AppError.badRequest('Este convite não está mais pendente');
      }

      if (invite.expiresAt < new Date()) {
        throw AppError.badRequest('Este convite expirou');
      }

      // Criar o vínculo diretamente
      const { BabyMemberType, BabyMemberRole, BabyInviteStatus } = await import('@prisma/client');
      
      // Verificar se já existe vínculo ativo
      const existingMember = await prisma.babyMember.findUnique({
        where: {
          babyId_userId: {
            babyId: invite.babyId,
            userId: req.user.userId
          }
        }
      });

      let member;
      if (existingMember && existingMember.status === 'ACTIVE') {
        // Já está vinculado
        await prisma.babyInvite.update({
          where: { id: inviteId },
          data: { 
            status: BabyInviteStatus.ACCEPTED,
            acceptedAt: new Date()
          }
        });
        member = existingMember;
      } else if (existingMember) {
        // Reativar vínculo
        member = await prisma.babyMember.update({
          where: { id: existingMember.id },
          data: {
            memberType: invite.memberType,
            role: invite.role,
            status: 'ACTIVE',
            revokedAt: null,
            revokedByUserId: null
          }
        });
        await prisma.babyInvite.update({
          where: { id: inviteId },
          data: { 
            status: BabyInviteStatus.ACCEPTED,
            acceptedAt: new Date()
          }
        });
      } else {
        // Criar novo vínculo
        member = await prisma.babyMember.create({
          data: {
            babyId: invite.babyId,
            userId: req.user.userId,
            memberType: invite.memberType,
            role: invite.role,
            status: 'ACTIVE'
          }
        });
        await prisma.babyInvite.update({
          where: { id: inviteId },
          data: { 
            status: BabyInviteStatus.ACCEPTED,
            acceptedAt: new Date()
          }
        });
      }

      res.json({
        success: true,
        message: `Convite aceito! Você agora tem acesso a ${invite.baby.name}.`,
        data: {
          memberId: member.id,
          babyId: member.babyId,
          babyName: invite.baby.name
        }
      });
    } catch (error) {
      next(error);
    }
  }
}

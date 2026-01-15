// Olive Baby API - Baby Invite Controller
import { Response, NextFunction } from 'express';
import { AuthenticatedRequest, ApiResponse } from '../types';
import * as babyInviteService from '../services/baby-invite.service';
import * as professionalService from '../services/professional.service';
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
   * Inclui tanto convites de familiares (BabyInvite) quanto de profissionais (Professional)
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

      // Buscar convites de familiares (BabyInvite)
      const familyInvites = await babyInviteService.getPendingInvitesForUser(req.user.email);

      // Buscar convites de profissionais (Professional)
      const professionalInvites = await professionalService.getPendingProfessionalInvitesForUser(req.user.email);

      // Formatando convites de familiares
      const formattedFamilyInvites = familyInvites.map(invite => ({
        id: invite.id,
        inviteType: 'FAMILY' as const, // Para identificar o tipo no frontend
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

      // Formatando convites de profissionais
      const formattedProfessionalInvites = professionalInvites.map(prof => ({
        id: prof.id,
        inviteType: 'PROFESSIONAL' as const, // Para identificar o tipo no frontend
        babyId: prof.babies[0]?.baby?.id || null,
        babyName: prof.babies[0]?.baby?.name || 'Múltiplos bebês',
        babyBirthDate: prof.babies[0]?.baby?.birthDate || null,
        memberType: 'PROFESSIONAL' as const,
        role: prof.babies[0]?.role || 'PEDIATRICIAN',
        invitedName: prof.fullName,
        message: null,
        inviterEmail: prof.invitedBy?.email || null,
        inviterName: prof.invitedBy?.caregiver?.fullName || prof.invitedBy?.email || 'Desconhecido',
        expiresAt: prof.inviteExpiresAt,
        createdAt: prof.createdAt,
        // Campos específicos de profissional
        specialty: prof.specialty,
        allBabies: prof.babies.map(bp => ({
          id: bp.baby.id,
          name: bp.baby.name,
          role: bp.role
        }))
      }));

      // Combinar e ordenar por data de criação (mais recentes primeiro)
      const allInvites = [...formattedFamilyInvites, ...formattedProfessionalInvites]
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      res.json({
        success: true,
        data: allInvites
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /invites/:inviteId/reject
   * Rejeita um convite recebido (família ou profissional)
   * Query param: type=FAMILY|PROFESSIONAL (default: FAMILY)
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
      const inviteType = (req.query.type as string || req.body.inviteType || 'FAMILY').toUpperCase();

      if (inviteType === 'PROFESSIONAL') {
        await professionalService.rejectProfessionalInvite(inviteId, req.user.email);
      } else {
        await babyInviteService.rejectInvite(inviteId, req.user.email);
      }

      res.json({
        success: true,
        message: 'Convite recusado'
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /invites/:inviteId/accept
   * Aceita um convite recebido (pelo ID, família ou profissional)
   * Query param: type=FAMILY|PROFESSIONAL (default: FAMILY)
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
      const inviteType = (req.query.type as string || req.body.inviteType || 'FAMILY').toUpperCase();

      // Se for convite de profissional, usar lógica específica
      if (inviteType === 'PROFESSIONAL') {
        const professional = await professionalService.acceptProfessionalInvite(inviteId, req.user.email);
        
        res.json({
          success: true,
          message: `Convite aceito! Você agora tem acesso aos bebês vinculados.`,
          data: {
            professionalId: professional.id,
            babies: professional.babies.map(bp => ({
              id: bp.baby.id,
              name: bp.baby.name
            }))
          }
        });
        return;
      }

      // Lógica para convites de família (BabyInvite)
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
      const { BabyInviteStatus } = await import('@prisma/client');
      
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

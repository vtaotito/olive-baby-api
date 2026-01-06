// Olive Baby API - Baby Invite Service
import { prisma } from '../config/database';
import { AppError } from '../utils/errors/AppError';
import { BabyMemberType, BabyMemberRole, BabyInviteStatus } from '@prisma/client';
import crypto from 'crypto';
import { requireBabyOwner, canAddOwner } from '../utils/helpers/baby-permission.helper';
import { logger } from '../config/logger';

export interface CreateBabyInviteData {
  babyId: number;
  emailInvited: string;
  memberType: BabyMemberType;
  role: BabyMemberRole;
  invitedName?: string;
  message?: string;
  expiresInHours?: number;
}

export interface VerifyInviteTokenResult {
  invite: {
    id: number;
    babyId: number;
    emailInvited: string;
    memberType: BabyMemberType;
    role: BabyMemberRole;
    invitedName?: string;
    message?: string;
  };
  baby: {
    id: number;
    name: string;
    birthDate: Date;
  };
}

/**
 * Cria um convite para um bebê
 */
export async function createBabyInvite(
  data: CreateBabyInviteData,
  createdByUserId: number
) {
  // Verificar se o criador é owner
  await requireBabyOwner(createdByUserId, data.babyId);

  // Verificar limite de owners se for convite de parent
  if (
    data.memberType === BabyMemberType.PARENT &&
    (data.role === BabyMemberRole.OWNER_PARENT_1 ||
     data.role === BabyMemberRole.OWNER_PARENT_2)
  ) {
    const canAdd = await canAddOwner(data.babyId);
    if (!canAdd) {
      throw AppError.conflict('Já existem 2 responsáveis principais para este bebê');
    }
  }

  // Verificar se já existe convite pendente para este email
  const existingInvite = await prisma.babyInvite.findFirst({
    where: {
      babyId: data.babyId,
      emailInvited: data.emailInvited,
      status: BabyInviteStatus.PENDING
    }
  });

  if (existingInvite) {
    // Verificar se não expirou
    if (existingInvite.expiresAt > new Date()) {
      throw AppError.conflict('Já existe um convite pendente para este email');
    }
    
    // Se expirou, marcar como expirado e criar novo
    await prisma.babyInvite.update({
      where: { id: existingInvite.id },
      data: { status: BabyInviteStatus.EXPIRED }
    });
  }

  // Gerar token forte
  const token = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  
  // Expiração padrão: 72 horas
  const expiresInHours = data.expiresInHours || 72;
  const expiresAt = new Date(Date.now() + expiresInHours * 60 * 60 * 1000);

  const invite = await prisma.babyInvite.create({
    data: {
      babyId: data.babyId,
      emailInvited: data.emailInvited,
      memberType: data.memberType,
      role: data.role,
      tokenHash,
      expiresAt,
      invitedName: data.invitedName || undefined,
      message: data.message || undefined,
      createdByUserId,
      status: BabyInviteStatus.PENDING
    },
    include: {
      baby: {
        select: {
          id: true,
          name: true,
          birthDate: true
        }
      },
      createdBy: {
        select: {
          id: true,
          email: true
        }
      }
    }
  });

  // Log: invite_sent
  logger.info('invite_sent', {
    event: 'invite_sent',
    babyId: data.babyId,
    inviterUserId: createdByUserId,
    inviteeEmail: data.emailInvited.substring(0, 3) + '***',
    memberType: data.memberType,
    role: data.role,
    inviteId: invite.id,
  });

  return {
    invite,
    token // Retornar token apenas na criação (não salvar em texto puro)
  };
}

/**
 * Verifica token de convite e retorna dados básicos
 */
export async function verifyInviteToken(token: string): Promise<VerifyInviteTokenResult> {
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

  const invite = await prisma.babyInvite.findUnique({
    where: { tokenHash },
    include: {
      baby: {
        select: {
          id: true,
          name: true,
          birthDate: true
        }
      }
    }
  });

  if (!invite) {
    logger.warn('invite_invalid', { event: 'invite_invalid', reason: 'token_not_found' });
    throw AppError.badRequest('Token de convite inválido');
  }

  if (invite.status !== BabyInviteStatus.PENDING) {
    if (invite.status === BabyInviteStatus.ACCEPTED) {
      logger.info('invite_already_accepted', { event: 'invite_already_accepted', inviteId: invite.id });
      throw AppError.badRequest('Este convite já foi aceito');
    }
    if (invite.status === BabyInviteStatus.EXPIRED) {
      logger.info('invite_expired', { event: 'invite_expired', inviteId: invite.id });
      throw AppError.badRequest('Este convite expirou');
    }
    if (invite.status === BabyInviteStatus.REVOKED) {
      logger.info('invite_revoked', { event: 'invite_revoked', inviteId: invite.id });
      throw AppError.badRequest('Este convite foi revogado');
    }
  }

  if (invite.expiresAt < new Date()) {
    // Marcar como expirado
    await prisma.babyInvite.update({
      where: { id: invite.id },
      data: { status: BabyInviteStatus.EXPIRED }
    });
    throw AppError.badRequest('Este convite expirou');
  }

  return {
    invite: {
      id: invite.id,
      babyId: invite.babyId,
      emailInvited: invite.emailInvited,
      memberType: invite.memberType,
      role: invite.role,
      invitedName: invite.invitedName || undefined,
      message: invite.message || undefined
    },
    baby: invite.baby
  };
}

/**
 * Aceita um convite (cria o vínculo)
 */
export async function acceptInvite(
  token: string,
  userId: number
) {
  const verification = await verifyInviteToken(token);

  // Verificar se o email do usuário corresponde ao convite
  const user = await prisma.user.findUnique({
    where: { id: userId }
  });

  if (!user) {
    throw AppError.notFound('Usuário não encontrado');
  }

  if (user.email.toLowerCase() !== verification.invite.emailInvited.toLowerCase()) {
    throw AppError.forbidden('Este convite foi enviado para outro email');
  }

  // Verificar se já existe vínculo ativo
  const existingMember = await prisma.babyMember.findUnique({
    where: {
      babyId_userId: {
        babyId: verification.invite.babyId,
        userId
      }
    }
  });

  if (existingMember && existingMember.status === 'ACTIVE') {
    // Marcar convite como aceito mesmo que já exista vínculo
    await prisma.babyInvite.update({
      where: { id: verification.invite.id },
      data: { 
        status: BabyInviteStatus.ACCEPTED,
        acceptedAt: new Date()
      }
    });
    
    throw AppError.conflict('Você já está vinculado a este bebê');
  }

  // Criar vínculo
  const member = await prisma.$transaction(async (tx) => {
    // Criar ou reativar membro
    let member;
    if (existingMember) {
      member = await tx.babyMember.update({
        where: { id: existingMember.id },
        data: {
          memberType: verification.invite.memberType,
          role: verification.invite.role,
          status: 'ACTIVE',
          revokedAt: null,
          revokedByUserId: null
        }
      });
    } else {
      member = await tx.babyMember.create({
        data: {
          babyId: verification.invite.babyId,
          userId,
          memberType: verification.invite.memberType,
          role: verification.invite.role,
          status: 'ACTIVE'
        }
      });
    }

    // Marcar convite como aceito
    await tx.babyInvite.update({
      where: { id: verification.invite.id },
      data: {
        status: BabyInviteStatus.ACCEPTED,
        acceptedAt: new Date()
      }
    });

    // Log: invite_accepted
    logger.info('invite_accepted', {
      event: 'invite_accepted',
      babyId: verification.invite.babyId,
      userId,
      memberType: verification.invite.memberType,
      role: verification.invite.role,
      inviteId: verification.invite.id,
      memberId: member.id,
    });

    return member;
  });

  return member;
}

/**
 * Reenvia um convite (gera novo token)
 */
export async function resendBabyInvite(
  inviteId: number,
  requestingUserId: number
) {
  const invite = await prisma.babyInvite.findUnique({
    where: { id: inviteId },
    include: { baby: true }
  });

  if (!invite) {
    throw AppError.notFound('Convite não encontrado');
  }

  // Verificar se o criador é owner
  await requireBabyOwner(requestingUserId, invite.babyId);

  if (invite.status === BabyInviteStatus.ACCEPTED) {
    throw AppError.badRequest('Este convite já foi aceito');
  }

  // Gerar novo token
  const token = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000); // 72 horas

  const updatedInvite = await prisma.babyInvite.update({
    where: { id: inviteId },
    data: {
      tokenHash,
      expiresAt,
      status: BabyInviteStatus.PENDING
    },
    include: {
      baby: {
        select: {
          id: true,
          name: true,
          birthDate: true
        }
      }
    }
  });

  // Log: invite_resend
  logger.info('invite_resend', {
    event: 'invite_resend',
    inviteId,
    babyId: invite.babyId,
    inviteeEmail: invite.emailInvited.substring(0, 3) + '***',
    requestingUserId,
  });

  return {
    invite: updatedInvite,
    token
  };
}

/**
 * Revoga um convite
 */
export async function revokeBabyInvite(
  inviteId: number,
  requestingUserId: number
) {
  const invite = await prisma.babyInvite.findUnique({
    where: { id: inviteId },
    include: { baby: true }
  });

  if (!invite) {
    throw AppError.notFound('Convite não encontrado');
  }

  // Verificar se o criador é owner
  await requireBabyOwner(requestingUserId, invite.babyId);

  if (invite.status === BabyInviteStatus.ACCEPTED) {
    throw AppError.badRequest('Não é possível revogar um convite já aceito');
  }

  const revokedInvite = await prisma.babyInvite.update({
    where: { id: inviteId },
    data: { status: BabyInviteStatus.REVOKED }
  });

  // Log: invite_revoked
  logger.info('invite_revoked', {
    event: 'invite_revoked',
    inviteId,
    babyId: invite.babyId,
    inviteeEmail: invite.emailInvited.substring(0, 3) + '***',
    requestingUserId,
  });

  return revokedInvite;
}

/**
 * Lista convites de um bebê
 */
export async function getBabyInvites(
  babyId: number,
  requestingUserId: number
) {
  // Verificar acesso
  await requireBabyOwner(requestingUserId, babyId);

  const invites = await prisma.babyInvite.findMany({
    where: { babyId },
    include: {
      createdBy: {
        select: {
          id: true,
          email: true
        }
      }
    },
    orderBy: { createdAt: 'desc' }
  });

  return invites;
}

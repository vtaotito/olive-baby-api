// Olive Baby API - Baby Member Service
import { prisma } from '../config/database';
import { AppError } from '../utils/errors/AppError';
import { BabyMemberType, BabyMemberRole, BabyMemberStatus } from '@prisma/client';
import { requireBabyOwner, canAddOwner, countActiveOwners } from '../utils/helpers/baby-permission.helper';

export interface CreateBabyMemberData {
  babyId: number;
  userId: number;
  memberType: BabyMemberType;
  role: BabyMemberRole;
  permissions?: Record<string, any>;
}

export interface UpdateBabyMemberData {
  role?: BabyMemberRole;
  permissions?: Record<string, any>;
}

/**
 * Lista todos os membros de um bebê
 */
export async function getBabyMembers(babyId: number, requestingUserId: number) {
  // Verificar se o usuário tem acesso ao bebê
  const hasAccess = await prisma.babyMember.findFirst({
    where: {
      babyId,
      userId: requestingUserId,
      status: BabyMemberStatus.ACTIVE
    }
  });

  if (!hasAccess) {
    throw AppError.forbidden('Você não tem acesso a este bebê');
  }

  const members = await prisma.babyMember.findMany({
    where: { babyId },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          role: true,
          createdAt: true
        }
      },
      revokedBy: {
        select: {
          id: true,
          email: true
        }
      }
    },
    orderBy: [
      { role: 'asc' }, // Owners primeiro
      { createdAt: 'asc' }
    ]
  });

  return members;
}

/**
 * Cria um vínculo de membro ao bebê (após aceitar convite)
 */
export async function createBabyMember(data: CreateBabyMemberData) {
  // Verificar se já existe vínculo
  const existing = await prisma.babyMember.findUnique({
    where: {
      babyId_userId: {
        babyId: data.babyId,
        userId: data.userId
      }
    }
  });

  if (existing) {
    if (existing.status === BabyMemberStatus.ACTIVE) {
      throw AppError.conflict('Este usuário já está vinculado a este bebê');
    }
    
    // Reativar vínculo revogado
    return prisma.babyMember.update({
      where: { id: existing.id },
      data: {
        memberType: data.memberType,
        role: data.role,
        status: BabyMemberStatus.ACTIVE,
        permissions: data.permissions,
        revokedAt: null,
        revokedByUserId: null
      },
      include: {
        user: {
          select: {
            id: true,
            email: true
          }
        }
      }
    });
  }

  // Verificar limite de owners
  if (
    data.role === BabyMemberRole.OWNER_PARENT_1 ||
    data.role === BabyMemberRole.OWNER_PARENT_2
  ) {
    const canAdd = await canAddOwner(data.babyId);
    if (!canAdd) {
      throw AppError.conflict('Já existem 2 responsáveis principais para este bebê');
    }
  }

  return prisma.babyMember.create({
    data: {
      babyId: data.babyId,
      userId: data.userId,
      memberType: data.memberType,
      role: data.role,
      status: BabyMemberStatus.ACTIVE,
      permissions: data.permissions
    },
    include: {
      user: {
        select: {
          id: true,
          email: true
        }
      }
    }
  });
}

/**
 * Atualiza um vínculo de membro
 */
export async function updateBabyMember(
  memberId: number,
  requestingUserId: number,
  data: UpdateBabyMemberData
) {
  const member = await prisma.babyMember.findUnique({
    where: { id: memberId },
    include: { baby: true }
  });

  if (!member) {
    throw AppError.notFound('Vínculo não encontrado');
  }

  // Apenas owners podem atualizar vínculos
  await requireBabyOwner(requestingUserId, member.babyId);

  // Se mudando para owner, verificar limite
  if (
    data.role &&
    (data.role === BabyMemberRole.OWNER_PARENT_1 || data.role === BabyMemberRole.OWNER_PARENT_2)
  ) {
    const currentOwners = await countActiveOwners(member.babyId);
    
    // Se o membro atual não é owner, precisa ter menos de 2 owners
    const isCurrentOwner = 
      member.role === BabyMemberRole.OWNER_PARENT_1 ||
      member.role === BabyMemberRole.OWNER_PARENT_2;
    
    if (!isCurrentOwner && currentOwners >= 2) {
      throw AppError.conflict('Já existem 2 responsáveis principais para este bebê');
    }
  }

  return prisma.babyMember.update({
    where: { id: memberId },
    data: {
      role: data.role,
      permissions: data.permissions
    },
    include: {
      user: {
        select: {
          id: true,
          email: true
        }
      }
    }
  });
}

/**
 * Revoga acesso de um membro ao bebê
 */
export async function revokeBabyMember(
  memberId: number,
  requestingUserId: number
) {
  const member = await prisma.babyMember.findUnique({
    where: { id: memberId },
    include: { baby: true }
  });

  if (!member) {
    throw AppError.notFound('Vínculo não encontrado');
  }

  // Apenas owners podem revogar acesso
  await requireBabyOwner(requestingUserId, member.babyId);

  // Não pode revogar a si mesmo se for o único owner
  if (
    member.userId === requestingUserId &&
    (member.role === BabyMemberRole.OWNER_PARENT_1 ||
     member.role === BabyMemberRole.OWNER_PARENT_2)
  ) {
    const ownersCount = await countActiveOwners(member.babyId);
    if (ownersCount === 1) {
      throw AppError.badRequest('Não é possível remover o único responsável principal');
    }
  }

  return prisma.babyMember.update({
    where: { id: memberId },
    data: {
      status: BabyMemberStatus.REVOKED,
      revokedAt: new Date(),
      revokedByUserId: requestingUserId
    }
  });
}

/**
 * Verifica se um usuário tem acesso a um bebê e retorna o membro
 */
export async function getBabyMemberByUser(
  babyId: number,
  userId: number
) {
  const member = await prisma.babyMember.findUnique({
    where: {
      babyId_userId: {
        babyId,
        userId
      }
    },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          role: true
        }
      }
    }
  });

  if (!member || member.status !== BabyMemberStatus.ACTIVE) {
    return null;
  }

  return member;
}

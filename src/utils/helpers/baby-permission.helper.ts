// Olive Baby API - Baby Permission Helper
import { prisma } from '../../config/database';
import { AppError } from '../errors/AppError';
import { BabyMemberRole, BabyMemberStatus } from '@prisma/client';

/**
 * Verifica se o usuário é owner (OWNER_PARENT_1 ou OWNER_PARENT_2) do bebê
 */
export async function isBabyOwner(userId: number, babyId: number): Promise<boolean> {
  const member = await prisma.babyMember.findFirst({
    where: {
      babyId,
      userId,
      role: {
        in: [BabyMemberRole.OWNER_PARENT_1, BabyMemberRole.OWNER_PARENT_2]
      },
      status: BabyMemberStatus.ACTIVE
    }
  });
  
  return !!member;
}

/**
 * Verifica se o usuário tem acesso ao bebê (qualquer role ativa)
 * Inclui acesso via BabyMember (cuidadores) e Professional (profissionais de saúde)
 */
export async function hasBabyAccess(userId: number, babyId: number): Promise<boolean> {
  // Verificar acesso via BabyMember (cuidadores)
  const member = await prisma.babyMember.findFirst({
    where: {
      babyId,
      userId,
      status: BabyMemberStatus.ACTIVE
    }
  });
  
  if (member) {
    return true;
  }
  
  // Verificar acesso via Professional (profissionais de saúde)
  const professional = await prisma.professional.findUnique({
    where: { userId },
    select: { id: true, status: true }
  });
  
  if (professional && professional.status === 'ACTIVE') {
    const babyProfessional = await prisma.babyProfessional.findFirst({
      where: {
        babyId,
        professionalId: professional.id
      }
    });
    
    if (babyProfessional) {
      return true;
    }
  }
  
  return false;
}

/**
 * Garante que o usuário é owner do bebê, lança erro caso contrário
 */
export async function requireBabyOwner(userId: number, babyId: number): Promise<void> {
  const isOwner = await isBabyOwner(userId, babyId);
  
  if (!isOwner) {
    throw AppError.forbidden('Apenas os responsáveis principais podem realizar esta ação');
  }
}

/**
 * Garante que o usuário tem acesso ao bebê, lança erro caso contrário
 */
export async function requireBabyAccess(userId: number, babyId: number): Promise<void> {
  const hasAccess = await hasBabyAccess(userId, babyId);
  
  if (!hasAccess) {
    throw AppError.forbidden('Você não tem acesso a este bebê');
  }
}

/**
 * Conta quantos owners ativos existem para um bebê
 */
export async function countActiveOwners(babyId: number): Promise<number> {
  return prisma.babyMember.count({
    where: {
      babyId,
      role: {
        in: [BabyMemberRole.OWNER_PARENT_1, BabyMemberRole.OWNER_PARENT_2]
      },
      status: BabyMemberStatus.ACTIVE
    }
  });
}

/**
 * Verifica se ainda há vaga para owner (máximo 2)
 */
export async function canAddOwner(babyId: number): Promise<boolean> {
  const count = await countActiveOwners(babyId);
  return count < 2;
}

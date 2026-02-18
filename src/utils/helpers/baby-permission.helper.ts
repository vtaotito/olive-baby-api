// Olive Baby API - Baby Permission Helper
import { prisma } from '../../config/database';
import { AppError } from '../errors/AppError';
import { BabyMemberRole, BabyMemberStatus, BabyMemberType } from '@prisma/client';
import { logger } from '../../config/logger';

/**
 * Verifica se o usuário é owner do bebê.
 * Checa tanto BabyMember (sistema novo) quanto CaregiverBaby.isPrimary (sistema legado).
 * Se encontrar apenas no sistema legado, promove automaticamente para BabyMember.
 */
export async function isBabyOwner(userId: number, babyId: number): Promise<boolean> {
  const member = await prisma.babyMember.findFirst({
    where: {
      babyId,
      userId,
      role: { in: [BabyMemberRole.OWNER_PARENT_1, BabyMemberRole.OWNER_PARENT_2] },
      status: BabyMemberStatus.ACTIVE
    }
  });

  if (member) return true;

  // Fallback: verificar sistema legado (CaregiverBaby com isPrimary)
  const legacyLink = await prisma.caregiverBaby.findFirst({
    where: {
      babyId,
      isPrimary: true,
      caregiver: { userId }
    },
    include: { caregiver: { select: { userId: true } } }
  });

  if (legacyLink) {
    // Auto-promover para BabyMember para futuras checagens
    try {
      const existingOwners = await prisma.babyMember.count({
        where: {
          babyId,
          role: { in: [BabyMemberRole.OWNER_PARENT_1, BabyMemberRole.OWNER_PARENT_2] },
          status: BabyMemberStatus.ACTIVE
        }
      });
      const role = existingOwners === 0
        ? BabyMemberRole.OWNER_PARENT_1
        : BabyMemberRole.OWNER_PARENT_2;

      await prisma.babyMember.upsert({
        where: { babyId_userId: { babyId, userId } },
        create: {
          babyId,
          userId,
          memberType: BabyMemberType.PARENT,
          role,
          status: BabyMemberStatus.ACTIVE
        },
        update: {
          memberType: BabyMemberType.PARENT,
          role,
          status: BabyMemberStatus.ACTIVE,
          revokedAt: null,
          revokedByUserId: null
        }
      });
      logger.info('legacy_caregiver_promoted', { userId, babyId, role });
    } catch (err: any) {
      logger.warn('legacy_promote_failed', { userId, babyId, error: err?.message });
    }
    return true;
  }

  return false;
}

/**
 * Verifica se o usuário tem acesso ao bebê (qualquer role ativa)
 * Inclui acesso via BabyMember, CaregiverBaby (legado) e Professional
 */
export async function hasBabyAccess(userId: number, babyId: number): Promise<boolean> {
  const member = await prisma.babyMember.findFirst({
    where: { babyId, userId, status: BabyMemberStatus.ACTIVE }
  });
  if (member) return true;

  // Verificar sistema legado (CaregiverBaby)
  const legacyLink = await prisma.caregiverBaby.findFirst({
    where: { babyId, caregiver: { userId } }
  });
  if (legacyLink) return true;

  // Verificar acesso via Professional
  const professional = await prisma.professional.findUnique({
    where: { userId },
    select: { id: true, status: true }
  });

  if (professional && professional.status === 'ACTIVE') {
    const babyProfessional = await prisma.babyProfessional.findFirst({
      where: { babyId, professionalId: professional.id }
    });
    if (babyProfessional) return true;
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

/**
 * Verifica acesso ao bebê usando caregiverId (usado pelos services legados).
 * Checa CaregiverBaby (legado) + BabyMember (novo) via userId do caregiver.
 */
export async function hasBabyAccessByCaregiverId(caregiverId: number, babyId: number): Promise<boolean> {
  const legacyLink = await prisma.caregiverBaby.findFirst({
    where: { babyId, caregiverId }
  });
  if (legacyLink) return true;

  const caregiver = await prisma.caregiver.findUnique({
    where: { id: caregiverId },
    select: { userId: true }
  });
  if (!caregiver) return false;

  return hasBabyAccess(caregiver.userId, babyId);
}

/**
 * Garante acesso ao bebê usando caregiverId, lança erro caso contrário.
 * Drop-in replacement para os checks inline de caregiverBaby.findFirst nos services.
 */
export async function requireBabyAccessByCaregiverId(caregiverId: number, babyId: number): Promise<void> {
  const hasAccess = await hasBabyAccessByCaregiverId(caregiverId, babyId);
  if (!hasAccess) {
    throw AppError.forbidden('Você não tem acesso a este bebê');
  }
}

/**
 * Retorna os IDs dos bebês acessíveis por um caregiver (legado + novo sistema).
 */
export async function getBabyIdsByCaregiverId(caregiverId: number): Promise<number[]> {
  const caregiver = await prisma.caregiver.findUnique({
    where: { id: caregiverId },
    select: { userId: true }
  });
  if (!caregiver) return [];

  const legacyBabies = await prisma.caregiverBaby.findMany({
    where: { caregiverId },
    select: { babyId: true }
  });

  const memberBabies = await prisma.babyMember.findMany({
    where: { userId: caregiver.userId, status: BabyMemberStatus.ACTIVE },
    select: { babyId: true }
  });

  const allIds = new Set([
    ...legacyBabies.map(b => b.babyId),
    ...memberBabies.map(b => b.babyId)
  ]);

  return Array.from(allIds);
}

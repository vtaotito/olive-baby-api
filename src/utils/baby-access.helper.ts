// Olive Baby API - Baby Access Helper
import { PrismaClient, Relationship } from '@prisma/client';
import { AppError } from './errors/AppError';

const prisma = new PrismaClient();

/**
 * Verifica se o cuidador tem acesso ao bebê
 * Retorna o relacionamento se existir, null caso contrário
 */
export async function verifyBabyAccess(
  caregiverId: number,
  babyId: number,
  requirePrimary: boolean = false
) {
  const caregiverBaby = await prisma.caregiverBaby.findUnique({
    where: {
      caregiverId_babyId: { caregiverId, babyId }
    },
    include: {
      caregiver: {
        select: {
          id: true,
          fullName: true
        }
      },
      baby: {
        select: {
          id: true,
          name: true
        }
      }
    }
  });

  if (!caregiverBaby) {
    // Verificar se o bebê existe
    const baby = await prisma.baby.findUnique({
      where: { id: babyId },
      include: {
        caregivers: {
          include: {
            caregiver: {
              select: {
                id: true,
                fullName: true
              }
            }
          }
        }
      }
    });

    if (!baby) {
      throw new AppError('Bebê não encontrado', 404);
    }

    // Verificar se o caregiver existe
    const caregiver = await prisma.caregiver.findUnique({
      where: { id: caregiverId }
    });

    if (!caregiver) {
      throw new AppError('Cuidador não encontrado', 404);
    }

    // Verificar outros bebês do caregiver
    const otherBabies = await prisma.caregiverBaby.findMany({
      where: { caregiverId },
      include: { baby: { select: { id: true, name: true } } }
    });

    const errorMessage = baby.caregivers.length === 0
      ? 'Este bebê não tem cuidadores vinculados. Por favor, verifique se o bebê foi cadastrado corretamente.'
      : `Você não tem acesso a este bebê "${baby.name}". Este bebê está vinculado a: ${baby.caregivers.map(cb => cb.caregiver.fullName).join(', ')}. ${otherBabies.length > 0 ? `Você tem acesso aos bebês: ${otherBabies.map(cb => cb.baby.name).join(', ')}.` : 'Você não tem acesso a nenhum bebê.'}`;

    throw new AppError(errorMessage, 403);
  }

  if (requirePrimary && !caregiverBaby.isPrimary) {
    throw new AppError('Apenas o cuidador principal pode realizar esta ação', 403);
  }

  return caregiverBaby;
}

/**
 * Garante que o relacionamento CaregiverBaby existe
 * Se não existir e o usuário for o criador do bebê, cria o relacionamento
 */
export async function ensureBabyAccess(
  caregiverId: number,
  babyId: number,
  relationship?: string
) {
  let caregiverBaby = await prisma.caregiverBaby.findUnique({
    where: {
      caregiverId_babyId: { caregiverId, babyId }
    }
  });

  if (!caregiverBaby) {
    // Verificar se o bebê foi criado por este caregiver (primeiro cuidador)
    const baby = await prisma.baby.findUnique({
      where: { id: babyId },
      include: {
        caregivers: {
          orderBy: { createdAt: 'asc' },
          take: 1
        }
      }
    });

    if (!baby) {
      throw new AppError('Bebê não encontrado', 404);
    }

    // Se o bebê não tem cuidadores, criar o relacionamento
    if (baby.caregivers.length === 0) {
      caregiverBaby = await prisma.caregiverBaby.create({
        data: {
          caregiverId,
          babyId,
          relationship: (relationship as Relationship) || 'MOTHER',
          isPrimary: true
        }
      });
    } else {
      // Bebê tem cuidadores, mas este caregiver não está vinculado
      throw new AppError('Você não tem acesso a este bebê', 403);
    }
  }

  return caregiverBaby;
}

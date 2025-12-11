// Olive Baby API - Baby Service
import { prisma } from '../config/database';
import { AppError } from '../utils/errors/AppError';
import { Relationship } from '@prisma/client';
import { isFutureDate } from '../utils/helpers/date.helper';

interface CreateBabyInput {
  name: string;
  birthDate: Date;
  city?: string;
  state?: string;
  country?: string;
  birthWeightGrams?: number;
  birthLengthCm?: number;
  relationship: Relationship;
}

interface UpdateBabyInput {
  name?: string;
  birthDate?: Date;
  city?: string;
  state?: string;
  country?: string;
  birthWeightGrams?: number;
  birthLengthCm?: number;
}

interface AddCaregiverInput {
  caregiverId: number;
  relationship: Relationship;
  isPrimary?: boolean;
}

export class BabyService {
  static async create(caregiverId: number, input: CreateBabyInput) {
    // Validar data de nascimento
    if (isFutureDate(input.birthDate)) {
      throw AppError.badRequest('Data de nascimento não pode ser futura');
    }

    const { relationship, ...babyData } = input;

    const baby = await prisma.baby.create({
      data: {
        ...babyData,
        caregivers: {
          create: {
            caregiverId,
            relationship,
            isPrimary: true, // Primeiro cuidador é sempre primário
          },
        },
      },
      include: {
        caregivers: {
          include: {
            caregiver: {
              select: {
                id: true,
                fullName: true,
              },
            },
          },
        },
      },
    });

    return baby;
  }

  static async getById(babyId: number, caregiverId: number) {
    const baby = await prisma.baby.findUnique({
      where: { id: babyId },
      include: {
        caregivers: {
          include: {
            caregiver: {
              select: {
                id: true,
                fullName: true,
              },
            },
          },
        },
        professionals: {
          include: {
            professional: {
              select: {
                id: true,
                fullName: true,
                specialty: true,
              },
            },
          },
        },
      },
    });

    if (!baby) {
      throw AppError.notFound('Bebê não encontrado');
    }

    // Verificar se o cuidador tem acesso
    const hasAccess = baby.caregivers.some(cb => cb.caregiverId === caregiverId);
    if (!hasAccess) {
      throw AppError.forbidden('Você não tem acesso a este bebê');
    }

    return baby;
  }

  static async listByCaregiver(caregiverId: number) {
    const babies = await prisma.baby.findMany({
      where: {
        caregivers: {
          some: {
            caregiverId,
          },
        },
      },
      include: {
        caregivers: {
          include: {
            caregiver: {
              select: {
                id: true,
                fullName: true,
              },
            },
          },
        },
      },
      orderBy: {
        birthDate: 'desc',
      },
    });

    return babies;
  }

  static async update(babyId: number, caregiverId: number, input: UpdateBabyInput) {
    // Verificar acesso
    await this.getById(babyId, caregiverId);

    // Validar data de nascimento se fornecida
    if (input.birthDate && isFutureDate(input.birthDate)) {
      throw AppError.badRequest('Data de nascimento não pode ser futura');
    }

    const baby = await prisma.baby.update({
      where: { id: babyId },
      data: input,
      include: {
        caregivers: {
          include: {
            caregiver: {
              select: {
                id: true,
                fullName: true,
              },
            },
          },
        },
      },
    });

    return baby;
  }

  static async delete(babyId: number, caregiverId: number) {
    // Verificar se é cuidador primário
    const caregiverBaby = await prisma.caregiverBaby.findFirst({
      where: {
        babyId,
        caregiverId,
        isPrimary: true,
      },
    });

    if (!caregiverBaby) {
      throw AppError.forbidden('Apenas o cuidador primário pode remover o bebê');
    }

    await prisma.baby.delete({
      where: { id: babyId },
    });
  }

  static async addCaregiver(babyId: number, primaryCaregiverId: number, input: AddCaregiverInput) {
    // Verificar se quem está adicionando é primário
    const isPrimaryCaregiver = await prisma.caregiverBaby.findFirst({
      where: {
        babyId,
        caregiverId: primaryCaregiverId,
        isPrimary: true,
      },
    });

    if (!isPrimaryCaregiver) {
      throw AppError.forbidden('Apenas o cuidador primário pode adicionar outros cuidadores');
    }

    // Verificar se já existe vínculo
    const existingLink = await prisma.caregiverBaby.findFirst({
      where: {
        babyId,
        caregiverId: input.caregiverId,
      },
    });

    if (existingLink) {
      throw AppError.conflict('Este cuidador já está vinculado ao bebê');
    }

    // Se for definir como primário, remover primário atual
    if (input.isPrimary) {
      await prisma.caregiverBaby.updateMany({
        where: { babyId, isPrimary: true },
        data: { isPrimary: false },
      });
    }

    const caregiverBaby = await prisma.caregiverBaby.create({
      data: {
        babyId,
        caregiverId: input.caregiverId,
        relationship: input.relationship,
        isPrimary: input.isPrimary || false,
      },
      include: {
        caregiver: {
          select: {
            id: true,
            fullName: true,
          },
        },
      },
    });

    return caregiverBaby;
  }

  static async removeCaregiver(babyId: number, primaryCaregiverId: number, caregiverIdToRemove: number) {
    // Verificar se quem está removendo é primário
    const isPrimaryCaregiver = await prisma.caregiverBaby.findFirst({
      where: {
        babyId,
        caregiverId: primaryCaregiverId,
        isPrimary: true,
      },
    });

    if (!isPrimaryCaregiver) {
      throw AppError.forbidden('Apenas o cuidador primário pode remover outros cuidadores');
    }

    // Não pode remover a si mesmo
    if (primaryCaregiverId === caregiverIdToRemove) {
      throw AppError.badRequest('O cuidador primário não pode se remover');
    }

    await prisma.caregiverBaby.deleteMany({
      where: {
        babyId,
        caregiverId: caregiverIdToRemove,
      },
    });
  }

  static async listCaregivers(babyId: number) {
    const caregivers = await prisma.caregiverBaby.findMany({
      where: { babyId },
      include: {
        caregiver: {
          include: {
            user: {
              select: {
                email: true,
              },
            },
          },
        },
      },
    });

    return caregivers.map(cb => ({
      id: cb.caregiver.id,
      fullName: cb.caregiver.fullName,
      email: cb.caregiver.user.email,
      relationship: cb.relationship,
      isPrimary: cb.isPrimary,
    }));
  }
}

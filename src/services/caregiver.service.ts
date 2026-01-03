// Olive Baby API - Caregiver Service
import { prisma } from '../config/database';
import { AppError } from '../utils/errors/AppError';
import { validateCPF, cleanCPF } from '../utils/validators/cpf.validator';
import { Gender } from '@prisma/client';

interface UpdateCaregiverInput {
  fullName?: string;
  phone?: string;
  dateOfBirth?: Date;
  gender?: Gender;
  city?: string;
  state?: string;
  country?: string;
}

export class CaregiverService {
  static async getById(id: number) {
    const caregiver = await prisma.caregiver.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            role: true,
            isActive: true,
          },
        },
        babies: {
          include: {
            baby: true,
          },
        },
      },
    });

    if (!caregiver) {
      throw AppError.notFound('Cuidador não encontrado');
    }

    return caregiver;
  }

  static async getByUserId(userId: number) {
    const caregiver = await prisma.caregiver.findUnique({
      where: { userId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            role: true,
            isActive: true,
          },
        },
        babies: {
          include: {
            baby: true,
          },
        },
      },
    });

    if (!caregiver) {
      throw AppError.notFound('Cuidador não encontrado');
    }

    return caregiver;
  }

  /**
   * Retorna o caregiver se existir, ou null se não existir
   * Versão "safe" que não lança exceção
   */
  static async findByUserId(userId: number) {
    const caregiver = await prisma.caregiver.findUnique({
      where: { userId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            role: true,
            isActive: true,
          },
        },
        babies: {
          include: {
            baby: true,
          },
        },
      },
    });

    return caregiver;
  }

  static async update(userId: number, input: UpdateCaregiverInput) {
    const caregiver = await prisma.caregiver.findUnique({
      where: { userId },
    });

    if (!caregiver) {
      throw AppError.notFound('Cuidador não encontrado');
    }

    return prisma.caregiver.update({
      where: { userId },
      data: input,
      include: {
        user: {
          select: {
            id: true,
            email: true,
            role: true,
          },
        },
      },
    });
  }

  static async searchByEmail(email: string) {
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      include: { caregiver: true },
    });

    if (!user || !user.caregiver) {
      return null;
    }

    return {
      id: user.caregiver.id,
      fullName: user.caregiver.fullName,
      email: user.email,
    };
  }

  static async searchByCpf(cpf: string) {
    const cleanedCpf = cleanCPF(cpf);
    
    if (!validateCPF(cleanedCpf)) {
      throw AppError.badRequest('CPF inválido');
    }

    const caregiver = await prisma.caregiver.findUnique({
      where: { cpf: cleanedCpf },
      include: {
        user: {
          select: {
            email: true,
          },
        },
      },
    });

    if (!caregiver) {
      return null;
    }

    return {
      id: caregiver.id,
      fullName: caregiver.fullName,
      email: caregiver.user.email,
    };
  }
}

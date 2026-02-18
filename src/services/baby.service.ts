// Olive Baby API - Baby Service
import { prisma } from '../config/database';
import { AppError } from '../utils/errors/AppError';
import { Relationship } from '@prisma/client';
import { isFutureDate } from '../utils/helpers/date.helper';
import { hashCpf, validateCpfFormat, cleanCpf } from '../utils/helpers/cpf-hash.helper';
import { BabyMemberType, BabyMemberRole } from '@prisma/client';
import { hasBabyAccessByCaregiverId, isBabyOwner } from '../utils/helpers/baby-permission.helper';
import { BabyMemberStatus } from '@prisma/client';

interface CreateBabyInput {
  name: string;
  birthDate: Date;
  city?: string;
  state?: string;
  country?: string;
  birthWeightGrams?: number;
  birthLengthCm?: number;
  relationship: Relationship;
  babyCpf?: string; // CPF do bebê (será hashado)
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
  static async create(caregiverId: number, input: CreateBabyInput, userId: number) {
    // Validar data de nascimento
    if (isFutureDate(input.birthDate)) {
      throw AppError.badRequest('Data de nascimento não pode ser futura');
    }

    const { relationship, babyCpf, ...babyData } = input;

    // Processar CPF se fornecido
    let babyCpfHash: string | undefined;
    if (babyCpf) {
      if (!validateCpfFormat(babyCpf)) {
        throw AppError.badRequest('CPF inválido');
      }
      
      const cleanCpfValue = cleanCpf(babyCpf);
      babyCpfHash = hashCpf(cleanCpfValue);
      
      // Verificar se já existe bebê com este CPF
      const existingBaby = await prisma.baby.findUnique({
        where: { babyCpfHash }
      });
      
      if (existingBaby) {
        throw AppError.conflict('Já existe um bebê cadastrado com este CPF');
      }
    }

    // Criar bebê e vínculo em transação
    const result = await prisma.$transaction(async (tx) => {
      const baby = await tx.baby.create({
        data: {
          ...babyData,
          babyCpfHash,
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

      // Criar vínculo como OWNER_PARENT_1
      await tx.babyMember.create({
        data: {
          babyId: baby.id,
          userId,
          memberType: BabyMemberType.PARENT,
          role: BabyMemberRole.OWNER_PARENT_1,
          status: 'ACTIVE'
        }
      });

      return baby;
    });

    return result;
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
    const hasAccess = await hasBabyAccessByCaregiverId(caregiverId, babyId);
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
        createdAt: 'asc', // Primeiro bebê criado primeiro (mais antigo)
      },
    });

    return babies;
  }

  /**
   * Lista bebês de um usuário através de múltiplos caminhos (caregiver, babyMember e professional)
   * Garante que sempre encontramos todos os bebês, mesmo que um caminho falhe
   */
  static async listByUser(userId: number) {
    // Buscar caregiver e professional do usuário em paralelo
    const [caregiver, professional] = await Promise.all([
      prisma.caregiver.findUnique({
        where: { userId },
        select: { id: true },
      }),
      prisma.professional.findUnique({
        where: { userId },
        select: { id: true, status: true },
      }),
    ]);

    // Buscar bebês de todas as fontes em paralelo
    const [babiesFromCaregiver, babiesFromMember, babiesFromProfessional] = await Promise.all([
      // Via CaregiverBaby (relação tradicional)
      caregiver
        ? prisma.baby.findMany({
            where: {
              caregivers: {
                some: {
                  caregiverId: caregiver.id,
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
              createdAt: 'asc',
            },
          })
        : Promise.resolve([]),
      // Via BabyMember (baby sharing)
      prisma.baby.findMany({
        where: {
          members: {
            some: {
              userId,
              status: 'ACTIVE',
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
          createdAt: 'asc',
        },
      }),
      // Via BabyProfessional (profissionais de saúde)
      professional && professional.status === 'ACTIVE'
        ? prisma.baby.findMany({
            where: {
              professionals: {
                some: {
                  professionalId: professional.id,
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
              createdAt: 'asc',
            },
          })
        : Promise.resolve([]),
    ]);

    // Combinar e remover duplicatas (por id)
    const allBabies = [...babiesFromCaregiver, ...babiesFromMember, ...babiesFromProfessional];
    const uniqueBabies = allBabies.reduce((acc, baby) => {
      if (!acc.find((b) => b.id === baby.id)) {
        acc.push(baby);
      }
      return acc;
    }, [] as typeof allBabies);

    // Ordenar por data de criação
    uniqueBabies.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

    return uniqueBabies;
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
    const caregiver = await prisma.caregiver.findUnique({
      where: { id: caregiverId },
      select: { userId: true }
    });
    if (!caregiver) {
      throw AppError.forbidden('Cuidador não encontrado');
    }
    
    const isOwner = await isBabyOwner(caregiver.userId, babyId);
    if (!isOwner) {
      throw AppError.forbidden('Apenas os responsáveis principais podem remover o bebê');
    }

    await prisma.baby.delete({
      where: { id: babyId },
    });
  }

  /** @deprecated Use BabyInvite/BabyMember system instead */
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

  /** @deprecated Use BabyMember revoke system instead */
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

  /** @deprecated Use BabyMember list instead */
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

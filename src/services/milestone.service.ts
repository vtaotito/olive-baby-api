// Olive Baby API - Milestone Service
import { prisma } from '../config/database';
import { AppError } from '../utils/errors/AppError';
import { PREDEFINED_MILESTONES } from '../types';
import { requireBabyAccessByCaregiverId, hasBabyAccessByCaregiverId } from '../utils/helpers/baby-permission.helper';

interface CreateMilestoneInput {
  babyId: number;
  milestoneKey: string;
  milestoneLabel?: string;
  occurredOn?: Date;
  notes?: string;
}

interface UpdateMilestoneInput {
  milestoneLabel?: string;
  occurredOn?: Date;
  notes?: string;
}

export class MilestoneService {
  // Retorna lista de marcos pré-definidos
  static getPredefinedMilestones() {
    return PREDEFINED_MILESTONES;
  }

  static async create(caregiverId: number, input: CreateMilestoneInput) {
    // Verificar acesso ao bebê
    await requireBabyAccessByCaregiverId(caregiverId, input.babyId);

    // Verificar se o marco já foi registrado para este bebê
    const existingMilestone = await prisma.milestone.findFirst({
      where: {
        babyId: input.babyId,
        milestoneKey: input.milestoneKey,
      },
    });

    if (existingMilestone) {
      throw AppError.conflict('Este marco já foi registrado para este bebê');
    }

    // Buscar label do marco pré-definido se não fornecido
    let milestoneLabel = input.milestoneLabel;
    if (!milestoneLabel) {
      const predefined = PREDEFINED_MILESTONES.find(m => m.key === input.milestoneKey);
      milestoneLabel = predefined?.label || input.milestoneKey;
    }

    const milestone = await prisma.milestone.create({
      data: {
        babyId: input.babyId,
        milestoneKey: input.milestoneKey,
        milestoneLabel,
        occurredOn: input.occurredOn,
        notes: input.notes,
      },
      include: {
        baby: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    return milestone;
  }

  static async getById(id: number, caregiverId: number) {
    const milestone = await prisma.milestone.findUnique({
      where: { id },
      include: {
        baby: {
          include: {
            caregivers: true,
          },
        },
      },
    });

    if (!milestone) {
      throw AppError.notFound('Marco não encontrado');
    }

    // Verificar acesso
    const hasAccess = await hasBabyAccessByCaregiverId(caregiverId, milestone.babyId);
    if (!hasAccess) {
      throw AppError.forbidden('Você não tem acesso a este registro');
    }

    return milestone;
  }

  static async listByBaby(caregiverId: number, babyId: number) {
    // Verificar acesso ao bebê
    await requireBabyAccessByCaregiverId(caregiverId, babyId);

    // Buscar marcos registrados
    const registeredMilestones = await prisma.milestone.findMany({
      where: { babyId },
      orderBy: [
        { occurredOn: 'asc' },
        { createdAt: 'asc' },
      ],
    });

    // Criar lista com marcos pré-definidos + status de completude
    const milestonesWithStatus = PREDEFINED_MILESTONES.map(predefined => {
      const registered = registeredMilestones.find(m => m.milestoneKey === predefined.key);
      return {
        key: predefined.key,
        label: predefined.label,
        isCompleted: !!registered,
        record: registered || null,
      };
    });

    // Adicionar marcos customizados (key = 'other' ou não pré-definidos)
    const customMilestones = registeredMilestones.filter(
      m => !PREDEFINED_MILESTONES.some(p => p.key === m.milestoneKey)
    );

    return {
      predefined: milestonesWithStatus,
      custom: customMilestones,
      totalCompleted: registeredMilestones.length,
      totalPredefined: PREDEFINED_MILESTONES.length,
    };
  }

  /**
   * Lista marcos por babyId (sem verificação de acesso)
   * Usado quando acesso já foi verificado no controller (ex: profissionais)
   */
  static async listByBabyId(babyId: number) {
    // Buscar marcos registrados
    const registeredMilestones = await prisma.milestone.findMany({
      where: { babyId },
      orderBy: [
        { occurredOn: 'asc' },
        { createdAt: 'asc' },
      ],
    });

    // Criar lista com marcos pré-definidos + status de completude
    const milestonesWithStatus = PREDEFINED_MILESTONES.map(predefined => {
      const registered = registeredMilestones.find(m => m.milestoneKey === predefined.key);
      return {
        key: predefined.key,
        label: predefined.label,
        isCompleted: !!registered,
        record: registered || null,
      };
    });

    // Adicionar marcos customizados (key = 'other' ou não pré-definidos)
    const customMilestones = registeredMilestones.filter(
      m => !PREDEFINED_MILESTONES.some(p => p.key === m.milestoneKey)
    );

    return {
      predefined: milestonesWithStatus,
      custom: customMilestones,
      totalCompleted: registeredMilestones.length,
      totalPredefined: PREDEFINED_MILESTONES.length,
    };
  }

  static async update(id: number, caregiverId: number, input: UpdateMilestoneInput) {
    // Verificar acesso
    await this.getById(id, caregiverId);

    const milestone = await prisma.milestone.update({
      where: { id },
      data: input,
    });

    return milestone;
  }

  static async delete(id: number, caregiverId: number) {
    // Verificar acesso
    await this.getById(id, caregiverId);

    await prisma.milestone.delete({ where: { id } });
  }

  // Marcar marco como alcançado
  static async markAsCompleted(
    caregiverId: number,
    babyId: number,
    milestoneKey: string,
    occurredOn: Date,
    notes?: string
  ) {
    // Verificar se já existe
    const existing = await prisma.milestone.findFirst({
      where: { babyId, milestoneKey },
    });

    if (existing) {
      // Atualizar data se já existe
      return prisma.milestone.update({
        where: { id: existing.id },
        data: { occurredOn, notes },
      });
    }

    // Criar novo
    return this.create(caregiverId, {
      babyId,
      milestoneKey,
      occurredOn,
      notes,
    });
  }

  // Desmarcar marco (remove registro)
  static async unmark(caregiverId: number, babyId: number, milestoneKey: string) {
    // Verificar acesso ao bebê
    await requireBabyAccessByCaregiverId(caregiverId, babyId);

    const milestone = await prisma.milestone.findFirst({
      where: { babyId, milestoneKey },
    });

    if (!milestone) {
      throw AppError.notFound('Marco não encontrado');
    }

    await prisma.milestone.delete({ where: { id: milestone.id } });
  }

  // Progresso geral de marcos
  static async getProgress(caregiverId: number, babyId: number) {
    // Verificar acesso ao bebê
    await requireBabyAccessByCaregiverId(caregiverId, babyId);

    return this.getProgressByBabyId(babyId);
  }

  /**
   * Obtém progresso de marcos por babyId (sem verificação de cuidador).
   * Usado quando acesso já foi verificado no controller (ex: profissionais via hasBabyAccess).
   */
  static async getProgressByBabyId(babyId: number) {
    const completed = await prisma.milestone.count({
      where: { babyId },
    });

    const completedPredefined = await prisma.milestone.count({
      where: {
        babyId,
        milestoneKey: {
          in: PREDEFINED_MILESTONES.map(m => m.key),
        },
      },
    });

    return {
      totalPredefined: PREDEFINED_MILESTONES.length,
      completedPredefined,
      percentagePredefined: Math.round((completedPredefined / PREDEFINED_MILESTONES.length) * 100),
      totalCompleted: completed,
    };
  }
}

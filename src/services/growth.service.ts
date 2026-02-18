// Olive Baby API - Growth Service
import { prisma } from '../config/database';
import { AppError } from '../utils/errors/AppError';
import { Decimal } from '@prisma/client/runtime/library';
import { requireBabyAccessByCaregiverId, hasBabyAccessByCaregiverId } from '../utils/helpers/baby-permission.helper';

interface CreateGrowthInput {
  babyId: number;
  measuredAt: Date;
  weightKg?: number;
  heightCm?: number;
  headCircumferenceCm?: number;
  source?: string;
  notes?: string;
}

interface UpdateGrowthInput {
  measuredAt?: Date;
  weightKg?: number;
  heightCm?: number;
  headCircumferenceCm?: number;
  source?: string;
  notes?: string;
}

interface ListGrowthFilter {
  startDate?: Date;
  endDate?: Date;
}

export class GrowthService {
  static async create(caregiverId: number, input: CreateGrowthInput) {
    await requireBabyAccessByCaregiverId(caregiverId, input.babyId);

    // Verificar se tem pelo menos uma medição
    if (!input.weightKg && !input.heightCm && !input.headCircumferenceCm) {
      throw AppError.badRequest('Informe pelo menos uma medição (peso, altura ou perímetro cefálico)');
    }

    const growth = await prisma.growth.create({
      data: {
        babyId: input.babyId,
        measuredAt: input.measuredAt,
        weightKg: input.weightKg,
        heightCm: input.heightCm,
        headCircumferenceCm: input.headCircumferenceCm,
        source: input.source,
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

    return growth;
  }

  static async getById(id: number, caregiverId: number) {
    const growth = await prisma.growth.findUnique({
      where: { id },
      include: {
        baby: true,
      },
    });

    if (!growth) {
      throw AppError.notFound('Registro de crescimento não encontrado');
    }

    // Verificar acesso
    const hasAccess = await hasBabyAccessByCaregiverId(caregiverId, growth.babyId);
    if (!hasAccess) {
      throw AppError.forbidden('Você não tem acesso a este registro');
    }

    return growth;
  }

  static async listByBaby(
    caregiverId: number,
    babyId: number,
    filter: ListGrowthFilter = {},
    page = 1,
    limit = 50
  ) {
    await requireBabyAccessByCaregiverId(caregiverId, babyId);

    const where: any = { babyId };

    if (filter.startDate || filter.endDate) {
      where.measuredAt = {};
      if (filter.startDate) {
        where.measuredAt.gte = filter.startDate;
      }
      if (filter.endDate) {
        where.measuredAt.lte = filter.endDate;
      }
    }

    const [records, total] = await Promise.all([
      prisma.growth.findMany({
        where,
        orderBy: { measuredAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.growth.count({ where }),
    ]);

    return {
      data: records,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Lista registros de crescimento por babyId (sem verificação de acesso)
   * Usado quando acesso já foi verificado no controller (ex: profissionais)
   */
  static async listByBabyId(
    babyId: number,
    filter: ListGrowthFilter = {},
    page = 1,
    limit = 50
  ) {
    const where: any = { babyId };

    if (filter.startDate || filter.endDate) {
      where.measuredAt = {};
      if (filter.startDate) {
        where.measuredAt.gte = filter.startDate;
      }
      if (filter.endDate) {
        where.measuredAt.lte = filter.endDate;
      }
    }

    const [records, total] = await Promise.all([
      prisma.growth.findMany({
        where,
        orderBy: { measuredAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.growth.count({ where }),
    ]);

    return {
      data: records,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  static async update(id: number, caregiverId: number, input: UpdateGrowthInput) {
    // Verificar acesso
    await this.getById(id, caregiverId);

    const growth = await prisma.growth.update({
      where: { id },
      data: input,
    });

    return growth;
  }

  static async delete(id: number, caregiverId: number) {
    // Verificar acesso
    await this.getById(id, caregiverId);

    await prisma.growth.delete({ where: { id } });
  }

  // Buscar última medição do bebê
  static async getLatest(caregiverId: number, babyId: number) {
    await requireBabyAccessByCaregiverId(caregiverId, babyId);

    const latest = await prisma.growth.findFirst({
      where: { babyId },
      orderBy: { measuredAt: 'desc' },
    });

    return latest;
  }

  // Calcular estatísticas de crescimento
  static async getGrowthStats(caregiverId: number, babyId: number) {
    await requireBabyAccessByCaregiverId(caregiverId, babyId);

    // Buscar todas as medições ordenadas por data
    const records = await prisma.growth.findMany({
      where: { babyId },
      orderBy: { measuredAt: 'asc' },
    });

    if (records.length === 0) {
      return {
        totalRecords: 0,
        firstRecord: null,
        lastRecord: null,
        weightGain: null,
        heightGain: null,
        headGain: null,
      };
    }

    const firstRecord = records[0];
    const lastRecord = records[records.length - 1];

    // Calcular ganhos (diferença entre primeira e última medição)
    const weightGain = firstRecord.weightKg && lastRecord.weightKg
      ? Number(lastRecord.weightKg) - Number(firstRecord.weightKg)
      : null;

    const heightGain = firstRecord.heightCm && lastRecord.heightCm
      ? Number(lastRecord.heightCm) - Number(firstRecord.heightCm)
      : null;

    const headGain = firstRecord.headCircumferenceCm && lastRecord.headCircumferenceCm
      ? Number(lastRecord.headCircumferenceCm) - Number(firstRecord.headCircumferenceCm)
      : null;

    return {
      totalRecords: records.length,
      firstRecord: {
        date: firstRecord.measuredAt,
        weightKg: firstRecord.weightKg ? Number(firstRecord.weightKg) : null,
        heightCm: firstRecord.heightCm ? Number(firstRecord.heightCm) : null,
        headCircumferenceCm: firstRecord.headCircumferenceCm ? Number(firstRecord.headCircumferenceCm) : null,
      },
      lastRecord: {
        date: lastRecord.measuredAt,
        weightKg: lastRecord.weightKg ? Number(lastRecord.weightKg) : null,
        heightCm: lastRecord.heightCm ? Number(lastRecord.heightCm) : null,
        headCircumferenceCm: lastRecord.headCircumferenceCm ? Number(lastRecord.headCircumferenceCm) : null,
      },
      weightGain: weightGain ? Math.round(weightGain * 100) / 100 : null,
      heightGain: heightGain ? Math.round(heightGain * 100) / 100 : null,
      headGain: headGain ? Math.round(headGain * 100) / 100 : null,
    };
  }
}

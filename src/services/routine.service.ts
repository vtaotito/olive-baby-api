// Olive Baby API - Routine Service
import { prisma } from '../config/database';
import { AppError } from '../utils/errors/AppError';
import { RoutineType } from '@prisma/client';
import { RoutineMeta } from '../types';
import { calculateDurationSeconds } from '../utils/helpers/date.helper';
import { 
  normalizeAndSanitizeMeta, 
  mergeRoutineMeta,
  sanitizeRoutineMeta 
} from '../utils/routineMeta.utils';

interface CreateRoutineInput {
  babyId: number;
  routineType: RoutineType;
  startTime: Date;
  endTime?: Date;
  notes?: string;
  meta?: RoutineMeta;
}

interface UpdateRoutineInput {
  startTime?: Date;
  endTime?: Date;
  notes?: string;
  meta?: RoutineMeta;
}

interface ListRoutinesFilter {
  babyId?: number;
  routineType?: RoutineType;
  startDate?: Date;
  endDate?: Date;
}

// Rotinas que têm início e fim (timer)
const TIMED_ROUTINES: RoutineType[] = ['FEEDING', 'SLEEP', 'BATH', 'MILK_EXTRACTION'];

export class RoutineService {
  // ==========================================
  // CRUD Básico
  // ==========================================

  static async create(caregiverId: number, input: CreateRoutineInput) {
    // Verificar acesso ao bebê
    const hasAccess = await prisma.caregiverBaby.findFirst({
      where: {
        babyId: input.babyId,
        caregiverId,
      },
    });

    if (!hasAccess) {
      throw AppError.forbidden('Você não tem acesso a este bebê');
    }

    // Calcular duração se tiver endTime
    let durationSeconds: number | null = null;
    if (input.endTime) {
      durationSeconds = calculateDurationSeconds(input.startTime, input.endTime);
    }

    // Sanitizar meta baseado no routineType
    const sanitizedMeta = normalizeAndSanitizeMeta(
      input.routineType,
      input.meta as Record<string, unknown>
    );

    const routine = await prisma.routineLog.create({
      data: {
        babyId: input.babyId,
        routineType: input.routineType,
        startTime: input.startTime,
        endTime: input.endTime,
        durationSeconds,
        notes: input.notes,
        meta: sanitizedMeta as object,
      },
    });

    return routine;
  }

  static async getById(id: number, caregiverId: number) {
    const routine = await prisma.routineLog.findUnique({
      where: { id },
      include: {
        baby: {
          include: {
            caregivers: true,
          },
        },
      },
    });

    if (!routine) {
      throw AppError.notFound('Registro não encontrado');
    }

    // Verificar acesso
    const hasAccess = routine.baby.caregivers.some(cb => cb.caregiverId === caregiverId);
    if (!hasAccess) {
      throw AppError.forbidden('Você não tem acesso a este registro');
    }

    return routine;
  }

  static async list(caregiverId: number, filter: ListRoutinesFilter, page = 1, limit = 50) {
    const where: any = {
      baby: {
        caregivers: {
          some: { caregiverId },
        },
      },
    };

    if (filter.babyId) {
      where.babyId = filter.babyId;
    }

    if (filter.routineType) {
      where.routineType = filter.routineType;
    }

    if (filter.startDate || filter.endDate) {
      where.startTime = {};
      if (filter.startDate) {
        where.startTime.gte = filter.startDate;
      }
      if (filter.endDate) {
        where.startTime.lte = filter.endDate;
      }
    }

    const [routines, total] = await Promise.all([
      prisma.routineLog.findMany({
        where,
        include: {
          baby: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: { startTime: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.routineLog.count({ where }),
    ]);

    return {
      data: routines,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  static async update(id: number, caregiverId: number, input: UpdateRoutineInput) {
    // Verificar acesso e obter rotina existente
    const existingRoutine = await this.getById(id, caregiverId);

    // Determinar startTime e endTime finais
    const finalStartTime = input.startTime || existingRoutine.startTime;
    const finalEndTime = input.endTime !== undefined 
      ? input.endTime 
      : existingRoutine.endTime;

    // Recalcular duração se temos ambos os tempos
    let durationSeconds: number | null = null;
    if (finalEndTime && finalStartTime) {
      durationSeconds = calculateDurationSeconds(finalStartTime, finalEndTime);
    }

    // Sanitizar meta baseado no routineType
    let sanitizedMeta: Record<string, unknown> | undefined;
    if (input.meta !== undefined) {
      // Fazer merge do meta existente com o novo e sanitizar
      sanitizedMeta = mergeRoutineMeta(
        existingRoutine.routineType,
        existingRoutine.meta as Record<string, unknown> | null,
        input.meta as Record<string, unknown>
      );
    }

    // Preparar dados para atualização
    const updateData: {
      startTime?: Date;
      endTime?: Date | null;
      notes?: string;
      durationSeconds?: number | null;
      meta?: object;
    } = {};

    if (input.startTime !== undefined) {
      updateData.startTime = input.startTime;
    }
    if (input.endTime !== undefined) {
      updateData.endTime = input.endTime;
    }
    if (input.notes !== undefined) {
      updateData.notes = input.notes;
    }
    if (durationSeconds !== null) {
      updateData.durationSeconds = durationSeconds;
    }
    if (sanitizedMeta !== undefined) {
      updateData.meta = sanitizedMeta;
    }

    const routine = await prisma.routineLog.update({
      where: { id },
      data: updateData,
    });

    return routine;
  }

  static async delete(id: number, caregiverId: number) {
    // Verificar acesso
    await this.getById(id, caregiverId);

    await prisma.routineLog.delete({ where: { id } });
  }

  // ==========================================
  // Rotinas com Timer (Início/Fim)
  // ==========================================

  static async hasOpenRoutine(babyId: number, routineType: RoutineType) {
    const openRoutine = await prisma.routineLog.findFirst({
      where: {
        babyId,
        routineType,
        endTime: null,
      },
    });

    return openRoutine;
  }

  static async startRoutine(
    caregiverId: number,
    babyId: number,
    routineType: RoutineType,
    meta?: RoutineMeta,
    notes?: string
  ) {
    // Verificar acesso ao bebê
    const hasAccess = await prisma.caregiverBaby.findFirst({
      where: { babyId, caregiverId },
    });

    if (!hasAccess) {
      throw AppError.forbidden('Você não tem acesso a este bebê');
    }

    // Verificar se é rotina com timer
    if (!TIMED_ROUTINES.includes(routineType)) {
      throw AppError.badRequest(`${routineType} não é uma rotina com timer`);
    }

    // Verificar se já existe rotina em aberto
    const openRoutine = await this.hasOpenRoutine(babyId, routineType);
    if (openRoutine) {
      // Retorna código específico e a rotina aberta para o frontend
      throw AppError.conflict(
        `Já existe um registro de ${routineType} em aberto`,
        `${routineType}_ALREADY_OPEN`,
        { openRoutine }
      );
    }

    // Sanitizar meta baseado no routineType
    const sanitizedMeta = sanitizeRoutineMeta(routineType, meta as Record<string, unknown>);

    const routine = await prisma.routineLog.create({
      data: {
        babyId,
        routineType,
        startTime: new Date(),
        meta: sanitizedMeta as object,
        notes,
      },
    });

    return routine;
  }

  static async closeRoutine(
    caregiverId: number,
    babyId: number,
    routineType: RoutineType,
    meta?: RoutineMeta,
    notes?: string
  ) {
    // Verificar acesso ao bebê
    const hasAccess = await prisma.caregiverBaby.findFirst({
      where: { babyId, caregiverId },
    });

    if (!hasAccess) {
      throw AppError.forbidden('Você não tem acesso a este bebê');
    }

    // Buscar rotina em aberto
    const openRoutine = await this.hasOpenRoutine(babyId, routineType);
    if (!openRoutine) {
      throw AppError.notFound(`Nenhum registro de ${routineType} em aberto`);
    }

    const endTime = new Date();
    const durationSeconds = calculateDurationSeconds(openRoutine.startTime, endTime);

    // Merge e sanitização dos metadados
    const sanitizedMeta = mergeRoutineMeta(
      routineType,
      openRoutine.meta as Record<string, unknown>,
      meta as Record<string, unknown>
    );

    const routine = await prisma.routineLog.update({
      where: { id: openRoutine.id },
      data: {
        endTime,
        durationSeconds,
        meta: sanitizedMeta as object,
        notes: notes || openRoutine.notes,
      },
    });

    return routine;
  }

  static async getOpenRoutine(caregiverId: number, babyId: number, routineType: RoutineType) {
    // Verificar acesso ao bebê
    const hasAccess = await prisma.caregiverBaby.findFirst({
      where: { babyId, caregiverId },
    });

    if (!hasAccess) {
      throw AppError.forbidden('Você não tem acesso a este bebê');
    }

    const openRoutine = await this.hasOpenRoutine(babyId, routineType);
    return openRoutine;
  }

  // ==========================================
  // Rotinas Instantâneas (sem timer)
  // ==========================================

  static async registerInstantRoutine(
    caregiverId: number,
    babyId: number,
    routineType: RoutineType,
    meta?: RoutineMeta,
    notes?: string
  ) {
    // Verificar acesso ao bebê
    const hasAccess = await prisma.caregiverBaby.findFirst({
      where: { babyId, caregiverId },
    });

    if (!hasAccess) {
      throw AppError.forbidden('Você não tem acesso a este bebê');
    }

    // Sanitizar meta baseado no routineType
    const sanitizedMeta = normalizeAndSanitizeMeta(
      routineType,
      meta as Record<string, unknown>
    );

    const routine = await prisma.routineLog.create({
      data: {
        babyId,
        routineType,
        startTime: new Date(),
        endTime: new Date(),
        durationSeconds: 0,
        meta: sanitizedMeta as object,
        notes,
      },
    });

    return routine;
  }
}

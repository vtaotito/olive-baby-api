// Olive Baby API - Vaccine Service
import { prisma } from '../config/database';
import { AppError } from '../utils/errors/AppError';
import { requireBabyAccessByCaregiverId } from '../utils/helpers/baby-permission.helper';
import { VaccineStatus, VaccineCalendarSource } from '@prisma/client';
import { addMonths, addDays, isBefore, startOfDay, differenceInDays } from 'date-fns';

// ==========================================
// Types
// ==========================================

interface SyncVaccinesInput {
  babyId: number;
  source?: VaccineCalendarSource;
}

interface CreateVaccineRecordInput {
  babyId: number;
  vaccineKey: string;
  vaccineName: string;
  doseLabel: string;
  doseNumber?: number;
  recommendedAt: Date;
  appliedAt?: Date;
  status?: VaccineStatus;
  source?: VaccineCalendarSource;
  lotNumber?: string;
  clinicName?: string;
  professionalName?: string;
  notes?: string;
}

interface UpdateVaccineRecordInput {
  appliedAt?: Date | null;
  status?: VaccineStatus;
  lotNumber?: string | null;
  clinicName?: string | null;
  professionalName?: string | null;
  notes?: string | null;
}

interface VaccineSummary {
  total: number;
  applied: number;
  pending: number;
  overdue: number;
  skipped: number;
  nextVaccines: {
    id: number;
    vaccineName: string;
    doseLabel: string;
    recommendedAt: Date;
    daysUntil: number;
    isOverdue: boolean;
  }[];
}

// ==========================================
// Helper Functions
// ==========================================

/**
 * Calcula a data recomendada baseada na data de nascimento e idade em meses
 */
function calculateRecommendedDate(birthDate: Date, ageMonths: number, ageDays?: number | null): Date {
  let recommendedDate = addMonths(new Date(birthDate), ageMonths);
  
  if (ageDays) {
    recommendedDate = addDays(recommendedDate, ageDays);
  }
  
  return startOfDay(recommendedDate);
}

/**
 * Determina se uma vacina está atrasada
 */
function isVaccineOverdue(recommendedAt: Date, status: VaccineStatus): boolean {
  if (status === VaccineStatus.APPLIED || status === VaccineStatus.SKIPPED) {
    return false;
  }
  
  const today = startOfDay(new Date());
  return isBefore(recommendedAt, today);
}

// ==========================================
// Service Class
// ==========================================

export class VaccineService {
  /**
   * Lista calendários disponíveis
   */
  static async getAvailableCalendars() {
    // Por enquanto só PNI, mas arquitetura permite expandir
    return [
      {
        code: 'PNI',
        name: 'Programa Nacional de Imunização (PNI)',
        description: 'Calendário oficial do Ministério da Saúde do Brasil',
        isDefault: true,
      },
      // Futuro: SBIm
      // {
      //   code: 'SBIM',
      //   name: 'Sociedade Brasileira de Imunizações (SBIm)',
      //   description: 'Calendário para rede privada com vacinas adicionais',
      //   isDefault: false,
      // },
    ];
  }

  /**
   * Lista definições de vacinas do calendário
   */
  static async getVaccineDefinitions(source: VaccineCalendarSource = VaccineCalendarSource.PNI) {
    const definitions = await prisma.vaccineDefinition.findMany({
      where: { source },
      orderBy: [
        { ageMonths: 'asc' },
        { sortOrder: 'asc' },
      ],
    });

    return definitions;
  }

  /**
   * Sincroniza vacinas do calendário para o bebê (idempotente)
   * Cria registros PENDING para vacinas que ainda não existem
   */
  static async syncVaccinesForBaby(caregiverId: number, input: SyncVaccinesInput) {
    const { babyId, source = VaccineCalendarSource.PNI } = input;

    // Verificar acesso ao bebê
    await requireBabyAccessByCaregiverId(caregiverId, babyId);
    const baby = await prisma.baby.findUnique({ where: { id: babyId } });
    if (!baby) throw AppError.notFound('Bebê não encontrado');

    // Buscar definições do calendário
    const definitions = await prisma.vaccineDefinition.findMany({
      where: { source },
      orderBy: [
        { ageMonths: 'asc' },
        { sortOrder: 'asc' },
      ],
    });

    // Buscar registros existentes
    const existingRecords = await prisma.babyVaccineRecord.findMany({
      where: { babyId, source },
    });

    const existingKeys = new Set(
      existingRecords.map(r => `${r.vaccineKey}:${r.doseLabel}`)
    );

    // Criar registros para vacinas que não existem
    const recordsToCreate: CreateVaccineRecordInput[] = [];

    for (const def of definitions) {
      const key = `${def.vaccineKey}:${def.doseLabel}`;
      
      if (!existingKeys.has(key)) {
        const recommendedAt = calculateRecommendedDate(
          baby.birthDate,
          def.ageMonths,
          def.ageDays
        );

        recordsToCreate.push({
          babyId,
          vaccineKey: def.vaccineKey,
          vaccineName: def.name,
          doseLabel: def.doseLabel,
          doseNumber: def.doseNumber,
          recommendedAt,
          status: VaccineStatus.PENDING,
          source,
        });
      }
    }

    // Criar registros em batch
    if (recordsToCreate.length > 0) {
      await prisma.babyVaccineRecord.createMany({
        data: recordsToCreate,
        skipDuplicates: true,
      });
    }

    return {
      synced: recordsToCreate.length,
      existing: existingRecords.length,
      total: definitions.length,
    };
  }

  /**
   * Obtém resumo das vacinas do bebê
   */
  static async getVaccineSummary(caregiverId: number, babyId: number): Promise<VaccineSummary> {
    // Verificar acesso ao bebê
    await requireBabyAccessByCaregiverId(caregiverId, babyId);

    // Buscar todos os registros
    const records = await prisma.babyVaccineRecord.findMany({
      where: { babyId },
      orderBy: { recommendedAt: 'asc' },
    });

    const today = startOfDay(new Date());
    
    // Calcular contadores
    let applied = 0;
    let pending = 0;
    let overdue = 0;
    let skipped = 0;

    const nextVaccines: VaccineSummary['nextVaccines'] = [];

    for (const record of records) {
      const isOverdue = isVaccineOverdue(record.recommendedAt, record.status);

      switch (record.status) {
        case VaccineStatus.APPLIED:
          applied++;
          break;
        case VaccineStatus.SKIPPED:
          skipped++;
          break;
        case VaccineStatus.PENDING:
          if (isOverdue) {
            overdue++;
          } else {
            pending++;
          }
          break;
      }

      // Adicionar às próximas vacinas (pendentes ou atrasadas, max 5)
      if (record.status === VaccineStatus.PENDING && nextVaccines.length < 5) {
        const daysUntil = differenceInDays(record.recommendedAt, today);
        nextVaccines.push({
          id: record.id,
          vaccineName: record.vaccineName,
          doseLabel: record.doseLabel,
          recommendedAt: record.recommendedAt,
          daysUntil,
          isOverdue,
        });
      }
    }

    return {
      total: records.length,
      applied,
      pending,
      overdue,
      skipped,
      nextVaccines,
    };
  }

  /**
   * Lista todas as vacinas do bebê (timeline)
   */
  static async getVaccineTimeline(
    caregiverId: number,
    babyId: number,
    options?: {
      status?: VaccineStatus;
      source?: VaccineCalendarSource;
    }
  ) {
    // Verificar acesso ao bebê
    await requireBabyAccessByCaregiverId(caregiverId, babyId);

    const where: any = { babyId };
    
    if (options?.status) {
      where.status = options.status;
    }
    if (options?.source) {
      where.source = options.source;
    }

    const records = await prisma.babyVaccineRecord.findMany({
      where,
      orderBy: [
        { recommendedAt: 'asc' },
        { vaccineName: 'asc' },
      ],
    });

    const today = startOfDay(new Date());

    // Adicionar flag de atrasada e agrupar por período
    return records.map(record => ({
      ...record,
      isOverdue: isVaccineOverdue(record.recommendedAt, record.status),
      daysUntil: differenceInDays(record.recommendedAt, today),
    }));
  }

  /**
   * Obtém resumo das vacinas do bebê (sem verificação de cuidador).
   * Usado quando acesso já foi verificado no controller (ex: profissionais via hasBabyAccess).
   */
  static async getVaccineSummaryByBabyId(babyId: number): Promise<VaccineSummary> {
    const records = await prisma.babyVaccineRecord.findMany({
      where: { babyId },
      orderBy: { recommendedAt: 'asc' },
    });

    const today = startOfDay(new Date());
    
    let applied = 0;
    let pending = 0;
    let overdue = 0;
    let skipped = 0;

    const nextVaccines: VaccineSummary['nextVaccines'] = [];

    for (const record of records) {
      const isOverdue = isVaccineOverdue(record.recommendedAt, record.status);

      switch (record.status) {
        case VaccineStatus.APPLIED:
          applied++;
          break;
        case VaccineStatus.SKIPPED:
          skipped++;
          break;
        case VaccineStatus.PENDING:
          if (isOverdue) {
            overdue++;
          } else {
            pending++;
          }
          break;
      }

      if (record.status === VaccineStatus.PENDING && nextVaccines.length < 5) {
        const daysUntil = differenceInDays(record.recommendedAt, today);
        nextVaccines.push({
          id: record.id,
          vaccineName: record.vaccineName,
          doseLabel: record.doseLabel,
          recommendedAt: record.recommendedAt,
          daysUntil,
          isOverdue,
        });
      }
    }

    return {
      total: records.length,
      applied,
      pending,
      overdue,
      skipped,
      nextVaccines,
    };
  }

  /**
   * Lista timeline de vacinas do bebê (sem verificação de cuidador).
   * Usado quando acesso já foi verificado no controller (ex: profissionais via hasBabyAccess).
   */
  static async getVaccineTimelineByBabyId(
    babyId: number,
    options?: {
      status?: VaccineStatus;
      source?: VaccineCalendarSource;
    }
  ) {
    const where: any = { babyId };
    
    if (options?.status) {
      where.status = options.status;
    }
    if (options?.source) {
      where.source = options.source;
    }

    const records = await prisma.babyVaccineRecord.findMany({
      where,
      orderBy: [
        { recommendedAt: 'asc' },
        { vaccineName: 'asc' },
      ],
    });

    const today = startOfDay(new Date());

    return records.map(record => ({
      ...record,
      isOverdue: isVaccineOverdue(record.recommendedAt, record.status),
      daysUntil: differenceInDays(record.recommendedAt, today),
    }));
  }

  /**
   * Obtém um registro específico por babyId (sem verificação de cuidador).
   * Usado quando acesso já foi verificado no controller.
   */
  static async getVaccineRecordByBabyId(babyId: number, recordId: number) {
    const record = await prisma.babyVaccineRecord.findFirst({
      where: {
        id: recordId,
        babyId,
      },
      include: {
        baby: {
          select: { id: true, name: true, birthDate: true },
        },
      },
    });

    if (!record) {
      throw AppError.notFound('Registro de vacina não encontrado');
    }

    return {
      ...record,
      isOverdue: isVaccineOverdue(record.recommendedAt, record.status),
    };
  }

  /**
   * Obtém um registro específico
   */
  static async getVaccineRecordById(caregiverId: number, babyId: number, recordId: number) {
    // Verificar acesso ao bebê
    await requireBabyAccessByCaregiverId(caregiverId, babyId);
    
    const record = await prisma.babyVaccineRecord.findFirst({
      where: {
        id: recordId,
        babyId,
      },
      include: {
        baby: {
          select: { id: true, name: true, birthDate: true },
        },
      },
    });

    if (!record) {
      throw AppError.notFound('Registro de vacina não encontrado');
    }

    return {
      ...record,
      isOverdue: isVaccineOverdue(record.recommendedAt, record.status),
    };
  }

  /**
   * Cria um registro manual de vacina (fora do calendário)
   */
  static async createManualRecord(caregiverId: number, input: CreateVaccineRecordInput) {
    // Verificar acesso ao bebê
    await requireBabyAccessByCaregiverId(caregiverId, input.babyId);

    // Verificar duplicidade
    const existing = await prisma.babyVaccineRecord.findFirst({
      where: {
        babyId: input.babyId,
        vaccineKey: input.vaccineKey,
        doseLabel: input.doseLabel,
        source: input.source || VaccineCalendarSource.PNI,
      },
    });

    if (existing) {
      throw AppError.conflict('Este registro de vacina já existe. Use a função de atualizar.');
    }

    const record = await prisma.babyVaccineRecord.create({
      data: {
        babyId: input.babyId,
        vaccineKey: input.vaccineKey,
        vaccineName: input.vaccineName,
        doseLabel: input.doseLabel,
        doseNumber: input.doseNumber || 1,
        recommendedAt: input.recommendedAt,
        appliedAt: input.appliedAt,
        status: input.appliedAt ? VaccineStatus.APPLIED : (input.status || VaccineStatus.PENDING),
        source: input.source || VaccineCalendarSource.PNI,
        lotNumber: input.lotNumber,
        clinicName: input.clinicName,
        professionalName: input.professionalName,
        notes: input.notes,
      },
    });

    return record;
  }

  /**
   * Atualiza um registro de vacina (marcar como aplicada, adicionar detalhes)
   */
  static async updateVaccineRecord(
    caregiverId: number,
    babyId: number,
    recordId: number,
    input: UpdateVaccineRecordInput
  ) {
    // Verificar acesso
    const record = await this.getVaccineRecordById(caregiverId, babyId, recordId);

    // Construir dados de atualização
    const updateData: any = {};

    if (input.appliedAt !== undefined) {
      updateData.appliedAt = input.appliedAt;
      // Se definiu data de aplicação, marcar como APPLIED automaticamente
      if (input.appliedAt && !input.status) {
        updateData.status = VaccineStatus.APPLIED;
      }
    }

    if (input.status !== undefined) {
      updateData.status = input.status;
    }

    if (input.lotNumber !== undefined) {
      updateData.lotNumber = input.lotNumber;
    }

    if (input.clinicName !== undefined) {
      updateData.clinicName = input.clinicName;
    }

    if (input.professionalName !== undefined) {
      updateData.professionalName = input.professionalName;
    }

    if (input.notes !== undefined) {
      updateData.notes = input.notes;
    }

    const updated = await prisma.babyVaccineRecord.update({
      where: { id: recordId },
      data: updateData,
    });

    return {
      ...updated,
      isOverdue: isVaccineOverdue(updated.recommendedAt, updated.status),
    };
  }

  /**
   * Marca vacina como aplicada
   */
  static async markAsApplied(
    caregiverId: number,
    babyId: number,
    recordId: number,
    data: {
      appliedAt: Date;
      lotNumber?: string;
      clinicName?: string;
      professionalName?: string;
      notes?: string;
    }
  ) {
    // Validar que a data não é no futuro
    const today = startOfDay(new Date());
    const appliedDate = startOfDay(new Date(data.appliedAt));
    
    if (isBefore(today, appliedDate)) {
      throw AppError.badRequest('A data de aplicação não pode ser no futuro');
    }

    return this.updateVaccineRecord(caregiverId, babyId, recordId, {
      appliedAt: appliedDate,
      status: VaccineStatus.APPLIED,
      lotNumber: data.lotNumber,
      clinicName: data.clinicName,
      professionalName: data.professionalName,
      notes: data.notes,
    });
  }

  /**
   * Marca vacina como pulada/não aplicada
   */
  static async markAsSkipped(
    caregiverId: number,
    babyId: number,
    recordId: number,
    notes?: string
  ) {
    return this.updateVaccineRecord(caregiverId, babyId, recordId, {
      status: VaccineStatus.SKIPPED,
      appliedAt: null,
      notes,
    });
  }

  /**
   * Reseta vacina para pendente
   */
  static async markAsPending(
    caregiverId: number,
    babyId: number,
    recordId: number
  ) {
    return this.updateVaccineRecord(caregiverId, babyId, recordId, {
      status: VaccineStatus.PENDING,
      appliedAt: null,
      lotNumber: null,
      clinicName: null,
      professionalName: null,
    });
  }

  /**
   * Remove um registro de vacina (apenas registros manuais ou não sincronizados)
   */
  static async deleteVaccineRecord(
    caregiverId: number,
    babyId: number,
    recordId: number
  ) {
    // Verificar acesso
    await this.getVaccineRecordById(caregiverId, babyId, recordId);

    await prisma.babyVaccineRecord.delete({
      where: { id: recordId },
    });
  }

  /**
   * Recalcula datas recomendadas se a data de nascimento do bebê mudar
   * Mantém registros já aplicados, apenas ajusta datas de PENDING
   */
  static async recalculateRecommendedDates(babyId: number, newBirthDate: Date) {
    // Buscar todos os registros pendentes
    const pendingRecords = await prisma.babyVaccineRecord.findMany({
      where: {
        babyId,
        status: VaccineStatus.PENDING,
      },
    });

    // Buscar definições para recalcular
    const definitions = await prisma.vaccineDefinition.findMany({
      where: {
        vaccineKey: { in: pendingRecords.map(r => r.vaccineKey) },
      },
    });

    const defMap = new Map(
      definitions.map(d => [`${d.vaccineKey}:${d.doseLabel}`, d])
    );

    // Atualizar datas
    for (const record of pendingRecords) {
      const def = defMap.get(`${record.vaccineKey}:${record.doseLabel}`);
      if (def) {
        const newRecommendedAt = calculateRecommendedDate(
          newBirthDate,
          def.ageMonths,
          def.ageDays
        );

        await prisma.babyVaccineRecord.update({
          where: { id: record.id },
          data: { recommendedAt: newRecommendedAt },
        });
      }
    }

    return { updated: pendingRecords.length };
  }

  /**
   * Obtém vacinas por período (para notificações)
   */
  static async getUpcomingVaccines(babyId: number, daysAhead: number = 7) {
    const today = startOfDay(new Date());
    const futureDate = addDays(today, daysAhead);

    const records = await prisma.babyVaccineRecord.findMany({
      where: {
        babyId,
        status: VaccineStatus.PENDING,
        recommendedAt: {
          gte: today,
          lte: futureDate,
        },
      },
      orderBy: { recommendedAt: 'asc' },
    });

    return records.map(record => ({
      ...record,
      daysUntil: differenceInDays(record.recommendedAt, today),
    }));
  }

  /**
   * Obtém vacinas atrasadas
   */
  static async getOverdueVaccines(babyId: number) {
    const today = startOfDay(new Date());

    const records = await prisma.babyVaccineRecord.findMany({
      where: {
        babyId,
        status: VaccineStatus.PENDING,
        recommendedAt: {
          lt: today,
        },
      },
      orderBy: { recommendedAt: 'asc' },
    });

    return records.map(record => ({
      ...record,
      daysOverdue: differenceInDays(today, record.recommendedAt),
    }));
  }
}

export default VaccineService;

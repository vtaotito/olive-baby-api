// Olive Baby API - Export Service
import { prisma } from '../config/database';
import { AppError } from '../utils/errors/AppError';
import { RoutineType } from '@prisma/client';
import { generateRoutinesCsv } from '../utils/helpers/csv.helper';
import { formatDateBR, formatTimeBR, formatDuration } from '../utils/helpers/date.helper';

interface ExportOptions {
  babyId: number;
  startDate?: Date;
  endDate?: Date;
  routineTypes?: RoutineType[];
}

interface ExportGrowthOptions {
  babyId: number;
  startDate?: Date;
  endDate?: Date;
}

export class ExportService {
  // Exportar rotinas em CSV
  static async exportRoutinesCsv(caregiverId: number, options: ExportOptions): Promise<string> {
    // Verificar acesso ao bebê
    const hasAccess = await prisma.caregiverBaby.findFirst({
      where: {
        babyId: options.babyId,
        caregiverId,
      },
    });

    if (!hasAccess) {
      throw AppError.forbidden('Você não tem acesso a este bebê');
    }

    // Construir filtros
    const where: any = {
      babyId: options.babyId,
    };

    if (options.routineTypes && options.routineTypes.length > 0) {
      where.routineType = { in: options.routineTypes };
    }

    if (options.startDate || options.endDate) {
      where.startTime = {};
      if (options.startDate) {
        where.startTime.gte = options.startDate;
      }
      if (options.endDate) {
        where.startTime.lte = options.endDate;
      }
    }

    // Buscar rotinas
    const routines = await prisma.routineLog.findMany({
      where,
      orderBy: { startTime: 'asc' },
    });

    if (routines.length === 0) {
      throw AppError.notFound('Nenhuma rotina encontrada para os filtros selecionados');
    }

    // Gerar CSV
    const csv = generateRoutinesCsv(routines as any);

    return csv;
  }

  // Exportar crescimento em CSV
  static async exportGrowthCsv(caregiverId: number, options: ExportGrowthOptions): Promise<string> {
    // Verificar acesso ao bebê
    const hasAccess = await prisma.caregiverBaby.findFirst({
      where: {
        babyId: options.babyId,
        caregiverId,
      },
    });

    if (!hasAccess) {
      throw AppError.forbidden('Você não tem acesso a este bebê');
    }

    // Construir filtros
    const where: any = {
      babyId: options.babyId,
    };

    if (options.startDate || options.endDate) {
      where.measuredAt = {};
      if (options.startDate) {
        where.measuredAt.gte = options.startDate;
      }
      if (options.endDate) {
        where.measuredAt.lte = options.endDate;
      }
    }

    // Buscar medições
    const records = await prisma.growth.findMany({
      where,
      orderBy: { measuredAt: 'asc' },
    });

    if (records.length === 0) {
      throw AppError.notFound('Nenhuma medição encontrada para os filtros selecionados');
    }

    // Gerar CSV manualmente
    const header = 'Data,Peso (kg),Altura (cm),Perimetro Cefalico (cm),Fonte,Observacoes\n';
    
    const rows = records.map(r => {
      return [
        formatDateBR(r.measuredAt),
        r.weightKg ? Number(r.weightKg).toFixed(2) : '',
        r.heightCm ? Number(r.heightCm).toFixed(2) : '',
        r.headCircumferenceCm ? Number(r.headCircumferenceCm).toFixed(2) : '',
        r.source || '',
        (r.notes || '').replace(/,/g, ';').replace(/\n/g, ' '),
      ].join(',');
    });

    return header + rows.join('\n');
  }

  // Exportar marcos em CSV
  static async exportMilestonesCsv(caregiverId: number, babyId: number): Promise<string> {
    // Verificar acesso ao bebê
    const hasAccess = await prisma.caregiverBaby.findFirst({
      where: { babyId, caregiverId },
    });

    if (!hasAccess) {
      throw AppError.forbidden('Você não tem acesso a este bebê');
    }

    // Buscar marcos
    const milestones = await prisma.milestone.findMany({
      where: { babyId },
      orderBy: { occurredOn: 'asc' },
    });

    if (milestones.length === 0) {
      throw AppError.notFound('Nenhum marco encontrado');
    }

    // Gerar CSV
    const header = 'Marco,Data,Observacoes\n';
    
    const rows = milestones.map(m => {
      return [
        m.milestoneLabel.replace(/,/g, ';'),
        m.occurredOn ? formatDateBR(m.occurredOn) : 'Não informada',
        (m.notes || '').replace(/,/g, ';').replace(/\n/g, ' '),
      ].join(',');
    });

    return header + rows.join('\n');
  }

  // Exportar relatório completo do bebê em CSV
  static async exportFullReport(caregiverId: number, babyId: number, startDate?: Date, endDate?: Date): Promise<string> {
    // Verificar acesso ao bebê
    const baby = await prisma.baby.findFirst({
      where: {
        id: babyId,
        caregivers: {
          some: { caregiverId },
        },
      },
    });

    if (!baby) {
      throw AppError.forbidden('Você não tem acesso a este bebê');
    }

    let csv = '';

    // Header com informações do bebê
    csv += '=== RELATORIO OLIVE BABY ===\n';
    csv += `Bebe: ${baby.name}\n`;
    csv += `Data de Nascimento: ${formatDateBR(baby.birthDate)}\n`;
    csv += `Exportado em: ${formatDateBR(new Date())} as ${formatTimeBR(new Date())}\n`;
    csv += '\n';

    // Filtros de data
    const dateFilter: any = {};
    if (startDate || endDate) {
      if (startDate) dateFilter.gte = startDate;
      if (endDate) dateFilter.lte = endDate;
    }

    // Resumo de rotinas
    csv += '=== RESUMO DE ROTINAS ===\n';
    
    const routineCounts = await prisma.routineLog.groupBy({
      by: ['routineType'],
      where: {
        babyId,
        ...(Object.keys(dateFilter).length > 0 && { startTime: dateFilter }),
      },
      _count: true,
    });

    const typeLabels: Record<RoutineType, string> = {
      FEEDING: 'Alimentacao',
      SLEEP: 'Sono',
      DIAPER: 'Fralda',
      BATH: 'Banho',
      MILK_EXTRACTION: 'Extracao de Leite',
    };

    for (const count of routineCounts) {
      csv += `${typeLabels[count.routineType]}: ${count._count} registros\n`;
    }
    csv += '\n';

    // Rotinas detalhadas
    csv += '=== ROTINAS DETALHADAS ===\n';
    csv += 'Data,Hora Inicio,Hora Fim,Tipo,Duracao (min),Detalhes,Observacoes\n';

    const routines = await prisma.routineLog.findMany({
      where: {
        babyId,
        ...(Object.keys(dateFilter).length > 0 && { startTime: dateFilter }),
      },
      orderBy: { startTime: 'asc' },
    });

    for (const r of routines) {
      const meta = r.meta as Record<string, any> || {};
      let details = '';
      
      if (r.routineType === 'FEEDING' && meta.feedingType) {
        details = meta.feedingType;
        if (meta.breastSide) details += ` (${meta.breastSide})`;
        if (meta.bottleMl) details += ` ${meta.bottleMl}ml`;
      } else if (r.routineType === 'DIAPER' && meta.diaperType) {
        details = meta.diaperType;
      } else if (r.routineType === 'MILK_EXTRACTION' && meta.extractionMl) {
        details = `${meta.extractionMl}ml`;
      }

      csv += [
        formatDateBR(r.startTime),
        formatTimeBR(r.startTime),
        r.endTime ? formatTimeBR(r.endTime) : '-',
        typeLabels[r.routineType],
        r.durationSeconds ? Math.round(r.durationSeconds / 60).toString() : '-',
        details.replace(/,/g, ';'),
        (r.notes || '').replace(/,/g, ';').replace(/\n/g, ' '),
      ].join(',') + '\n';
    }
    csv += '\n';

    // Crescimento
    csv += '=== CRESCIMENTO ===\n';
    csv += 'Data,Peso (kg),Altura (cm),Perimetro Cefalico (cm),Fonte,Observacoes\n';

    const growthRecords = await prisma.growth.findMany({
      where: {
        babyId,
        ...(Object.keys(dateFilter).length > 0 && { measuredAt: dateFilter }),
      },
      orderBy: { measuredAt: 'asc' },
    });

    for (const g of growthRecords) {
      csv += [
        formatDateBR(g.measuredAt),
        g.weightKg ? Number(g.weightKg).toFixed(2) : '',
        g.heightCm ? Number(g.heightCm).toFixed(2) : '',
        g.headCircumferenceCm ? Number(g.headCircumferenceCm).toFixed(2) : '',
        g.source || '',
        (g.notes || '').replace(/,/g, ';').replace(/\n/g, ' '),
      ].join(',') + '\n';
    }
    csv += '\n';

    // Marcos
    csv += '=== MARCOS DE DESENVOLVIMENTO ===\n';
    csv += 'Marco,Data,Observacoes\n';

    const milestones = await prisma.milestone.findMany({
      where: { babyId },
      orderBy: { occurredOn: 'asc' },
    });

    for (const m of milestones) {
      csv += [
        m.milestoneLabel.replace(/,/g, ';'),
        m.occurredOn ? formatDateBR(m.occurredOn) : 'Nao informada',
        (m.notes || '').replace(/,/g, ';').replace(/\n/g, ' '),
      ].join(',') + '\n';
    }

    return csv;
  }
}

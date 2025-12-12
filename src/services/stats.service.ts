// Olive Baby API - Stats Service
import { prisma } from '../config/database';
import { AppError } from '../utils/errors/AppError';
import { RoutineType } from '@prisma/client';
import { BabyStats, FeedingMeta, DiaperMeta, MilkExtractionMeta } from '../types';
import { getDateRange, get24hRange } from '../utils/helpers/date.helper';

export class StatsService {
  static async getStats(caregiverId: number, babyId: number, days: number = 7): Promise<BabyStats> {
    // Verificar acesso ao bebê
    const hasAccess = await prisma.caregiverBaby.findFirst({
      where: { babyId, caregiverId },
    });

    if (!hasAccess) {
      throw AppError.forbidden('Você não tem acesso a este bebê');
    }

    const { start, end } = getDateRange(days);
    const { start: start24h, end: end24h } = get24hRange();

    // Buscar todas as rotinas do período
    const routines = await prisma.routineLog.findMany({
      where: {
        babyId,
        startTime: {
          gte: start,
          lte: end,
        },
      },
      orderBy: { startTime: 'asc' },
    });

    // Rotinas das últimas 24h
    const routines24h = routines.filter(
      r => r.startTime >= start24h && r.startTime <= end24h
    );

    // Gerar labels de datas para gráficos
    const labels = this.generateDateLabels(start, days);
    const hourlyLabels = Array.from({ length: 24 }, (_, i) => i);

    // Calcular totais de complemento
    const complementMlPerDay = this.calculateComplementMlPerDay(routines, start, days);
    const totalComplementMlRange = complementMlPerDay.reduce((sum, ml) => sum + ml, 0);
    
    // Contar mamadas com complemento nas 24h
    const complementFeeds24h = routines24h.filter(r => {
      if (r.routineType !== 'FEEDING' || !r.meta) return false;
      const meta = r.meta as FeedingMeta;
      return (meta.complementMl || 0) > 0;
    }).length;

    // Calcular estatísticas
    const stats: BabyStats = {
      period: { start, end },
      
      // Labels para gráficos
      labels,
      hourlyLabels,

      // Sono
      totalSleepHours24h: this.calculateSleepHours(routines24h),
      averageSleepPerDay: this.calculateAverageSleepPerDay(routines, days),
      sleepHoursPerDay: this.calculateSleepPerDay(routines, start, days),

      // Alimentação
      totalFeedingMinutes24h: this.calculateFeedingMinutes(routines24h),
      feedingCount24h: routines24h.filter(r => r.routineType === 'FEEDING').length,
      feedingCountsPerDay: this.calculateCountsPerDay(routines, 'FEEDING', start, days),
      feedingMinutesPerDay: this.calculateFeedingMinutesPerDay(routines, start, days),
      breastSideDistribution: this.calculateBreastSideDistribution(routines24h),

      // Complemento
      totalComplementMl24h: this.calculateComplementMl(routines24h),
      totalComplementMlRange,
      complementMlPerDay,
      complementFeeds24h,

      // Mamadeira
      totalBottleMl24h: this.calculateBottleMl(routines24h),
      bottleMlPerDay: this.calculateBottleMlPerDay(routines, start, days),

      // Extração
      totalExtractionMl24h: this.calculateExtractionMl(routines24h),
      extractionMlPerDay: this.calculateExtractionMlPerDay(routines, start, days),

      // Fraldas
      totalDiaper24h: routines24h.filter(r => r.routineType === 'DIAPER').length,
      diaperCountsPerDay: this.calculateCountsPerDay(routines, 'DIAPER', start, days),

      // Atividade por hora
      hourlyCounts: this.calculateHourlyCounts(routines24h),
    };

    return stats;
  }

  /**
   * Gera labels de datas formatadas para gráficos
   */
  private static generateDateLabels(startDate: Date, days: number): string[] {
    const labels: string[] = [];
    
    for (let i = 0; i < days; i++) {
      const date = new Date(startDate);
      date.setDate(date.getDate() + i);
      
      // Formato: "DD/MM" ou "Seg, DD"
      const dayOfWeek = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'][date.getDay()];
      const day = date.getDate().toString().padStart(2, '0');
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      
      labels.push(`${dayOfWeek} ${day}/${month}`);
    }
    
    return labels;
  }

  private static calculateSleepHours(routines: any[]): number {
    const sleepRoutines = routines.filter(r => r.routineType === 'SLEEP' && r.durationSeconds);
    const totalSeconds = sleepRoutines.reduce((sum, r) => sum + (r.durationSeconds || 0), 0);
    return Math.round((totalSeconds / 3600) * 10) / 10; // 1 casa decimal
  }

  private static calculateAverageSleepPerDay(routines: any[], days: number): number {
    const totalHours = this.calculateSleepHours(routines);
    return Math.round((totalHours / days) * 10) / 10;
  }

  private static calculateSleepPerDay(routines: any[], startDate: Date, days: number): number[] {
    const result: number[] = [];
    
    for (let i = 0; i < days; i++) {
      const dayStart = new Date(startDate);
      dayStart.setDate(dayStart.getDate() + i);
      dayStart.setHours(0, 0, 0, 0);
      
      const dayEnd = new Date(dayStart);
      dayEnd.setHours(23, 59, 59, 999);

      const dayRoutines = routines.filter(
        r => r.routineType === 'SLEEP' && 
             r.startTime >= dayStart && 
             r.startTime <= dayEnd &&
             r.durationSeconds
      );

      const totalSeconds = dayRoutines.reduce((sum, r) => sum + (r.durationSeconds || 0), 0);
      result.push(Math.round((totalSeconds / 3600) * 10) / 10);
    }

    return result;
  }

  private static calculateFeedingMinutes(routines: any[]): number {
    const feedingRoutines = routines.filter(r => r.routineType === 'FEEDING' && r.durationSeconds);
    const totalSeconds = feedingRoutines.reduce((sum, r) => sum + (r.durationSeconds || 0), 0);
    return Math.round(totalSeconds / 60);
  }

  private static calculateFeedingMinutesPerDay(routines: any[], startDate: Date, days: number): number[] {
    const result: number[] = [];
    
    for (let i = 0; i < days; i++) {
      const dayStart = new Date(startDate);
      dayStart.setDate(dayStart.getDate() + i);
      dayStart.setHours(0, 0, 0, 0);
      
      const dayEnd = new Date(dayStart);
      dayEnd.setHours(23, 59, 59, 999);

      const dayRoutines = routines.filter(
        r => r.routineType === 'FEEDING' && 
             r.startTime >= dayStart && 
             r.startTime <= dayEnd &&
             r.durationSeconds
      );

      const totalSeconds = dayRoutines.reduce((sum, r) => sum + (r.durationSeconds || 0), 0);
      result.push(Math.round(totalSeconds / 60));
    }

    return result;
  }

  private static calculateCountsPerDay(routines: any[], type: RoutineType, startDate: Date, days: number): number[] {
    const result: number[] = [];
    
    for (let i = 0; i < days; i++) {
      const dayStart = new Date(startDate);
      dayStart.setDate(dayStart.getDate() + i);
      dayStart.setHours(0, 0, 0, 0);
      
      const dayEnd = new Date(dayStart);
      dayEnd.setHours(23, 59, 59, 999);

      const count = routines.filter(
        r => r.routineType === type && 
             r.startTime >= dayStart && 
             r.startTime <= dayEnd
      ).length;

      result.push(count);
    }

    return result;
  }

  private static calculateBreastSideDistribution(routines: any[]): { left: number; right: number; both: number } {
    const feedingRoutines = routines.filter(r => r.routineType === 'FEEDING' && r.meta);
    const distribution = { left: 0, right: 0, both: 0 };

    for (const routine of feedingRoutines) {
      const meta = routine.meta as FeedingMeta;
      if (meta.breastSide === 'left') distribution.left++;
      else if (meta.breastSide === 'right') distribution.right++;
      else if (meta.breastSide === 'both') distribution.both++;
    }

    return distribution;
  }

  private static calculateComplementMl(routines: any[]): number {
    const feedingRoutines = routines.filter(r => r.routineType === 'FEEDING' && r.meta);
    return feedingRoutines.reduce((sum, r) => {
      const meta = r.meta as FeedingMeta;
      return sum + (meta.complementMl || 0);
    }, 0);
  }

  private static calculateComplementMlPerDay(routines: any[], startDate: Date, days: number): number[] {
    const result: number[] = [];
    
    for (let i = 0; i < days; i++) {
      const dayStart = new Date(startDate);
      dayStart.setDate(dayStart.getDate() + i);
      dayStart.setHours(0, 0, 0, 0);
      
      const dayEnd = new Date(dayStart);
      dayEnd.setHours(23, 59, 59, 999);

      const dayRoutines = routines.filter(
        r => r.routineType === 'FEEDING' && 
             r.startTime >= dayStart && 
             r.startTime <= dayEnd &&
             r.meta
      );

      const totalMl = dayRoutines.reduce((sum, r) => {
        const meta = r.meta as FeedingMeta;
        return sum + (meta.complementMl || 0);
      }, 0);

      result.push(totalMl);
    }

    return result;
  }

  private static calculateBottleMl(routines: any[]): number {
    const feedingRoutines = routines.filter(r => r.routineType === 'FEEDING' && r.meta);
    return feedingRoutines.reduce((sum, r) => {
      const meta = r.meta as FeedingMeta;
      return sum + (meta.bottleMl || 0);
    }, 0);
  }

  private static calculateBottleMlPerDay(routines: any[], startDate: Date, days: number): number[] {
    const result: number[] = [];
    
    for (let i = 0; i < days; i++) {
      const dayStart = new Date(startDate);
      dayStart.setDate(dayStart.getDate() + i);
      dayStart.setHours(0, 0, 0, 0);
      
      const dayEnd = new Date(dayStart);
      dayEnd.setHours(23, 59, 59, 999);

      const dayRoutines = routines.filter(
        r => r.routineType === 'FEEDING' && 
             r.startTime >= dayStart && 
             r.startTime <= dayEnd &&
             r.meta
      );

      const totalMl = dayRoutines.reduce((sum, r) => {
        const meta = r.meta as FeedingMeta;
        return sum + (meta.bottleMl || 0);
      }, 0);

      result.push(totalMl);
    }

    return result;
  }

  private static calculateExtractionMl(routines: any[]): number {
    const extractionRoutines = routines.filter(r => r.routineType === 'MILK_EXTRACTION' && r.meta);
    return extractionRoutines.reduce((sum, r) => {
      const meta = r.meta as MilkExtractionMeta;
      return sum + (meta.extractionMl || 0);
    }, 0);
  }

  private static calculateExtractionMlPerDay(routines: any[], startDate: Date, days: number): number[] {
    const result: number[] = [];
    
    for (let i = 0; i < days; i++) {
      const dayStart = new Date(startDate);
      dayStart.setDate(dayStart.getDate() + i);
      dayStart.setHours(0, 0, 0, 0);
      
      const dayEnd = new Date(dayStart);
      dayEnd.setHours(23, 59, 59, 999);

      const dayRoutines = routines.filter(
        r => r.routineType === 'MILK_EXTRACTION' && 
             r.startTime >= dayStart && 
             r.startTime <= dayEnd &&
             r.meta
      );

      const totalMl = dayRoutines.reduce((sum, r) => {
        const meta = r.meta as MilkExtractionMeta;
        return sum + (meta.extractionMl || 0);
      }, 0);

      result.push(totalMl);
    }

    return result;
  }

  private static calculateHourlyCounts(routines: any[]): number[] {
    const counts = new Array(24).fill(0);

    for (const routine of routines) {
      const hour = routine.startTime.getHours();
      counts[hour]++;
    }

    return counts;
  }
}

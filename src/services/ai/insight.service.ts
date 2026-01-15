// Olive Baby API - AI Insight Engine Service
import { prisma } from '../../config/database';
import { logger } from '../../config/logger';
import { StatsService } from '../stats.service';
import { AiInsight, AiInsightSeverity, AiInsightType } from '../../types';
import { differenceInHours, differenceInMonths, subHours } from 'date-fns';

interface InsightRule {
  type: AiInsightType;
  check: (data: InsightData) => InsightResult | null;
}

interface InsightData {
  babyAgeMonths: number;
  stats24h: any;
  stats7d: any;
  lastRoutines: any[];
  lastGrowth: any;
}

interface InsightResult {
  severity: AiInsightSeverity;
  title: string;
  explanation: string;
  recommendation?: string;
  data?: Record<string, unknown>;
}

export class AIInsightService {
  private rules: InsightRule[] = [];

  constructor() {
    this.initializeRules();
  }

  /**
   * Gera insights para um bebê com base nos dados recentes
   */
  async generateInsights(caregiverId: number, babyId: number): Promise<AiInsight[]> {
    try {
      // Get baby info
      const baby = await prisma.baby.findUnique({
        where: { id: babyId },
      });

      if (!baby) {
        return [];
      }

      const babyAgeMonths = differenceInMonths(new Date(), new Date(baby.birthDate));

      // Get stats
      const [stats24h, stats7d] = await Promise.all([
        StatsService.getStats(caregiverId, babyId, 1),
        StatsService.getStats(caregiverId, babyId, 7),
      ]);

      // Get recent routines
      const lastRoutines = await prisma.routineLog.findMany({
        where: { babyId },
        orderBy: { startTime: 'desc' },
        take: 50,
      });

      // Get latest growth
      const lastGrowth = await prisma.growth.findFirst({
        where: { babyId },
        orderBy: { measuredAt: 'desc' },
      });

      const insightData: InsightData = {
        babyAgeMonths,
        stats24h,
        stats7d,
        lastRoutines,
        lastGrowth,
      };

      // Run all rules
      const newInsights: InsightResult[] = [];
      for (const rule of this.rules) {
        try {
          const result = rule.check(insightData);
          if (result) {
            newInsights.push({ ...result, type: rule.type } as any);
          }
        } catch (error) {
          logger.error(`Insight rule ${rule.type} error:`, error);
        }
      }

      // Save new insights (avoid duplicates)
      const savedInsights: AiInsight[] = [];
      const now = new Date();

      for (const insight of newInsights) {
        // Check if similar insight already exists recently
        const existing = await prisma.aiInsight.findFirst({
          where: {
            babyId,
            type: (insight as any).type,
            isDismissed: false,
            createdAt: {
              gte: subHours(now, 24), // Only check last 24h
            },
          },
        });

        if (!existing) {
          const saved = await prisma.aiInsight.create({
            data: {
              babyId,
              type: (insight as any).type,
              severity: insight.severity,
              title: insight.title,
              explanation: insight.explanation,
              recommendation: insight.recommendation,
              data: insight.data as any,
              validUntil: new Date(now.getTime() + 24 * 60 * 60 * 1000), // Valid for 24h
            },
          });
          savedInsights.push(saved as AiInsight);
        }
      }

      return savedInsights;
    } catch (error) {
      logger.error('Failed to generate insights:', error);
      return [];
    }
  }

  /**
   * Lista insights ativos para um bebê
   */
  async getInsights(
    caregiverId: number,
    babyId: number,
    options?: { includeRead?: boolean; includeDismissed?: boolean }
  ): Promise<AiInsight[]> {
    // Verify access
    const hasAccess = await prisma.caregiverBaby.findFirst({
      where: { caregiverId, babyId },
    });

    if (!hasAccess) {
      return [];
    }

    const where: any = {
      babyId,
      OR: [
        { validUntil: null },
        { validUntil: { gte: new Date() } },
      ],
    };

    if (!options?.includeRead) {
      where.isRead = false;
    }

    if (!options?.includeDismissed) {
      where.isDismissed = false;
    }

    const insights = await prisma.aiInsight.findMany({
      where,
      orderBy: [
        { severity: 'desc' },
        { createdAt: 'desc' },
      ],
    });

    return insights as AiInsight[];
  }

  /**
   * Marca insight como lido
   */
  async markAsRead(insightId: number): Promise<void> {
    await prisma.aiInsight.update({
      where: { id: insightId },
      data: { isRead: true },
    });
  }

  /**
   * Descarta um insight
   */
  async dismissInsight(insightId: number): Promise<void> {
    await prisma.aiInsight.update({
      where: { id: insightId },
      data: { isDismissed: true },
    });
  }

  // ==========================================
  // Insight Rules
  // ==========================================

  private initializeRules() {
    // Rule: Sleep too short for age
    this.rules.push({
      type: 'sleep_pattern',
      check: (data) => {
        const { babyAgeMonths, stats24h } = data;
        const sleepHours = stats24h.totalSleepHours24h;

        // Expected sleep by age (approximate)
        const expectedSleep: Record<number, { min: number; max: number }> = {
          0: { min: 14, max: 17 }, // Newborn
          1: { min: 14, max: 17 },
          2: { min: 14, max: 17 },
          3: { min: 14, max: 16 },
          4: { min: 12, max: 15 },
          6: { min: 12, max: 15 },
          9: { min: 12, max: 14 },
          12: { min: 11, max: 14 },
        };

        const ageKey = Object.keys(expectedSleep)
          .map(Number)
          .filter(k => k <= babyAgeMonths)
          .pop() || 0;

        const expected = expectedSleep[ageKey];

        if (sleepHours < expected.min - 2) {
          return {
            severity: 'warning' as AiInsightSeverity,
            title: 'Sono abaixo do esperado',
            explanation: `${data.stats24h.baby?.name || 'O bebê'} dormiu ${sleepHours.toFixed(1)}h nas últimas 24h. Para a idade, o esperado é entre ${expected.min}h e ${expected.max}h.`,
            recommendation: 'Observe se há sinais de cansaço e tente criar uma rotina de sono mais consistente. Se persistir, vale conversar com o pediatra.',
            data: { sleepHours, expectedMin: expected.min, expectedMax: expected.max },
          };
        }

        return null;
      },
    });

    // Rule: Cluster feeding detection
    this.rules.push({
      type: 'cluster_feeding',
      check: (data) => {
        const { lastRoutines } = data;
        const feedings = lastRoutines
          .filter(r => r.routineType === 'FEEDING')
          .slice(0, 10);

        if (feedings.length < 4) return null;

        // Check if 4+ feedings in 3 hours
        const now = new Date();
        const threeHoursAgo = subHours(now, 3);
        const recentFeedings = feedings.filter(
          f => new Date(f.startTime) >= threeHoursAgo
        );

        if (recentFeedings.length >= 4) {
          return {
            severity: 'info' as AiInsightSeverity,
            title: 'Mamadas em cluster detectadas',
            explanation: `${recentFeedings.length} mamadas nas últimas 3 horas. Mamadas em cluster são comuns, especialmente à noite e em picos de crescimento.`,
            recommendation: 'Isso é normal! O bebê pode estar passando por um salto de desenvolvimento ou se preparando para um período maior de sono.',
            data: { feedingCount: recentFeedings.length, periodHours: 3 },
          };
        }

        return null;
      },
    });

    // Rule: Low diaper output alert
    this.rules.push({
      type: 'diaper_alert',
      check: (data) => {
        const { babyAgeMonths, stats24h, lastRoutines } = data;
        const diaperCount = stats24h.totalDiaper24h;

        // Babies should have at least 6 wet diapers per day
        if (diaperCount < 4 && babyAgeMonths < 6) {
          // Check when was the last wet diaper
          const lastWetDiaper = lastRoutines.find(
            r => r.routineType === 'DIAPER' && 
                 (r.meta?.diaperType === 'pee' || r.meta?.diaperType === 'both')
          );

          const hoursSinceLastWet = lastWetDiaper
            ? differenceInHours(new Date(), new Date(lastWetDiaper.startTime))
            : 24;

          if (hoursSinceLastWet > 8) {
            return {
              severity: 'alert' as AiInsightSeverity,
              title: '⚠️ Poucas fraldas molhadas',
              explanation: `Apenas ${diaperCount} fraldas registradas nas últimas 24h e faz ${hoursSinceLastWet}h desde a última fralda molhada.`,
              recommendation: '**Importante**: Isso pode indicar desidratação. Vale entrar em contato com o pediatra para avaliação.',
              data: { diaperCount, hoursSinceLastWet },
            };
          }
        }

        return null;
      },
    });

    // Rule: Breast side imbalance
    this.rules.push({
      type: 'breast_distribution',
      check: (data) => {
        const { stats24h } = data;
        const dist = stats24h.breastSideDistribution;

        if (!dist || (dist.left + dist.right + dist.both) < 4) return null;

        const total = dist.left + dist.right;
        if (total === 0) return null;

        const leftPercent = (dist.left / total) * 100;
        const rightPercent = (dist.right / total) * 100;

        if (Math.abs(leftPercent - rightPercent) > 40) {
          const preferredSide = leftPercent > rightPercent ? 'esquerdo' : 'direito';
          const otherSide = leftPercent > rightPercent ? 'direito' : 'esquerdo';

          return {
            severity: 'info' as AiInsightSeverity,
            title: 'Preferência de seio detectada',
            explanation: `O bebê está mamando mais no seio ${preferredSide}. Distribuição: ${dist.left} esq / ${dist.right} dir.`,
            recommendation: `Tente iniciar as mamadas pelo seio ${otherSide} para equilibrar. Alternar ajuda na produção de leite e no conforto.`,
            data: { left: dist.left, right: dist.right, both: dist.both },
          };
        }

        return null;
      },
    });

    // Rule: No feeding in too long
    this.rules.push({
      type: 'feeding_pattern',
      check: (data) => {
        const { babyAgeMonths, lastRoutines } = data;
        
        if (babyAgeMonths > 6) return null; // Less critical for older babies

        const lastFeeding = lastRoutines.find(r => r.routineType === 'FEEDING');
        if (!lastFeeding) return null;

        const hoursSinceLastFeeding = differenceInHours(
          new Date(),
          new Date(lastFeeding.startTime)
        );

        // Newborns shouldn't go more than 3-4 hours without feeding
        const maxHours = babyAgeMonths < 1 ? 4 : babyAgeMonths < 3 ? 5 : 6;

        if (hoursSinceLastFeeding > maxHours) {
          return {
            severity: babyAgeMonths < 1 ? 'warning' : 'info' as AiInsightSeverity,
            title: 'Intervalo longo sem mamada',
            explanation: `Faz ${hoursSinceLastFeeding}h desde a última mamada registrada.`,
            recommendation: babyAgeMonths < 1
              ? 'Para recém-nascidos, é importante oferecer o seio com frequência. Se o bebê está dormindo muito, pode ser necessário acordá-lo.'
              : 'Observe se o bebê está mostrando sinais de fome.',
            data: { hoursSinceLastFeeding, maxHours },
          };
        }

        return null;
      },
    });
  }
}

// Singleton instance
export const aiInsightService = new AIInsightService();

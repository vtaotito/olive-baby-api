// Olive Baby API - Admin Analytics Service
// Advanced analytics: Funnel, Cohorts, Upgrade Candidates, Data Quality
import { PrismaClient, AuditAction } from '@prisma/client';

const prisma = new PrismaClient();

// ==========================================
// Types
// ==========================================

export interface ActivationFunnel {
  registered: number;
  createdBaby: number;
  createdFirstRoutine: number;
  created3RoutinesIn24h: number;
  used2RoutineTypesIn7d: number;
}

export interface CohortData {
  cohortStartDate: string;
  cohortEndDate: string;
  usersInCohort: number;
  d1Retention: number;
  d7Retention: number;
  d30Retention: number;
}

export interface PaywallAnalytics {
  hitsByFeature: Record<string, number>;
  hitsTimeline: Array<{ date: string; count: number }>;
  conversionByFeature: Record<string, { hits: number; conversions: number; rate: number }>;
}

export interface UpgradeCandidate {
  userId: number;
  name: string;
  email: string;
  score: number;
  reasons: string[];
  lastActivityAt: string | null;
  babiesCount: number;
  routinesCountRange: number;
  paywallHitsRange: number;
}

export interface DataQualityReport {
  routineType: string;
  totalRoutines: number;
  withMeta: number;
  withoutMeta: number;
  metaCompleteness: number; // percentage
  missingFields: Array<{ field: string; missingCount: number; percentage: number }>;
}

// ==========================================
// Admin Analytics Service
// ==========================================

export class AdminAnalyticsService {
  /**
   * Get activation funnel metrics
   */
  static async getActivationFunnel(range: '7d' | '30d' = '30d'): Promise<ActivationFunnel> {
    const days = range === '7d' ? 7 : 30;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Users registered in range
    const registered = await prisma.user.count({
      where: { createdAt: { gte: startDate } },
    });

    // Users who created at least 1 baby (via BabyMember)
    const usersWithBaby = await prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(DISTINCT u.id) as count
      FROM users u
      INNER JOIN baby_members bm ON bm.user_id = u.id
      WHERE u.created_at >= ${startDate}
        AND bm.status = 'ACTIVE'
    `;
    const createdBaby = Number(usersWithBaby[0]?.count || 0);

    // Users who created at least 1 routine
    const usersWithRoutine = await prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(DISTINCT cb.caregiver_id) as count
      FROM routine_logs rl
      INNER JOIN caregiver_babies cb ON cb.baby_id = rl.baby_id
      INNER JOIN caregivers c ON c.id = cb.caregiver_id
      INNER JOIN users u ON u.id = c.user_id
      WHERE u.created_at >= ${startDate}
    `;
    const createdFirstRoutine = Number(usersWithRoutine[0]?.count || 0);

    // Users who created 3+ routines in first 24h after registration
    const users3RoutinesIn24h = await prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*) as count FROM (
        SELECT c.user_id
        FROM routine_logs rl
        INNER JOIN caregiver_babies cb ON cb.baby_id = rl.baby_id
        INNER JOIN caregivers c ON c.id = cb.caregiver_id
        INNER JOIN users u ON u.id = c.user_id
        WHERE u.created_at >= ${startDate}
          AND rl.created_at <= u.created_at + INTERVAL '24 hours'
        GROUP BY c.user_id
        HAVING COUNT(rl.id) >= 3
      ) t
    `;
    const created3RoutinesIn24h = Number(users3RoutinesIn24h[0]?.count || 0);

    // Users who used 2+ different routine types in first 7 days
    const users2TypesIn7d = await prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*) as count FROM (
        SELECT c.user_id
        FROM routine_logs rl
        INNER JOIN caregiver_babies cb ON cb.baby_id = rl.baby_id
        INNER JOIN caregivers c ON c.id = cb.caregiver_id
        INNER JOIN users u ON u.id = c.user_id
        WHERE u.created_at >= ${startDate}
          AND rl.created_at <= u.created_at + INTERVAL '7 days'
        GROUP BY c.user_id
        HAVING COUNT(DISTINCT rl.routine_type) >= 2
      ) t
    `;
    const used2RoutineTypesIn7d = Number(users2TypesIn7d[0]?.count || 0);

    return {
      registered,
      createdBaby,
      createdFirstRoutine,
      created3RoutinesIn24h,
      used2RoutineTypesIn7d,
    };
  }

  /**
   * Get cohort retention analysis
   */
  static async getCohorts(unit: 'week' = 'week', lookback: number = 12): Promise<CohortData[]> {
    const cohorts: CohortData[] = [];

    for (let i = 0; i < lookback; i++) {
      const cohortStart = new Date();
      cohortStart.setDate(cohortStart.getDate() - (i + 1) * 7);
      cohortStart.setHours(0, 0, 0, 0);

      const cohortEnd = new Date(cohortStart);
      cohortEnd.setDate(cohortEnd.getDate() + 7);

      // Users in this cohort
      const usersInCohort = await prisma.user.count({
        where: {
          createdAt: { gte: cohortStart, lt: cohortEnd },
        },
      });

      if (usersInCohort === 0) {
        cohorts.push({
          cohortStartDate: cohortStart.toISOString().split('T')[0],
          cohortEndDate: cohortEnd.toISOString().split('T')[0],
          usersInCohort: 0,
          d1Retention: 0,
          d7Retention: 0,
          d30Retention: 0,
        });
        continue;
      }

      // D1 retention (activity within 1-2 days)
      const d1Date = new Date(cohortEnd);
      d1Date.setDate(d1Date.getDate() + 1);
      const d1End = new Date(d1Date);
      d1End.setDate(d1End.getDate() + 1);

      const d1Active = await prisma.$queryRaw<Array<{ count: bigint }>>`
        SELECT COUNT(DISTINCT c.user_id) as count
        FROM routine_logs rl
        INNER JOIN caregiver_babies cb ON cb.baby_id = rl.baby_id
        INNER JOIN caregivers c ON c.id = cb.caregiver_id
        INNER JOIN users u ON u.id = c.user_id
        WHERE u.created_at >= ${cohortStart} AND u.created_at < ${cohortEnd}
          AND rl.created_at >= ${d1Date} AND rl.created_at < ${d1End}
      `;

      // D7 retention
      const d7Date = new Date(cohortEnd);
      d7Date.setDate(d7Date.getDate() + 6);
      const d7End = new Date(d7Date);
      d7End.setDate(d7End.getDate() + 2);

      const d7Active = await prisma.$queryRaw<Array<{ count: bigint }>>`
        SELECT COUNT(DISTINCT c.user_id) as count
        FROM routine_logs rl
        INNER JOIN caregiver_babies cb ON cb.baby_id = rl.baby_id
        INNER JOIN caregivers c ON c.id = cb.caregiver_id
        INNER JOIN users u ON u.id = c.user_id
        WHERE u.created_at >= ${cohortStart} AND u.created_at < ${cohortEnd}
          AND rl.created_at >= ${d7Date} AND rl.created_at < ${d7End}
      `;

      // D30 retention
      const d30Date = new Date(cohortEnd);
      d30Date.setDate(d30Date.getDate() + 29);
      const d30End = new Date(d30Date);
      d30End.setDate(d30End.getDate() + 2);

      const d30Active = await prisma.$queryRaw<Array<{ count: bigint }>>`
        SELECT COUNT(DISTINCT c.user_id) as count
        FROM routine_logs rl
        INNER JOIN caregiver_babies cb ON cb.baby_id = rl.baby_id
        INNER JOIN caregivers c ON c.id = cb.caregiver_id
        INNER JOIN users u ON u.id = c.user_id
        WHERE u.created_at >= ${cohortStart} AND u.created_at < ${cohortEnd}
          AND rl.created_at >= ${d30Date} AND rl.created_at < ${d30End}
      `;

      cohorts.push({
        cohortStartDate: cohortStart.toISOString().split('T')[0],
        cohortEndDate: cohortEnd.toISOString().split('T')[0],
        usersInCohort,
        d1Retention: Math.round((Number(d1Active[0]?.count || 0) / usersInCohort) * 100),
        d7Retention: Math.round((Number(d7Active[0]?.count || 0) / usersInCohort) * 100),
        d30Retention: Math.round((Number(d30Active[0]?.count || 0) / usersInCohort) * 100),
      });
    }

    return cohorts.reverse(); // Oldest first
  }

  /**
   * Get paywall analytics
   */
  static async getPaywallAnalytics(range: '7d' | '30d' = '30d'): Promise<PaywallAnalytics> {
    const days = range === '7d' ? 7 : 30;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Hits by feature
    const paywallEvents = await prisma.auditEvent.findMany({
      where: {
        action: 'PAYWALL_HIT',
        createdAt: { gte: startDate },
      },
      select: { metadata: true, createdAt: true },
    });

    const hitsByFeature: Record<string, number> = {};
    const hitsByDate: Record<string, number> = {};

    for (const event of paywallEvents) {
      const feature = (event.metadata as any)?.feature || 'unknown';
      hitsByFeature[feature] = (hitsByFeature[feature] || 0) + 1;

      const dateKey = event.createdAt.toISOString().split('T')[0];
      hitsByDate[dateKey] = (hitsByDate[dateKey] || 0) + 1;
    }

    // Timeline
    const hitsTimeline = Object.entries(hitsByDate)
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Conversions (users who had paywall hit and then upgraded)
    // This is a simplified version - in production you'd track this more precisely
    const conversionByFeature: Record<string, { hits: number; conversions: number; rate: number }> = {};
    
    for (const [feature, hits] of Object.entries(hitsByFeature)) {
      // Count users who hit paywall for this feature and later upgraded
      const usersWhoHitPaywall = await prisma.auditEvent.findMany({
        where: {
          action: 'PAYWALL_HIT',
          createdAt: { gte: startDate },
          metadata: { path: ['feature'], equals: feature },
        },
        select: { userId: true },
        distinct: ['userId'],
      });

      const userIds = usersWhoHitPaywall.map(e => e.userId).filter(Boolean) as number[];
      
      // Check how many of these users are now premium
      const conversions = userIds.length > 0
        ? await prisma.user.count({
            where: {
              id: { in: userIds },
              plan: { type: 'PREMIUM' },
            },
          })
        : 0;

      conversionByFeature[feature] = {
        hits,
        conversions,
        rate: hits > 0 ? Math.round((conversions / hits) * 100) : 0,
      };
    }

    return {
      hitsByFeature,
      hitsTimeline,
      conversionByFeature,
    };
  }

  /**
   * Get upgrade candidates with lead scoring
   */
  static async getUpgradeCandidates(range: '30d' = '30d'): Promise<UpgradeCandidate[]> {
    const days = 30;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Get free users
    const freePlan = await prisma.plan.findUnique({ where: { type: 'FREE' } });
    if (!freePlan) return [];

    const freeUsers = await prisma.user.findMany({
      where: {
        planId: freePlan.id,
        status: 'ACTIVE',
      },
      include: {
        caregiver: {
          select: { fullName: true },
        },
        babyMembers: {
          where: { status: 'ACTIVE' },
        },
      },
    });

    const candidates: UpgradeCandidate[] = [];

    for (const user of freeUsers) {
      let score = 0;
      const reasons: string[] = [];

      // 1. Paywall hits (high weight - 30 points per hit, max 100)
      const paywallHits = await prisma.auditEvent.count({
        where: {
          userId: user.id,
          action: 'PAYWALL_HIT',
          createdAt: { gte: startDate },
        },
      });
      if (paywallHits > 0) {
        score += Math.min(paywallHits * 30, 100);
        reasons.push(`${paywallHits} paywall hits`);
      }

      // 2. Routines per week (medium weight - 5 points per routine, max 50)
      const routinesCount = await prisma.$queryRaw<Array<{ count: bigint }>>`
        SELECT COUNT(*) as count
        FROM routine_logs rl
        INNER JOIN caregiver_babies cb ON cb.baby_id = rl.baby_id
        INNER JOIN caregivers c ON c.id = cb.caregiver_id
        WHERE c.user_id = ${user.id}
          AND rl.created_at >= ${startDate}
      `;
      const routines = Number(routinesCount[0]?.count || 0);
      if (routines > 0) {
        score += Math.min(routines * 5, 50);
        if (routines >= 10) reasons.push(`${routines} rotinas no período`);
      }

      // 3. Used 3+ routine types (medium weight - 30 points)
      const routineTypes = await prisma.$queryRaw<Array<{ count: bigint }>>`
        SELECT COUNT(DISTINCT rl.routine_type) as count
        FROM routine_logs rl
        INNER JOIN caregiver_babies cb ON cb.baby_id = rl.baby_id
        INNER JOIN caregivers c ON c.id = cb.caregiver_id
        WHERE c.user_id = ${user.id}
          AND rl.created_at >= ${startDate}
      `;
      const typesUsed = Number(routineTypes[0]?.count || 0);
      if (typesUsed >= 3) {
        score += 30;
        reasons.push(`Usa ${typesUsed} tipos de rotinas`);
      }

      // 4. Professionals linked (medium weight - 25 points)
      const professionalsCount = await prisma.$queryRaw<Array<{ count: bigint }>>`
        SELECT COUNT(DISTINCT bp.professional_id) as count
        FROM baby_professionals bp
        INNER JOIN baby_members bm ON bm.baby_id = bp.baby_id
        WHERE bm.user_id = ${user.id}
          AND bm.status = 'ACTIVE'
      `;
      const professionals = Number(professionalsCount[0]?.count || 0);
      if (professionals > 0) {
        score += 25;
        reasons.push(`${professionals} profissional(is) vinculado(s)`);
      }

      // 5. Pending invites (medium weight - 20 points)
      const pendingInvites = await prisma.babyInvite.count({
        where: {
          createdByUserId: user.id,
          status: 'PENDING',
        },
      });
      if (pendingInvites > 0) {
        score += 20;
        reasons.push(`${pendingInvites} convite(s) pendente(s)`);
      }

      // 6. Tried to create 2nd baby (high weight - 40 points)
      // Check audit events for this
      const triedSecondBaby = await prisma.auditEvent.count({
        where: {
          userId: user.id,
          action: 'PAYWALL_HIT',
          metadata: { path: ['feature'], equals: 'maxBabies' },
        },
      });
      if (triedSecondBaby > 0) {
        score += 40;
        reasons.push('Tentou criar 2º bebê');
      }

      // 7. Tried to export (high weight - 35 points)
      const triedExport = await prisma.auditEvent.count({
        where: {
          userId: user.id,
          action: 'PAYWALL_HIT',
          metadata: {
            path: ['feature'],
            string_contains: 'export',
          },
        },
      });
      if (triedExport > 0) {
        score += 35;
        reasons.push('Tentou exportar dados');
      }

      // Only include users with score > 0
      if (score > 0) {
        candidates.push({
          userId: user.id,
          name: user.caregiver?.fullName || user.email.split('@')[0],
          email: user.email,
          score,
          reasons,
          lastActivityAt: user.lastActivityAt?.toISOString() || null,
          babiesCount: user.babyMembers.length,
          routinesCountRange: routines,
          paywallHitsRange: paywallHits,
        });
      }
    }

    // Sort by score descending
    return candidates.sort((a, b) => b.score - a.score).slice(0, 50);
  }

  /**
   * Get data quality report
   */
  static async getDataQuality(range: '30d' = '30d'): Promise<DataQualityReport[]> {
    const days = 30;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const routineTypes = ['FEEDING', 'SLEEP', 'DIAPER', 'BATH', 'MILK_EXTRACTION'];
    const reports: DataQualityReport[] = [];

    // Define expected meta fields per routine type
    const expectedFields: Record<string, string[]> = {
      FEEDING: ['feedingType', 'breastSide', 'bottleMl', 'formulaBrand'],
      SLEEP: ['sleepQuality', 'location', 'wokeUpCount'],
      DIAPER: ['diaperType', 'consistency'],
      BATH: ['bathType', 'waterTemperature'],
      MILK_EXTRACTION: ['extractionMethod', 'volumeMl', 'side'],
    };

    for (const type of routineTypes) {
      const routines = await prisma.routineLog.findMany({
        where: {
          routineType: type as any,
          createdAt: { gte: startDate },
        },
        select: { meta: true },
      });

      const totalRoutines = routines.length;
      let withMeta = 0;
      const fieldCounts: Record<string, number> = {};
      const fields = expectedFields[type] || [];

      for (const field of fields) {
        fieldCounts[field] = 0;
      }

      for (const routine of routines) {
        const meta = routine.meta as Record<string, unknown> | null;
        if (meta && Object.keys(meta).length > 0) {
          withMeta++;
          for (const field of fields) {
            if (meta[field] !== undefined && meta[field] !== null && meta[field] !== '') {
              fieldCounts[field]++;
            }
          }
        }
      }

      const missingFields = fields
        .map(field => ({
          field,
          missingCount: totalRoutines - fieldCounts[field],
          percentage: totalRoutines > 0 
            ? Math.round(((totalRoutines - fieldCounts[field]) / totalRoutines) * 100)
            : 0,
        }))
        .filter(f => f.missingCount > 0)
        .sort((a, b) => b.missingCount - a.missingCount);

      reports.push({
        routineType: type,
        totalRoutines,
        withMeta,
        withoutMeta: totalRoutines - withMeta,
        metaCompleteness: totalRoutines > 0 ? Math.round((withMeta / totalRoutines) * 100) : 0,
        missingFields,
      });
    }

    return reports;
  }
}


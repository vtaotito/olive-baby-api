// Olive Baby API - Admin Service
import { PrismaClient, UserRole, UserStatus, PlanType } from '@prisma/client';
import { AppError } from '../utils/errors/AppError';
import { AuditService } from '../core/entitlements';

const prisma = new PrismaClient();

// ==========================================
// Types
// ==========================================

export interface AdminMetrics {
  totalUsers: number;
  totalBabies: number;
  usersActive: number;
  routinesCount: number;
  routinesByType: Record<string, number>;
  freeUsers: number;
  premiumUsers: number;
  topUsersByRoutines: Array<{
    userId: number;
    email: string;
    fullName: string;
    routineCount: number;
  }>;
  paywallHits?: Record<string, number>;
}

export interface AdminUserFilters {
  query?: string;
  plan?: PlanType;
  role?: UserRole;
  status?: UserStatus;
  page?: number;
  limit?: number;
}

export interface AdminBabyFilters {
  query?: string;
  state?: string;
  page?: number;
  limit?: number;
}

// ==========================================
// Admin Service
// ==========================================

export class AdminService {
  /**
   * Get admin metrics for dashboard
   */
  static async getMetrics(range: '7d' | '30d' = '7d'): Promise<AdminMetrics> {
    const days = range === '7d' ? 7 : 30;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Total users
    const totalUsers = await prisma.user.count();

    // Total babies
    const totalBabies = await prisma.baby.count();

    // Active users (users with routines in range)
    const activeUserIds = await prisma.routineLog.findMany({
      where: {
        createdAt: { gte: startDate },
      },
      select: {
        baby: {
          select: {
            caregivers: {
              where: { isPrimary: true },
              select: { caregiver: { select: { userId: true } } },
            },
          },
        },
      },
      distinct: ['babyId'],
    });

    const uniqueActiveUserIds = new Set(
      activeUserIds.flatMap(r => 
        r.baby.caregivers.map(c => c.caregiver.userId)
      )
    );
    const usersActive = uniqueActiveUserIds.size;

    // Routines count in range
    const routinesCount = await prisma.routineLog.count({
      where: {
        createdAt: { gte: startDate },
      },
    });

    // Routines by type
    const routinesByTypeRaw = await prisma.routineLog.groupBy({
      by: ['routineType'],
      where: {
        createdAt: { gte: startDate },
      },
      _count: true,
    });

    const routinesByType: Record<string, number> = {};
    for (const r of routinesByTypeRaw) {
      routinesByType[r.routineType] = r._count;
    }

    // Free vs Premium users
    const freePlan = await prisma.plan.findUnique({ where: { type: 'FREE' } });
    const premiumPlan = await prisma.plan.findUnique({ where: { type: 'PREMIUM' } });

    const freeUsers = freePlan
      ? await prisma.user.count({ where: { planId: freePlan.id } })
      : totalUsers;

    const premiumUsers = premiumPlan
      ? await prisma.user.count({ where: { planId: premiumPlan.id } })
      : 0;

    // Top users by routines
    const topUsersRaw = await prisma.$queryRaw<
      Array<{ user_id: number; email: string; full_name: string; routine_count: bigint }>
    >`
      SELECT 
        u.id as user_id,
        u.email,
        c.full_name,
        COUNT(rl.id) as routine_count
      FROM users u
      INNER JOIN caregivers c ON c.user_id = u.id
      INNER JOIN caregiver_babies cb ON cb.caregiver_id = c.id
      INNER JOIN routine_logs rl ON rl.baby_id = cb.baby_id
      WHERE rl.created_at >= ${startDate}
      GROUP BY u.id, u.email, c.full_name
      ORDER BY routine_count DESC
      LIMIT 10
    `;

    const topUsersByRoutines = topUsersRaw.map(u => ({
      userId: u.user_id,
      email: u.email,
      fullName: u.full_name,
      routineCount: Number(u.routine_count),
    }));

    // Paywall hits (if needed)
    const paywallHits = await AuditService.countPaywallHits(startDate);

    return {
      totalUsers,
      totalBabies,
      usersActive,
      routinesCount,
      routinesByType,
      freeUsers,
      premiumUsers,
      topUsersByRoutines,
      paywallHits,
    };
  }

  /**
   * List users with filters and pagination
   */
  static async listUsers(filters: AdminUserFilters) {
    const page = filters.page || 1;
    const limit = filters.limit || 20;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (filters.query) {
      where.OR = [
        { email: { contains: filters.query, mode: 'insensitive' } },
        { caregiver: { fullName: { contains: filters.query, mode: 'insensitive' } } },
      ];
    }

    if (filters.role) {
      where.role = filters.role;
    }

    if (filters.status) {
      where.status = filters.status;
    }

    if (filters.plan) {
      where.plan = { type: filters.plan };
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        include: {
          caregiver: {
            select: {
              id: true,
              fullName: true,
              phone: true,
              city: true,
              state: true,
              _count: { select: { babies: true } },
            },
          },
          plan: {
            select: {
              name: true,
              type: true,
            },
          },
          _count: {
            select: {
              babyMembers: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.user.count({ where }),
    ]);

    // Mask sensitive data + count babies from both sources
    const sanitizedUsers = users.map(user => {
      const caregiverBabiesCount = user.caregiver?._count?.babies || 0;
      const memberBabiesCount = user._count.babyMembers;
      // Use the larger count (caregiver link is the primary one)
      const totalBabies = Math.max(caregiverBabiesCount, memberBabiesCount);

      return {
        id: user.id,
        email: user.email,
        role: user.role,
        status: user.status,
        isActive: user.isActive,
        lastActivityAt: user.lastActivityAt,
        createdAt: user.createdAt,
        plan: user.plan,
        caregiver: user.caregiver
          ? {
              fullName: user.caregiver.fullName,
              phone: user.caregiver.phone ? `****${user.caregiver.phone.slice(-4)}` : null,
              city: user.caregiver.city,
              state: user.caregiver.state,
            }
          : null,
        babiesCount: totalBabies,
      };
    });

    return {
      data: sanitizedUsers,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * List babies with filters and pagination
   */
  static async listBabies(filters: AdminBabyFilters) {
    const page = filters.page || 1;
    const limit = filters.limit || 20;
    const skip = (page - 1) * limit;

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const where: any = {};

    if (filters.query) {
      where.OR = [
        { name: { contains: filters.query, mode: 'insensitive' } },
        { caregivers: { some: { caregiver: { fullName: { contains: filters.query, mode: 'insensitive' } } } } },
        { caregivers: { some: { caregiver: { user: { email: { contains: filters.query, mode: 'insensitive' } } } } } },
      ];
    }

    if (filters.state) {
      where.state = filters.state;
    }

    const [babies, total] = await Promise.all([
      prisma.baby.findMany({
        where,
        include: {
          caregivers: {
            where: { isPrimary: true },
            include: {
              caregiver: {
                include: {
                  user: {
                    select: {
                      id: true,
                      email: true,
                    },
                  },
                },
              },
            },
          },
          routineLogs: {
            select: { startTime: true },
            orderBy: { startTime: 'desc' },
            take: 1,
          },
          _count: {
            select: {
              caregivers: true,
              professionals: true,
              routineLogs: true,
              growthRecords: true,
              milestones: true,
              vaccineRecords: true,
              clinicalVisits: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.baby.count({ where }),
    ]);

    // Count routines in last 30 days using startTime (accurate date filtering)
    const babyIds = babies.map(b => b.id);
    let routines30dMap: Record<number, number> = {};
    if (babyIds.length > 0) {
      const routines30dResults = await prisma.routineLog.groupBy({
        by: ['babyId'],
        where: {
          babyId: { in: babyIds },
          startTime: { gte: thirtyDaysAgo },
        },
        _count: true,
      });
      routines30dResults.forEach(r => { routines30dMap[r.babyId] = r._count; });
    }

    const sanitizedBabies = babies.map(baby => ({
      id: baby.id,
      name: baby.name,
      birthDate: baby.birthDate,
      gender: baby.gender,
      city: baby.city,
      state: baby.state,
      birthWeightGrams: baby.birthWeightGrams,
      birthLengthCm: baby.birthLengthCm,
      createdAt: baby.createdAt,
      primaryCaregiver: baby.caregivers[0]
        ? {
            id: baby.caregivers[0].caregiver.user.id,
            fullName: baby.caregivers[0].caregiver.fullName,
            email: baby.caregivers[0].caregiver.user.email,
            relationship: baby.caregivers[0].relationship,
          }
        : null,
      caregiversCount: baby._count.caregivers,
      professionalsCount: baby._count.professionals,
      routinesTotal: baby._count.routineLogs,
      routinesCount30d: routines30dMap[baby.id] || 0,
      growthCount: baby._count.growthRecords,
      milestonesCount: baby._count.milestones,
      vaccinesCount: baby._count.vaccineRecords,
      visitsCount: baby._count.clinicalVisits,
      lastActivityAt: baby.routineLogs[0]?.startTime || null,
    }));

    return {
      data: sanitizedBabies,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get baby details with full permission tree for admin
   */
  static async getBabyDetails(babyId: number) {
    const baby = await prisma.baby.findUnique({
      where: { id: babyId },
      include: {
        caregivers: {
          include: {
            caregiver: {
              include: {
                user: { select: { id: true, email: true, role: true, status: true, lastActivityAt: true, createdAt: true } },
              },
            },
          },
          orderBy: { isPrimary: 'desc' },
        },
        members: {
          include: {
            user: { select: { id: true, email: true, role: true, status: true, lastActivityAt: true, createdAt: true } },
          },
          orderBy: { createdAt: 'desc' },
        },
        professionals: {
          include: {
            professional: {
              select: {
                id: true, fullName: true, email: true, specialty: true,
                crmNumber: true, crmState: true, phone: true, status: true, createdAt: true,
                userId: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
        invites: {
          orderBy: { createdAt: 'desc' },
          include: {
            createdBy: { select: { id: true, email: true } },
          },
        },
        growthRecords: {
          orderBy: { measuredAt: 'desc' },
          take: 5,
          select: {
            id: true, measuredAt: true, weightKg: true, heightCm: true,
            headCircumferenceCm: true, source: true, notes: true,
          },
        },
        _count: {
          select: {
            routineLogs: true,
            growthRecords: true,
            milestones: true,
            vaccineRecords: true,
            clinicalVisits: true,
          },
        },
      },
    });

    if (!baby) {
      throw AppError.notFound('Bebê não encontrado');
    }

    // Get routine breakdown by type
    const routineBreakdown = await prisma.routineLog.groupBy({
      by: ['routineType'],
      where: { babyId },
      _count: true,
      _max: { startTime: true },
      _min: { startTime: true },
    });

    // Get last activity
    const lastRoutine = await prisma.routineLog.findFirst({
      where: { babyId },
      orderBy: { startTime: 'desc' },
      select: { startTime: true, routineType: true },
    });

    // Get 30d routine count
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const routines30d = await prisma.routineLog.count({
      where: { babyId, startTime: { gte: thirtyDaysAgo } },
    });

    // Get milestones achieved
    const milestonesAchieved = await prisma.milestone.count({
      where: { babyId, occurredOn: { not: null } },
    });

    return {
      id: baby.id,
      name: baby.name,
      birthDate: baby.birthDate,
      gender: baby.gender,
      city: baby.city,
      state: baby.state,
      country: baby.country,
      birthWeightGrams: baby.birthWeightGrams,
      birthLengthCm: baby.birthLengthCm,
      createdAt: baby.createdAt,
      updatedAt: baby.updatedAt,
      counts: {
        ...baby._count,
        routines30d,
        milestonesAchieved,
      },
      routineBreakdown: routineBreakdown.map(r => ({
        type: r.routineType,
        count: r._count,
        firstAt: r._min.startTime,
        lastAt: r._max.startTime,
      })),
      recentGrowth: baby.growthRecords.map(g => ({
        id: g.id,
        measuredAt: g.measuredAt,
        weightKg: g.weightKg ? Number(g.weightKg) : null,
        heightCm: g.heightCm ? Number(g.heightCm) : null,
        headCircumferenceCm: g.headCircumferenceCm ? Number(g.headCircumferenceCm) : null,
        source: g.source,
        notes: g.notes,
      })),
      lastActivityAt: lastRoutine?.startTime || null,
      lastActivityType: lastRoutine?.routineType || null,
      caregivers: baby.caregivers.map(cb => ({
        id: cb.id,
        relationship: cb.relationship,
        isPrimary: cb.isPrimary,
        createdAt: cb.createdAt,
        caregiver: {
          id: cb.caregiver.id,
          fullName: cb.caregiver.fullName,
          phone: cb.caregiver.phone,
          city: cb.caregiver.city,
          state: cb.caregiver.state,
        },
        user: cb.caregiver.user ? {
          id: cb.caregiver.user.id,
          email: cb.caregiver.user.email,
          role: cb.caregiver.user.role,
          status: cb.caregiver.user.status,
          lastActivityAt: cb.caregiver.user.lastActivityAt,
        } : null,
      })),
      members: baby.members.map(m => ({
        id: m.id,
        memberType: m.memberType,
        role: m.role,
        status: m.status,
        permissions: m.permissions,
        createdAt: m.createdAt,
        revokedAt: m.revokedAt,
        user: {
          id: m.user.id,
          email: m.user.email,
          role: m.user.role,
          status: m.user.status,
          lastActivityAt: m.user.lastActivityAt,
        },
      })),
      professionals: baby.professionals.map(bp => ({
        id: bp.id,
        role: bp.role,
        notes: bp.notes,
        createdAt: bp.createdAt,
        professional: {
          id: bp.professional.id,
          fullName: bp.professional.fullName,
          email: bp.professional.email,
          specialty: bp.professional.specialty,
          crmNumber: bp.professional.crmNumber,
          crmState: bp.professional.crmState,
          phone: bp.professional.phone,
          status: bp.professional.status,
          hasAccount: !!bp.professional.userId,
        },
      })),
      invites: baby.invites.map(inv => ({
        id: inv.id,
        emailInvited: inv.emailInvited,
        memberType: inv.memberType,
        role: inv.role,
        status: inv.status,
        invitedName: inv.invitedName,
        message: inv.message,
        expiresAt: inv.expiresAt,
        createdAt: inv.createdAt,
        acceptedAt: inv.acceptedAt,
        createdBy: inv.createdBy ? { id: inv.createdBy.id, email: inv.createdBy.email } : null,
      })),
    };
  }

  /**
   * Get user details for admin
   */
  static async getUserDetails(userId: number) {
    // Query user without babyMembers to avoid Prisma error with orphaned records
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        caregiver: true,
        professional: true,
        plan: true,
        subscription: true,
      },
    });

    if (!user) {
      throw AppError.notFound('Usuário não encontrado');
    }

    // Query babies from baby_members (sharing system)
    const babyMembers = await prisma.$queryRaw<Array<{
      bm_id: number;
      bm_role: string;
      bm_status: string;
      baby_id: number;
      baby_name: string;
      baby_birth_date: Date;
    }>>`
      SELECT 
        bm.id as bm_id,
        bm.role as bm_role,
        bm.status as bm_status,
        b.id as baby_id,
        b.name as baby_name,
        b.birth_date as baby_birth_date
      FROM baby_members bm
      INNER JOIN babies b ON bm.baby_id = b.id
      WHERE bm.user_id = ${userId}
    `;

    // Query babies from caregiver_babies (primary parent/caregiver link)
    const caregiverBabies = user.caregiver
      ? await prisma.$queryRaw<Array<{
          cb_id: number;
          relationship: string;
          is_primary: boolean;
          baby_id: number;
          baby_name: string;
          baby_birth_date: Date;
        }>>`
          SELECT 
            cb.id as cb_id,
            cb.relationship,
            cb.is_primary,
            b.id as baby_id,
            b.name as baby_name,
            b.birth_date as baby_birth_date
          FROM caregiver_babies cb
          INNER JOIN babies b ON cb.baby_id = b.id
          WHERE cb.caregiver_id = ${user.caregiver.id}
        `
      : [];

    // Combine babies from both sources, avoiding duplicates
    const babyMap = new Map<number, { id: number; name: string; birthDate: Date; role: string; status: string; source: string }>();

    for (const cb of caregiverBabies) {
      babyMap.set(cb.baby_id, {
        id: cb.baby_id,
        name: cb.baby_name,
        birthDate: cb.baby_birth_date,
        role: cb.is_primary ? 'PRIMARY_CAREGIVER' : cb.relationship,
        status: 'ACTIVE',
        source: 'caregiver',
      });
    }

    for (const bm of babyMembers) {
      if (!babyMap.has(bm.baby_id)) {
        babyMap.set(bm.baby_id, {
          id: bm.baby_id,
          name: bm.baby_name,
          birthDate: bm.baby_birth_date,
          role: bm.bm_role,
          status: bm.bm_status,
          source: 'member',
        });
      } else {
        // Baby already from caregiver, add member info
        const existing = babyMap.get(bm.baby_id)!;
        existing.source = 'caregiver+member';
      }
    }

    return {
      id: user.id,
      email: user.email,
      role: user.role,
      status: user.status,
      isActive: user.isActive,
      lastActivityAt: user.lastActivityAt,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      plan: user.plan,
      subscription: user.subscription,
      caregiver: user.caregiver
        ? {
            fullName: user.caregiver.fullName,
            phone: user.caregiver.phone,
            city: user.caregiver.city,
            state: user.caregiver.state,
            cpf: user.caregiver.cpf 
              ? `***.***.${user.caregiver.cpf.slice(-5, -2)}-**`
              : null,
          }
        : null,
      professional: user.professional,
      babies: Array.from(babyMap.values()),
    };
  }

  /**
   * Change user plan (admin action)
   */
  static async changeUserPlan(
    adminUserId: number,
    targetUserId: number,
    newPlanType: PlanType,
    req?: any
  ) {
    const user = await prisma.user.findUnique({
      where: { id: targetUserId },
      include: { plan: true },
    });

    if (!user) {
      throw AppError.notFound('Usuário não encontrado');
    }

    const newPlan = await prisma.plan.findUnique({
      where: { type: newPlanType },
    });

    if (!newPlan) {
      throw AppError.notFound('Plano não encontrado');
    }

    const oldPlanType = user.plan?.type || 'FREE';

    // Update user's plan
    await prisma.user.update({
      where: { id: targetUserId },
      data: { planId: newPlan.id },
    });

    // Create or update subscription
    await prisma.subscription.upsert({
      where: { userId: targetUserId },
      update: {
        planId: newPlan.id,
        status: 'ACTIVE',
        provider: 'manual',
      },
      create: {
        userId: targetUserId,
        planId: newPlan.id,
        status: 'ACTIVE',
        provider: 'manual',
      },
    });

    // Log audit event
    await AuditService.logAdminPlanChange(
      adminUserId,
      targetUserId,
      oldPlanType,
      newPlanType,
      req
    );

    return { success: true, newPlan: newPlanType };
  }

  /**
   * Change user status (block/unblock)
   */
  static async changeUserStatus(
    adminUserId: number,
    targetUserId: number,
    newStatus: UserStatus,
    reason?: string,
    req?: any
  ) {
    const user = await prisma.user.findUnique({
      where: { id: targetUserId },
    });

    if (!user) {
      throw AppError.notFound('Usuário não encontrado');
    }

    if (user.role === 'ADMIN') {
      throw AppError.forbidden('Não é possível alterar status de outro admin');
    }

    await prisma.user.update({
      where: { id: targetUserId },
      data: {
        status: newStatus,
        isActive: newStatus === 'ACTIVE',
      },
    });

    // Log audit event
    await AuditService.logAdminUserStatusChange(
      adminUserId,
      targetUserId,
      newStatus === 'BLOCKED',
      reason,
      req
    );

    return { success: true, newStatus };
  }

  /**
   * Get usage analytics
   */
  static async getUsageAnalytics(range: '7d' | '30d' | '90d' = '30d') {
    const days = range === '7d' ? 7 : range === '30d' ? 30 : 90;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Routines per day
    const routinesPerDay = await prisma.$queryRaw<
      Array<{ date: Date; count: bigint }>
    >`
      SELECT DATE(created_at) as date, COUNT(*) as count
      FROM routine_logs
      WHERE created_at >= ${startDate}
      GROUP BY DATE(created_at)
      ORDER BY date ASC
    `;

    // New users per day
    const newUsersPerDay = await prisma.$queryRaw<
      Array<{ date: Date; count: bigint }>
    >`
      SELECT DATE(created_at) as date, COUNT(*) as count
      FROM users
      WHERE created_at >= ${startDate}
      GROUP BY DATE(created_at)
      ORDER BY date ASC
    `;

    // New babies per day
    const newBabiesPerDay = await prisma.$queryRaw<
      Array<{ date: Date; count: bigint }>
    >`
      SELECT DATE(created_at) as date, COUNT(*) as count
      FROM babies
      WHERE created_at >= ${startDate}
      GROUP BY DATE(created_at)
      ORDER BY date ASC
    `;

    // Conversion funnel
    const totalFreeUsers = await prisma.user.count({
      where: { plan: { type: 'FREE' } },
    });
    const totalPremiumUsers = await prisma.user.count({
      where: { plan: { type: 'PREMIUM' } },
    });

    // Paywall hits grouped by feature
    const paywallHits = await AuditService.countPaywallHits(startDate);

    return {
      routinesPerDay: routinesPerDay.map(r => ({
        date: r.date,
        count: Number(r.count),
      })),
      newUsersPerDay: newUsersPerDay.map(r => ({
        date: r.date,
        count: Number(r.count),
      })),
      newBabiesPerDay: newBabiesPerDay.map(r => ({
        date: r.date,
        count: Number(r.count),
      })),
      conversionFunnel: {
        freeUsers: totalFreeUsers,
        premiumUsers: totalPremiumUsers,
        conversionRate:
          totalFreeUsers + totalPremiumUsers > 0
            ? (totalPremiumUsers / (totalFreeUsers + totalPremiumUsers)) * 100
            : 0,
      },
      paywallHits,
    };
  }

  /**
   * Change user role (admin action)
   */
  static async changeUserRole(
    adminUserId: number,
    targetUserId: number,
    newRole: UserRole,
    req?: any
  ) {
    const user = await prisma.user.findUnique({
      where: { id: targetUserId },
    });

    if (!user) {
      throw AppError.notFound('Usuário não encontrado');
    }

    // Prevent demoting the last admin
    if (user.role === 'ADMIN' && newRole !== 'ADMIN') {
      const adminCount = await prisma.user.count({
        where: { role: 'ADMIN' },
      });
      if (adminCount <= 1) {
        throw AppError.forbidden('Não é possível remover o último administrador');
      }
    }

    // Prevent self-demotion
    if (adminUserId === targetUserId && newRole !== 'ADMIN') {
      throw AppError.forbidden('Você não pode remover suas próprias permissões de admin');
    }

    const oldRole = user.role;
    const isProfessional = newRole === 'PEDIATRICIAN' || newRole === 'SPECIALIST';

    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: targetUserId },
        data: { role: newRole },
      });

      if (isProfessional) {
        const existingProf = await tx.professional.findUnique({
          where: { userId: targetUserId },
        });
        if (!existingProf) {
          const caregiver = await tx.caregiver.findUnique({ where: { userId: targetUserId } });
          await tx.professional.create({
            data: {
              userId: targetUserId,
              fullName: caregiver?.fullName || user.email.split('@')[0],
              email: user.email,
              specialty: newRole === 'SPECIALIST' ? 'Especialista' : 'Pediatria',
              phone: caregiver?.phone,
              city: caregiver?.city,
              state: caregiver?.state,
              country: caregiver?.country || 'BR',
              registrationSource: 'SELF_REGISTERED',
              status: 'ACTIVE',
            },
          });
        }
      }
    });

    // Log audit event
    await AuditService.log({
      userId: adminUserId,
      action: 'ADMIN_USER_ROLE_CHANGED' as any,
      targetType: 'user',
      targetId: targetUserId,
      metadata: {
        oldRole,
        newRole,
        targetEmail: user.email,
      },
      req,
    });

    return { success: true, oldRole, newRole };
  }

  /**
   * Impersonate user (for support)
   * Returns a limited token that expires quickly
   */
  static async impersonateUser(
    adminUserId: number,
    targetUserId: number,
    req?: any
  ) {
    const user = await prisma.user.findUnique({
      where: { id: targetUserId },
      include: { caregiver: true },
    });

    if (!user) {
      throw AppError.notFound('Usuário não encontrado');
    }

    if (user.role === 'ADMIN') {
      throw AppError.forbidden('Não é possível impersonar outro admin');
    }

    // Log audit event
    await AuditService.log({
      userId: adminUserId,
      action: 'ADMIN_IMPERSONATE_START',
      targetType: 'user',
      targetId: targetUserId,
      metadata: {
        targetEmail: user.email,
        targetRole: user.role,
      },
      req,
    });

    // Import JWT service to generate token
    const { JwtService } = await import('./jwt.service');
    
    // Generate short-lived token (15 minutes)
    const impersonateToken = JwtService.generateAccessToken(
      {
        userId: user.id,
        email: user.email,
        role: user.role,
      },
      '15m' // 15 minutes expiry
    );

    return {
      success: true,
      token: impersonateToken,
      expiresIn: '15m',
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        fullName: user.caregiver?.fullName,
      },
    };
  }

  /**
   * Delete a user and all related data
   */
  static async deleteUser(
    adminUserId: number,
    targetUserId: number,
    req?: any
  ) {
    const user = await prisma.user.findUnique({
      where: { id: targetUserId },
      include: { caregiver: true },
    });

    if (!user) {
      throw AppError.notFound('Usuário não encontrado');
    }

    if (user.role === 'ADMIN') {
      const adminCount = await prisma.user.count({ where: { role: 'ADMIN' } });
      if (adminCount <= 1) {
        throw AppError.forbidden('Não é possível excluir o último administrador');
      }
    }

    if (adminUserId === targetUserId) {
      throw AppError.forbidden('Você não pode excluir sua própria conta por aqui');
    }

    await AuditService.log({
      userId: adminUserId,
      action: 'ADMIN_USER_BLOCKED' as any,
      targetType: 'user',
      targetId: targetUserId,
      metadata: {
        targetEmail: user.email,
        action: 'DELETE',
        fullName: user.caregiver?.fullName,
      },
      req,
    });

    await prisma.$transaction(async (tx) => {
      await tx.refreshToken.deleteMany({ where: { userId: targetUserId } });
      await tx.deviceToken.deleteMany({ where: { userId: targetUserId } });
      await tx.notification.deleteMany({ where: { userId: targetUserId } });
      await tx.auditEvent.deleteMany({ where: { userId: targetUserId } });
      await tx.apiEvent.deleteMany({ where: { userId: targetUserId } });
      await tx.passwordReset.deleteMany({ where: { userId: targetUserId } });
      await tx.subscription.deleteMany({ where: { userId: targetUserId } });
      await tx.babyInvite.deleteMany({ where: { createdById: targetUserId } });
      await tx.userSettings.deleteMany({ where: { userId: targetUserId } });
      await tx.aiChatSession.deleteMany({ where: { userId: targetUserId } });
      await tx.professional.deleteMany({ where: { userId: targetUserId } });

      if (user.caregiver) {
        await tx.babyMember.deleteMany({ where: { caregiverId: user.caregiver.id } });
        await tx.caregiverBaby.deleteMany({ where: { caregiverId: user.caregiver.id } });
        await tx.caregiver.delete({ where: { id: user.caregiver.id } });
      }

      await tx.user.delete({ where: { id: targetUserId } });
    });

    return { success: true, deletedEmail: user.email };
  }

  /**
   * Get audit trail for a specific user (actions performed ON or BY this user)
   */
  static async getUserAuditTrail(
    targetUserId: number,
    limit: number = 30
  ) {
    const events = await prisma.auditEvent.findMany({
      where: {
        OR: [
          { userId: targetUserId },
          { targetId: targetUserId, targetType: 'user' },
        ],
      },
      include: {
        user: {
          select: { id: true, email: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return events.map(e => ({
      id: e.id,
      action: e.action,
      performedBy: e.user ? { id: e.user.id, email: e.user.email } : null,
      targetId: e.targetId,
      metadata: e.metadata,
      ipAddress: e.ipAddress,
      createdAt: e.createdAt.toISOString(),
    }));
  }
}


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
              fullName: true,
              phone: true,
              city: true,
              state: true,
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

    // Mask sensitive data
    const sanitizedUsers = users.map(user => ({
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
      babiesCount: user._count.babyMembers,
    }));

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
      where.name = { contains: filters.query, mode: 'insensitive' };
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
          _count: {
            select: {
              caregivers: true,
              professionals: true,
              routineLogs: {
                where: {
                  createdAt: { gte: thirtyDaysAgo },
                },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.baby.count({ where }),
    ]);

    const sanitizedBabies = babies.map(baby => ({
      id: baby.id,
      name: baby.name,
      birthDate: baby.birthDate,
      city: baby.city,
      state: baby.state,
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
      routinesCount30d: baby._count.routineLogs,
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
   * Get user details for admin
   */
  static async getUserDetails(userId: number) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        caregiver: true,
        professional: true,
        plan: true,
        subscription: true,
        babyMembers: {
          include: {
            baby: {
              select: {
                id: true,
                name: true,
                birthDate: true,
              },
            },
          },
        },
      },
    });

    if (!user) {
      throw AppError.notFound('Usuário não encontrado');
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
            // CPF masked
            cpf: user.caregiver.cpf 
              ? `***.***.${user.caregiver.cpf.slice(-5, -2)}-**`
              : null,
          }
        : null,
      professional: user.professional,
      babies: user.babyMembers.map(bm => ({
        id: bm.baby.id,
        name: bm.baby.name,
        birthDate: bm.baby.birthDate,
        role: bm.role,
        status: bm.status,
      })),
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

    await prisma.user.update({
      where: { id: targetUserId },
      data: { role: newRole },
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
}


// Olive Baby API - Audit Service
import { PrismaClient, AuditAction } from '@prisma/client';
import { Request } from 'express';

const prisma = new PrismaClient();

export interface AuditEventData {
  userId?: number;
  action: AuditAction;
  targetType?: string;
  targetId?: number;
  metadata?: Record<string, unknown>;
  req?: Request;
}

export class AuditService {
  /**
   * Log an audit event
   */
  static async log(data: AuditEventData): Promise<void> {
    try {
      const ipAddress = data.req 
        ? (data.req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || 
          data.req.ip || 
          data.req.socket?.remoteAddress
        : undefined;

      const userAgent = data.req?.headers['user-agent'] || undefined;

      await prisma.auditEvent.create({
        data: {
          userId: data.userId || null,
          action: data.action,
          targetType: data.targetType || null,
          targetId: data.targetId || null,
          metadata: (data.metadata || {}) as any,
          ipAddress: ipAddress || null,
          userAgent: userAgent || null,
        },
      });
    } catch (error) {
      // Log error but don't throw - audit should not break main flow
      console.error('Failed to log audit event:', error);
    }
  }

  /**
   * Log paywall hit event
   */
  static async logPaywallHit(
    userId: number,
    feature: string,
    metadata?: Record<string, unknown>,
    req?: Request
  ): Promise<void> {
    await this.log({
      userId,
      action: 'PAYWALL_HIT',
      metadata: { feature, ...metadata },
      req,
    });
  }

  /**
   * Log admin plan change
   */
  static async logAdminPlanChange(
    adminUserId: number,
    targetUserId: number,
    fromPlan: string,
    toPlan: string,
    req?: Request
  ): Promise<void> {
    await this.log({
      userId: adminUserId,
      action: 'ADMIN_PLAN_CHANGED',
      targetType: 'user',
      targetId: targetUserId,
      metadata: { fromPlan, toPlan },
      req,
    });
  }

  /**
   * Log admin user block/unblock
   */
  static async logAdminUserStatusChange(
    adminUserId: number,
    targetUserId: number,
    blocked: boolean,
    reason?: string,
    req?: Request
  ): Promise<void> {
    await this.log({
      userId: adminUserId,
      action: blocked ? 'ADMIN_USER_BLOCKED' : 'ADMIN_USER_UNBLOCKED',
      targetType: 'user',
      targetId: targetUserId,
      metadata: { reason },
      req,
    });
  }

  /**
   * Log user login
   */
  static async logUserLogin(userId: number, req?: Request): Promise<void> {
    await this.log({
      userId,
      action: 'USER_LOGIN',
      req,
    });
  }

  /**
   * Log feature usage
   */
  static async logFeatureUsage(
    userId: number,
    action: AuditAction,
    metadata?: Record<string, unknown>,
    req?: Request
  ): Promise<void> {
    await this.log({
      userId,
      action,
      metadata,
      req,
    });
  }

  /**
   * Get audit events for user
   */
  static async getByUser(
    userId: number,
    options?: {
      limit?: number;
      offset?: number;
      actions?: AuditAction[];
    }
  ) {
    return prisma.auditEvent.findMany({
      where: {
        userId,
        ...(options?.actions && { action: { in: options.actions } }),
      },
      orderBy: { createdAt: 'desc' },
      take: options?.limit || 50,
      skip: options?.offset || 0,
    });
  }

  /**
   * Get all audit events (admin)
   */
  static async getAll(options?: {
    limit?: number;
    offset?: number;
    actions?: AuditAction[];
    userId?: number;
    startDate?: Date;
    endDate?: Date;
  }) {
    return prisma.auditEvent.findMany({
      where: {
        ...(options?.userId && { userId: options.userId }),
        ...(options?.actions && { action: { in: options.actions } }),
        ...(options?.startDate || options?.endDate) && {
          createdAt: {
            ...(options?.startDate && { gte: options.startDate }),
            ...(options?.endDate && { lte: options.endDate }),
          },
        },
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            role: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: options?.limit || 100,
      skip: options?.offset || 0,
    });
  }

  /**
   * Count paywall hits by feature (for analytics)
   */
  static async countPaywallHits(startDate?: Date, endDate?: Date) {
    const events = await prisma.auditEvent.findMany({
      where: {
        action: 'PAYWALL_HIT',
        ...(startDate || endDate) && {
          createdAt: {
            ...(startDate && { gte: startDate }),
            ...(endDate && { lte: endDate }),
          },
        },
      },
      select: {
        metadata: true,
      },
    });

    // Aggregate by feature
    const counts: Record<string, number> = {};
    for (const event of events) {
      const feature = (event.metadata as any)?.feature || 'unknown';
      counts[feature] = (counts[feature] || 0) + 1;
    }

    return counts;
  }
}


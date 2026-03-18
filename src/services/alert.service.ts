import { AlertSeverity, AlertStatus, Prisma } from '@prisma/client';
import { prisma } from '../config/database';
import { logger } from '../config/logger';

export class AlertService {
  private static cooldownCache = new Map<string, number>();

  static async create(data: {
    type: string;
    severity: AlertSeverity;
    title: string;
    message: string;
    component: string;
    metadata?: Record<string, unknown>;
  }) {
    const config = await prisma.alertConfig.findUnique({ where: { id: data.type } });
    if (config && !config.enabled) return null;

    const cooldownMin = config?.cooldownMin ?? 5;
    const cacheKey = `${data.type}_${data.severity}`;
    const lastSent = this.cooldownCache.get(cacheKey) ?? 0;
    if (Date.now() - lastSent < cooldownMin * 60_000) return null;

    this.cooldownCache.set(cacheKey, Date.now());

    const alert = await prisma.systemAlert.create({
      data: {
        type: data.type,
        severity: data.severity,
        title: data.title,
        message: data.message,
        component: data.component,
        metadata: (data.metadata ?? {}) as Prisma.InputJsonValue,
      },
    });

    logger.info('[Alert] Created', { id: alert.id, type: data.type, severity: data.severity });
    return alert;
  }

  static async list(filters?: {
    status?: AlertStatus;
    severity?: AlertSeverity;
    type?: string;
    component?: string;
    from?: string;
    to?: string;
    page?: number;
    limit?: number;
  }) {
    const where: Prisma.SystemAlertWhereInput = {};
    if (filters?.status) where.status = filters.status;
    if (filters?.severity) where.severity = filters.severity;
    if (filters?.type) where.type = filters.type;
    if (filters?.component) where.component = filters.component;
    if (filters?.from || filters?.to) {
      where.createdAt = {};
      if (filters.from) where.createdAt.gte = new Date(filters.from);
      if (filters.to) where.createdAt.lte = new Date(filters.to);
    }

    const page = filters?.page ?? 1;
    const limit = filters?.limit ?? 50;

    const [items, total] = await Promise.all([
      prisma.systemAlert.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.systemAlert.count({ where }),
    ]);

    return { items, total, page, limit };
  }

  static async updateStatus(id: number, status: AlertStatus, resolvedBy?: string) {
    const data: Prisma.SystemAlertUpdateInput = { status };
    if (status === 'RESOLVED') {
      data.resolvedAt = new Date();
      data.resolvedBy = resolvedBy;
    }
    return prisma.systemAlert.update({ where: { id }, data });
  }

  static async bulkUpdateStatus(ids: number[], status: AlertStatus, resolvedBy?: string) {
    const data: Prisma.SystemAlertUpdateManyMutationInput = { status };
    if (status === 'RESOLVED') {
      data.resolvedAt = new Date();
      data.resolvedBy = resolvedBy;
    }
    return prisma.systemAlert.updateMany({ where: { id: { in: ids } }, data });
  }

  static async getStats() {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const last7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [total, byStatus, bySeverity, byType, todayCount, last24hCount, last7dCount, recentCritical] =
      await Promise.all([
        prisma.systemAlert.count(),
        prisma.systemAlert.groupBy({ by: ['status'], _count: { id: true } }),
        prisma.systemAlert.groupBy({ by: ['severity'], _count: { id: true } }),
        prisma.systemAlert.groupBy({ by: ['type'], _count: { id: true }, orderBy: { _count: { id: 'desc' } }, take: 10 }),
        prisma.systemAlert.count({ where: { createdAt: { gte: today } } }),
        prisma.systemAlert.count({ where: { createdAt: { gte: last24h } } }),
        prisma.systemAlert.count({ where: { createdAt: { gte: last7d } } }),
        prisma.systemAlert.findMany({
          where: { severity: 'CRITICAL', status: { in: ['NEW', 'SEEN'] } },
          orderBy: { createdAt: 'desc' },
          take: 5,
        }),
      ]);

    const statusMap: Record<string, number> = {};
    byStatus.forEach((s) => { statusMap[s.status] = s._count.id; });

    const severityMap: Record<string, number> = {};
    bySeverity.forEach((s) => { severityMap[s.severity] = s._count.id; });

    const typeRanking = byType.map((t) => ({ type: t.type, count: t._count.id }));

    return {
      total,
      todayCount,
      last24hCount,
      last7dCount,
      byStatus: statusMap,
      bySeverity: severityMap,
      typeRanking,
      unresolvedCritical: recentCritical.length,
      recentCritical,
    };
  }

  // ==========================================
  // Alert Configs
  // ==========================================

  static async listConfigs() {
    return prisma.alertConfig.findMany({ orderBy: [{ category: 'asc' }, { id: 'asc' }] });
  }

  static async updateConfig(id: string, data: {
    enabled?: boolean;
    threshold?: Record<string, unknown>;
    channels?: string[];
    cooldownMin?: number;
    recipients?: string[];
  }) {
    const update: Prisma.AlertConfigUpdateInput = {};
    if (data.enabled !== undefined) update.enabled = data.enabled;
    if (data.threshold !== undefined) update.threshold = data.threshold as Prisma.InputJsonValue;
    if (data.channels !== undefined) update.channels = data.channels as Prisma.InputJsonValue;
    if (data.cooldownMin !== undefined) update.cooldownMin = data.cooldownMin;
    if (data.recipients !== undefined) update.recipients = data.recipients as Prisma.InputJsonValue;

    return prisma.alertConfig.update({ where: { id }, data: update });
  }

  static async resolveAllByType(type: string, resolvedBy?: string) {
    return prisma.systemAlert.updateMany({
      where: { type, status: { in: ['NEW', 'SEEN'] } },
      data: { status: 'RESOLVED', resolvedAt: new Date(), resolvedBy },
    });
  }
}

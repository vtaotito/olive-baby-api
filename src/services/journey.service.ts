// OlieCare API - Journey Service
// Enrollment-based journey execution with per-user tracking, condition evaluation, and deduplication
import { JourneyStatus, EnrollmentStatus, Prisma } from '@prisma/client';
import { prisma } from '../config/database';
import { logger } from '../config/logger';

export interface CreateJourneyInput {
  name: string;
  description?: string;
  category: string;
  audience: string;
  priority?: number;
  tags?: string[];
  steps?: CreateStepInput[];
}

export interface CreateStepInput {
  type: string;
  name: string;
  stepOrder: number;
  config: Record<string, unknown>;
  variables?: Record<string, unknown>[];
}

export interface UpdateJourneyInput {
  name?: string;
  description?: string;
  category?: string;
  audience?: string;
  priority?: number;
  tags?: string[];
  status?: JourneyStatus;
}

export class JourneyService {
  static async list(filters?: {
    category?: string;
    audience?: string;
    status?: JourneyStatus;
    page?: number;
    limit?: number;
  }) {
    const where: Prisma.JourneyWhereInput = {};
    if (filters?.category) where.category = filters.category;
    if (filters?.audience) where.audience = filters.audience;
    if (filters?.status) where.status = filters.status;

    const page = filters?.page ?? 1;
    const limit = filters?.limit ?? 50;

    const [items, total] = await Promise.all([
      prisma.journey.findMany({
        where,
        include: {
          steps: { orderBy: { stepOrder: 'asc' } },
          _count: { select: { enrollments: true } },
        },
        orderBy: [{ priority: 'desc' }, { updatedAt: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.journey.count({ where }),
    ]);

    return { items, total, page, limit };
  }

  static async getById(id: number) {
    return prisma.journey.findUnique({
      where: { id },
      include: {
        steps: { orderBy: { stepOrder: 'asc' } },
        _count: { select: { enrollments: true } },
      },
    });
  }

  static async create(input: CreateJourneyInput) {
    const { steps, ...journeyData } = input;

    return prisma.journey.create({
      data: {
        ...journeyData,
        tags: journeyData.tags ?? [],
        steps: steps
          ? {
              create: steps.map((s) => ({
                type: s.type,
                name: s.name,
                stepOrder: s.stepOrder,
                config: s.config as Prisma.InputJsonValue,
                variables: (s.variables ?? []) as Prisma.InputJsonValue,
              })),
            }
          : undefined,
      },
      include: { steps: { orderBy: { stepOrder: 'asc' } } },
    });
  }

  static async update(id: number, input: UpdateJourneyInput) {
    const data: Prisma.JourneyUpdateInput = {};
    if (input.name !== undefined) data.name = input.name;
    if (input.description !== undefined) data.description = input.description;
    if (input.category !== undefined) data.category = input.category;
    if (input.audience !== undefined) data.audience = input.audience;
    if (input.priority !== undefined) data.priority = input.priority;
    if (input.tags !== undefined) data.tags = input.tags;
    if (input.status !== undefined) {
      data.status = input.status;
      if (input.status === 'ACTIVE') data.activatedAt = new Date();
    }

    return prisma.journey.update({
      where: { id },
      data,
      include: { steps: { orderBy: { stepOrder: 'asc' } } },
    });
  }

  static async delete(id: number) {
    return prisma.journey.delete({ where: { id } });
  }

  static async activate(id: number, active: boolean) {
    const journey = await prisma.journey.update({
      where: { id },
      data: {
        status: active ? 'ACTIVE' : 'PAUSED',
        activatedAt: active ? new Date() : undefined,
      },
      include: { steps: { orderBy: { stepOrder: 'asc' } } },
    });

    if (active) {
      await JourneyService.enrollAudienceUsers(id);
    }

    return journey;
  }

  static async addStep(journeyId: number, input: CreateStepInput) {
    return prisma.journeyStep.create({
      data: {
        journeyId,
        type: input.type,
        name: input.name,
        stepOrder: input.stepOrder,
        config: input.config as Prisma.InputJsonValue,
        variables: (input.variables ?? []) as Prisma.InputJsonValue,
      },
    });
  }

  static async updateStep(
    stepId: number,
    input: Partial<CreateStepInput>
  ) {
    const data: Prisma.JourneyStepUpdateInput = {};
    if (input.type !== undefined) data.type = input.type;
    if (input.name !== undefined) data.name = input.name;
    if (input.stepOrder !== undefined) data.stepOrder = input.stepOrder;
    if (input.config !== undefined) data.config = input.config as Prisma.InputJsonValue;
    if (input.variables !== undefined) data.variables = input.variables as Prisma.InputJsonValue;

    return prisma.journeyStep.update({ where: { id: stepId }, data });
  }

  static async deleteStep(stepId: number) {
    return prisma.journeyStep.delete({ where: { id: stepId } });
  }

  static async replaceSteps(journeyId: number, steps: CreateStepInput[]) {
    await prisma.journeyStep.deleteMany({ where: { journeyId } });
    if (steps.length === 0) return [];

    await prisma.journeyStep.createMany({
      data: steps.map((s) => ({
        journeyId,
        type: s.type,
        name: s.name,
        stepOrder: s.stepOrder,
        config: s.config as Prisma.InputJsonValue,
        variables: (s.variables ?? []) as Prisma.InputJsonValue,
      })),
    });

    return prisma.journeyStep.findMany({
      where: { journeyId },
      orderBy: { stepOrder: 'asc' },
    });
  }

  static async getMetrics() {
    const [total, byStatus, byCategory, recentActive, enrollmentStats] = await Promise.all([
      prisma.journey.count(),
      prisma.journey.groupBy({ by: ['status'], _count: { id: true } }),
      prisma.journey.groupBy({ by: ['category'], _count: { id: true } }),
      prisma.journey.findMany({
        where: { status: 'ACTIVE' },
        include: {
          steps: { orderBy: { stepOrder: 'asc' } },
          _count: { select: { enrollments: true } },
        },
        orderBy: { activatedAt: 'desc' },
        take: 5,
      }),
      prisma.journeyEnrollment.groupBy({
        by: ['status'],
        _count: { id: true },
      }),
    ]);

    const statusMap: Record<string, number> = {};
    byStatus.forEach((s) => { statusMap[s.status] = s._count.id; });

    const categoryMap: Record<string, number> = {};
    byCategory.forEach((c) => { categoryMap[c.category] = c._count.id; });

    const enrollmentStatusMap: Record<string, number> = {};
    enrollmentStats.forEach((e) => { enrollmentStatusMap[e.status] = e._count.id; });

    const totalSent = await prisma.journey.aggregate({ _sum: { totalSent: true } });
    const totalDelivered = await prisma.journey.aggregate({ _sum: { totalDelivered: true } });

    return {
      total,
      byStatus: statusMap,
      byCategory: categoryMap,
      totalSent: totalSent._sum.totalSent ?? 0,
      totalDelivered: totalDelivered._sum.totalDelivered ?? 0,
      enrollments: enrollmentStatusMap,
      recentActive,
    };
  }

  static async getTemplateJourneys() {
    return JOURNEY_TEMPLATES;
  }

  // ==========================================
  // Enrollment Management
  // ==========================================

  static async enrollAudienceUsers(journeyId: number): Promise<number> {
    const journey = await prisma.journey.findUnique({
      where: { id: journeyId },
      include: { steps: { orderBy: { stepOrder: 'asc' } } },
    });
    if (!journey) throw new Error('Journey not found');

    const users = await JourneyService.getAudienceUsers(journey.audience);
    let enrolled = 0;

    for (const user of users) {
      try {
        await prisma.journeyEnrollment.upsert({
          where: { journeyId_userId: { journeyId, userId: user.id } },
          create: {
            journeyId,
            userId: user.id,
            currentStep: 0,
            status: 'ACTIVE',
          },
          update: {},
        });
        enrolled++;
      } catch {
        logger.warn(`[Journey] Failed to enroll user ${user.id} in journey ${journeyId}`);
      }
    }

    logger.info(`[Journey] Enrolled ${enrolled} users in journey ${journeyId}`);
    return enrolled;
  }

  static async getEnrollmentStats(journeyId: number) {
    const [total, byStatus] = await Promise.all([
      prisma.journeyEnrollment.count({ where: { journeyId } }),
      prisma.journeyEnrollment.groupBy({
        by: ['status'],
        where: { journeyId },
        _count: { id: true },
      }),
    ]);

    const statusMap: Record<string, number> = {};
    byStatus.forEach((s) => { statusMap[s.status] = s._count.id; });

    return { total, byStatus: statusMap };
  }

  // ==========================================
  // Condition Evaluation
  // ==========================================

  static async evaluateCondition(
    userId: number,
    config: Record<string, unknown>
  ): Promise<boolean> {
    const field = config.field as string;
    const operator = config.operator as string;
    const value = config.value;

    switch (field) {
      case 'hasBaby': {
        const babyCount = await prisma.babyMember.count({
          where: { userId, status: 'ACTIVE' },
        });
        const hasBaby = babyCount > 0;
        return JourneyService.compareValues(hasBaby, operator, value);
      }

      case 'firstRoutine': {
        const routineCount = await prisma.routineLog.count({
          where: {
            baby: { members: { some: { userId, status: 'ACTIVE' } } },
          },
        });
        const hasRoutine = routineCount > 0;
        return JourneyService.compareValues(hasRoutine, operator, value);
      }

      case 'hasRoutines': {
        const rCount = await prisma.routineLog.count({
          where: {
            baby: { members: { some: { userId, status: 'ACTIVE' } } },
          },
        });
        return JourneyService.compareValues(rCount > 0, operator, value);
      }

      case 'lastActivity':
      case 'daysInactive': {
        const user = await prisma.user.findUnique({
          where: { id: userId },
          select: { lastActivityAt: true },
        });
        if (!user?.lastActivityAt) return true;
        const daysSince = Math.floor(
          (Date.now() - user.lastActivityAt.getTime()) / (1000 * 60 * 60 * 24)
        );
        if (operator === 'olderThan' || operator === 'greaterThan') {
          return daysSince > (value as number);
        }
        return JourneyService.compareValues(daysSince, operator, value);
      }

      case 'isActive': {
        const user = await prisma.user.findUnique({
          where: { id: userId },
          select: { lastActivityAt: true },
        });
        const isActive = user?.lastActivityAt
          ? (Date.now() - user.lastActivityAt.getTime()) < 7 * 24 * 60 * 60 * 1000
          : false;
        return JourneyService.compareValues(isActive, operator, value);
      }

      case 'isPremium': {
        const user = await prisma.user.findUnique({
          where: { id: userId },
          select: { plan: { select: { type: true } } },
        });
        const isPremium = user?.plan?.type === 'PREMIUM';
        return JourneyService.compareValues(isPremium, operator, value);
      }

      case 'accountAge': {
        const user = await prisma.user.findUnique({
          where: { id: userId },
          select: { createdAt: true },
        });
        if (!user) return false;
        const ageDays = Math.floor(
          (Date.now() - user.createdAt.getTime()) / (1000 * 60 * 60 * 24)
        );
        return JourneyService.compareValues(ageDays, operator, value);
      }

      case 'paywallHits': {
        const hitCount = await prisma.auditEvent.count({
          where: { userId, action: 'PAYWALL_HIT' },
        });
        return JourneyService.compareValues(hitCount, operator, value);
      }

      default:
        logger.warn(`[Journey] Unknown condition field: ${field}`);
        return true;
    }
  }

  private static compareValues(actual: unknown, operator: string, expected: unknown): boolean {
    switch (operator) {
      case 'equals':
        return actual === expected;
      case 'notEquals':
        return actual !== expected;
      case 'greaterThan':
        return (actual as number) > (expected as number);
      case 'lessThan':
        return (actual as number) < (expected as number);
      case 'olderThan':
        return (actual as number) > (expected as number);
      default:
        return actual === expected;
    }
  }

  // ==========================================
  // Step Execution (per-user with deduplication)
  // ==========================================

  static async executeStepForUser(
    step: { id: number; type: string; config: unknown; journey: { id: number } },
    user: { id: number; email: string; name: string },
    enrollmentId: number
  ): Promise<'sent' | 'delivered' | 'failed' | 'skipped'> {
    const alreadyExecuted = await prisma.journeyStepExecution.findFirst({
      where: { enrollmentId, stepId: step.id },
    });
    if (alreadyExecuted) return 'skipped';

    const config = step.config as Record<string, unknown>;
    let status: 'sent' | 'delivered' | 'failed' = 'sent';

    try {
      if (step.type === 'email') {
        const { sendEmailByTemplate } = await import('./email.service');
        await sendEmailByTemplate(
          (config.templateType as string) || 'welcome',
          user.email,
          {
            userName: user.name,
            subject: (config.subject as string) || 'OlieCare',
            customBody: config.customBody as string | undefined,
          }
        );
        status = 'delivered';
      } else if (step.type === 'push') {
        const { PushNotificationService } = await import('./push-notification.service');
        const results = await PushNotificationService.sendToUser(user.id, {
          title: (config.title as string) || 'OlieCare',
          body: (config.body as string) || '',
          clickAction: config.clickAction as string | undefined,
          priority: (config.priority as 'default' | 'high') || 'default',
        });
        status = results.some(r => r.success) ? 'delivered' : (results.length === 0 ? 'sent' : 'failed');
      } else if (step.type === 'whatsapp') {
        status = await JourneyService.executeWhatsAppStep(config, user);
      }
    } catch (err) {
      status = 'failed';
      logger.error(`[Journey] Step ${step.id} failed for user ${user.id}`, { error: (err as Error).message });
    }

    await prisma.journeyStepExecution.create({
      data: {
        enrollmentId,
        stepId: step.id,
        channel: step.type,
        status,
        errorMessage: status === 'failed' ? 'Delivery failed' : undefined,
      },
    });

    return status;
  }

  private static async executeWhatsAppStep(
    config: Record<string, unknown>,
    user: { id: number; email: string; name: string }
  ): Promise<'sent' | 'delivered' | 'failed'> {
    const phone = await JourneyService.getUserPhone(user.id);
    if (!phone) return 'failed';

    const evolutionUrl = process.env.EVOLUTION_API_URL;
    const evolutionKey = process.env.EVOLUTION_API_KEY;
    const instanceName = process.env.EVOLUTION_INSTANCE || 'oliecare';

    if (!evolutionUrl || !evolutionKey) {
      logger.warn('[Journey] WhatsApp step skipped: Evolution API not configured');
      return 'failed';
    }

    try {
      const message = (config.message as string || '')
        .replace('{{userName}}', user.name)
        .replace('{{name}}', user.name);

      const response = await fetch(`${evolutionUrl}/message/sendText/${instanceName}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: evolutionKey },
        body: JSON.stringify({
          number: phone,
          text: message,
          delay: 1500,
        }),
      });

      return response.ok ? 'delivered' : 'failed';
    } catch {
      return 'failed';
    }
  }

  private static async getUserPhone(userId: number): Promise<string | null> {
    const caregiver = await prisma.caregiver.findUnique({
      where: { userId },
      select: { phone: true },
    });
    return caregiver?.phone ?? null;
  }

  // ==========================================
  // Legacy: Execute step for all audience (backward-compat with old n8n calls)
  // ==========================================

  static async executeStep(journeyId: number, stepId: number): Promise<{
    sent: number; delivered: number; failed: number;
  }> {
    const step = await prisma.journeyStep.findUnique({
      where: { id: stepId },
      include: { journey: true },
    });
    if (!step || step.journeyId !== journeyId) {
      throw new Error('Step not found or does not belong to journey');
    }
    if (step.journey.status !== 'ACTIVE') {
      throw new Error('Journey is not active');
    }

    const enrollments = await prisma.journeyEnrollment.findMany({
      where: { journeyId, status: 'ACTIVE' },
      include: { user: { select: { id: true, email: true, caregiver: { select: { fullName: true } }, professional: { select: { fullName: true } } } } },
    });

    let sent = 0, delivered = 0, failed = 0;

    for (const enrollment of enrollments) {
      const user = {
        id: enrollment.user.id,
        email: enrollment.user.email,
        name: enrollment.user.caregiver?.fullName ?? enrollment.user.professional?.fullName ?? 'Usuário',
      };

      const result = await JourneyService.executeStepForUser(
        { id: step.id, type: step.type, config: step.config, journey: { id: journeyId } },
        user,
        enrollment.id
      );

      if (result === 'skipped') continue;
      sent++;
      if (result === 'delivered') delivered++;
      else if (result === 'failed') failed++;
    }

    await prisma.journeyStep.update({
      where: { id: stepId },
      data: {
        sent: { increment: sent },
        delivered: { increment: delivered },
        failed: { increment: failed },
      },
    });

    await prisma.journey.update({
      where: { id: journeyId },
      data: {
        totalSent: { increment: sent },
        totalDelivered: { increment: delivered },
        totalFailed: { increment: failed },
      },
    });

    logger.info(`[Journey] Step ${stepId} executed: sent=${sent}, delivered=${delivered}, failed=${failed}`);
    return { sent, delivered, failed };
  }

  // ==========================================
  // Enrollment-based Journey Execution (called by n8n)
  // ==========================================

  static async executeJourney(journeyId: number): Promise<{
    journeyId: number;
    status: string;
    enrolled: number;
    processed: number;
    advanced: number;
    completed: number;
    stepsExecuted: Array<{
      stepId: number;
      type: string;
      name: string;
      result: Record<string, unknown>;
    }>;
  }> {
    const journey = await prisma.journey.findUnique({
      where: { id: journeyId },
      include: { steps: { orderBy: { stepOrder: 'asc' } } },
    });
    if (!journey) throw new Error('Journey not found');
    if (journey.status !== 'ACTIVE') throw new Error('Journey is not active');

    await JourneyService.enrollAudienceUsers(journeyId);

    const now = new Date();
    const activeEnrollments = await prisma.journeyEnrollment.findMany({
      where: {
        journeyId,
        status: 'ACTIVE',
        OR: [
          { nextStepAt: null },
          { nextStepAt: { lte: now } },
        ],
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            caregiver: { select: { fullName: true } },
            professional: { select: { fullName: true } },
          },
        },
      },
    });

    const stepsExecuted: Array<{
      stepId: number; type: string; name: string; result: Record<string, unknown>;
    }> = [];

    let processed = 0, advanced = 0, completedCount = 0;

    for (const enrollment of activeEnrollments) {
      processed++;
      const step = journey.steps.find(s => s.stepOrder === enrollment.currentStep);

      if (!step) {
        await prisma.journeyEnrollment.update({
          where: { id: enrollment.id },
          data: { status: 'COMPLETED', completedAt: now },
        });
        completedCount++;
        continue;
      }

      const config = step.config as Record<string, unknown>;
      const user = {
        id: enrollment.user.id,
        email: enrollment.user.email,
        name: enrollment.user.caregiver?.fullName ?? enrollment.user.professional?.fullName ?? 'Usuário',
      };

      if (step.type === 'delay') {
        const delayHours = (config.hours as number) ?? 24;
        const waitUntil = new Date(
          (enrollment.lastStepAt ?? enrollment.enrolledAt).getTime() + delayHours * 3600 * 1000
        );

        if (now < waitUntil) {
          await prisma.journeyEnrollment.update({
            where: { id: enrollment.id },
            data: { nextStepAt: waitUntil },
          });
          continue;
        }

        await prisma.journeyEnrollment.update({
          where: { id: enrollment.id },
          data: {
            currentStep: enrollment.currentStep + 1,
            lastStepAt: now,
            nextStepAt: null,
          },
        });
        advanced++;
        continue;
      }

      if (step.type === 'condition') {
        const conditionMet = await JourneyService.evaluateCondition(user.id, config);

        await prisma.journeyStepExecution.create({
          data: {
            enrollmentId: enrollment.id,
            stepId: step.id,
            channel: 'condition',
            status: conditionMet ? 'passed' : 'skipped',
          },
        });

        if (conditionMet) {
          await prisma.journeyEnrollment.update({
            where: { id: enrollment.id },
            data: {
              currentStep: enrollment.currentStep + 1,
              lastStepAt: now,
            },
          });
          advanced++;
        } else {
          const nextActionStep = journey.steps.find(
            s => s.stepOrder > step.stepOrder && (s.type === 'email' || s.type === 'push' || s.type === 'whatsapp' || s.type === 'delay')
          );
          if (nextActionStep) {
            await prisma.journeyEnrollment.update({
              where: { id: enrollment.id },
              data: {
                currentStep: nextActionStep.stepOrder,
                lastStepAt: now,
              },
            });
          } else {
            await prisma.journeyEnrollment.update({
              where: { id: enrollment.id },
              data: { status: 'COMPLETED', completedAt: now },
            });
            completedCount++;
          }
        }
        continue;
      }

      // email / push / whatsapp
      const result = await JourneyService.executeStepForUser(
        { id: step.id, type: step.type, config: step.config, journey: { id: journeyId } },
        user,
        enrollment.id
      );

      if (result !== 'skipped') {
        stepsExecuted.push({
          stepId: step.id,
          type: step.type,
          name: step.name,
          result: { status: result, userId: user.id },
        });

        const isSent = result === 'sent' || result === 'delivered';
        await prisma.journeyStep.update({
          where: { id: step.id },
          data: {
            sent: { increment: isSent ? 1 : 0 },
            delivered: { increment: result === 'delivered' ? 1 : 0 },
            failed: { increment: result === 'failed' ? 1 : 0 },
          },
        });
      }

      const nextStepOrder = enrollment.currentStep + 1;
      const hasMore = journey.steps.some(s => s.stepOrder === nextStepOrder);

      await prisma.journeyEnrollment.update({
        where: { id: enrollment.id },
        data: {
          currentStep: nextStepOrder,
          lastStepAt: now,
          nextStepAt: null,
          ...(hasMore ? {} : { status: 'COMPLETED', completedAt: now }),
        },
      });

      if (hasMore) advanced++;
      else completedCount++;
    }

    const totalSent = stepsExecuted.filter(s => s.result.status === 'sent' || s.result.status === 'delivered').length;
    const totalDelivered = stepsExecuted.filter(s => s.result.status === 'delivered').length;
    const totalFailed = stepsExecuted.filter(s => s.result.status === 'failed').length;

    if (totalSent > 0 || totalFailed > 0) {
      await prisma.journey.update({
        where: { id: journeyId },
        data: {
          totalSent: { increment: totalSent },
          totalDelivered: { increment: totalDelivered },
          totalFailed: { increment: totalFailed },
        },
      });
    }

    return {
      journeyId,
      status: journey.status,
      enrolled: activeEnrollments.length,
      processed,
      advanced,
      completed: completedCount,
      stepsExecuted,
    };
  }

  // ==========================================
  // Audience
  // ==========================================

  static async getAudienceUsers(audience: string): Promise<Array<{ id: number; email: string; name: string }>> {
    const where: Prisma.UserWhereInput = { isActive: true };

    if (audience === 'b2c') {
      where.role = { in: ['PARENT', 'CAREGIVER'] };
    } else if (audience === 'b2b') {
      where.role = { in: ['PEDIATRICIAN', 'SPECIALIST'] };
    } else if (audience === 'premium') {
      where.plan = { type: { in: ['PREMIUM', 'PROFESSIONAL_BASIC', 'PROFESSIONAL_ADVANCED', 'PROFESSIONAL_PRO'] } };
    } else if (audience === 'free') {
      where.OR = [{ planId: null }, { plan: { type: 'FREE' } }];
    }

    const users = await prisma.user.findMany({
      where,
      select: {
        id: true,
        email: true,
        caregiver: { select: { fullName: true } },
        professional: { select: { fullName: true } },
      },
      take: 5000,
    });

    return users.map((u) => ({
      id: u.id,
      email: u.email,
      name: u.caregiver?.fullName ?? u.professional?.fullName ?? u.email.split('@')[0] ?? 'Usuário',
    }));
  }

  // ==========================================
  // Execution Summary (for n8n monitoring)
  // ==========================================

  static async getExecutionSummary() {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const last7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [activeJourneys, totalStepsSent, emailsToday, pushToday, emailsWeek, pushWeek, enrollmentCounts] = await Promise.all([
      prisma.journey.count({ where: { status: 'ACTIVE' } }),
      prisma.journeyStep.aggregate({ _sum: { sent: true, delivered: true, failed: true } }),
      prisma.emailCommunication.count({ where: { sentAt: { gte: today }, templateType: { not: { startsWith: 'push_' } } } }),
      prisma.emailCommunication.count({ where: { sentAt: { gte: today }, templateType: { startsWith: 'push_' } } }),
      prisma.emailCommunication.count({ where: { sentAt: { gte: last7d }, templateType: { not: { startsWith: 'push_' } } } }),
      prisma.emailCommunication.count({ where: { sentAt: { gte: last7d }, templateType: { startsWith: 'push_' } } }),
      prisma.journeyEnrollment.groupBy({
        by: ['status'],
        _count: { id: true },
      }),
    ]);

    const totalFailed = totalStepsSent._sum.failed ?? 0;

    const enrollmentStatusMap: Record<string, number> = {};
    enrollmentCounts.forEach((e) => { enrollmentStatusMap[e.status] = e._count.id; });

    return {
      activeJourneys,
      failedDeliveries: totalFailed,
      failed: totalFailed,
      steps: {
        totalSent: totalStepsSent._sum.sent ?? 0,
        totalDelivered: totalStepsSent._sum.delivered ?? 0,
        totalFailed,
      },
      enrollments: enrollmentStatusMap,
      communications: {
        emailsToday,
        pushToday,
        emailsWeek,
        pushWeek,
      },
    };
  }
}

// ==========================================
// Pre-built Journey Templates
// ==========================================

const JOURNEY_TEMPLATES = [
  {
    id: 'onboarding_b2c',
    name: 'Onboarding B2C - Novos Pais',
    description: 'Jornada de boas-vindas e ativação para novos pais/cuidadores',
    category: 'onboarding',
    audience: 'b2c',
    steps: [
      { type: 'email', name: 'E-mail de Boas-vindas', stepOrder: 0, config: { templateType: 'welcome', subject: 'Bem-vindo ao OlieCare! 🌿' }, variables: [{ key: 'userName', label: 'Nome do usuário' }] },
      { type: 'delay', name: 'Aguardar 24h', stepOrder: 1, config: { hours: 24 } },
      { type: 'condition', name: 'Verificar: bebê cadastrado?', stepOrder: 2, config: { field: 'hasBaby', operator: 'equals', value: false } },
      { type: 'email', name: 'E-mail: Primeiro Dia - Cadastrar Bebê', stepOrder: 3, config: { templateType: '09-onboarding-day1', subject: 'Comece sua jornada no OlieCare 👶' }, variables: [{ key: 'userName', label: 'Nome do usuário' }, { key: 'unsubscribeUrl', label: 'URL de cancelamento' }] },
      { type: 'condition', name: 'Verificar: bebê cadastrado?', stepOrder: 4, config: { field: 'hasBaby', operator: 'equals', value: true } },
      { type: 'email', name: 'E-mail: Primeiro Bebê Cadastrado', stepOrder: 5, config: { templateType: '10-first-baby-registered', subject: 'Parabéns! Seu bebê foi cadastrado 🎉' }, variables: [{ key: 'userName', label: 'Nome do usuário' }, { key: 'babyName', label: 'Nome do bebê' }, { key: 'babyId', label: 'ID do bebê' }, { key: 'unsubscribeUrl', label: 'URL de cancelamento' }] },
      { type: 'condition', name: 'Verificar: primeira rotina registrada?', stepOrder: 6, config: { field: 'firstRoutine', operator: 'equals', value: true } },
      { type: 'email', name: 'E-mail: Primeira Rotina Registrada', stepOrder: 7, config: { templateType: '11-first-routine-recorded', subject: 'Primeira rotina registrada! 🎉' }, variables: [{ key: 'userName', label: 'Nome do usuário' }, { key: 'babyName', label: 'Nome do bebê' }, { key: 'routineType', label: 'Tipo de rotina' }, { key: 'unsubscribeUrl', label: 'URL de cancelamento' }] },
      { type: 'delay', name: 'Aguardar 3 dias', stepOrder: 8, config: { hours: 72 } },
      { type: 'condition', name: 'Verificar: usuário ativo?', stepOrder: 9, config: { field: 'isActive', operator: 'equals', value: true } },
      { type: 'email', name: 'E-mail: Dia 3 - Dicas Avançadas', stepOrder: 10, config: { templateType: '12-onboarding-day3', subject: 'Você já está no caminho certo! 🎉' }, variables: [{ key: 'userName', label: 'Nome do usuário' }, { key: 'babyName', label: 'Nome do bebê' }, { key: 'babyId', label: 'ID do bebê' }, { key: 'unsubscribeUrl', label: 'URL de cancelamento' }] },
      { type: 'delay', name: 'Aguardar 4 dias', stepOrder: 11, config: { hours: 96 } },
      { type: 'condition', name: 'Verificar: usuário registrou rotinas?', stepOrder: 12, config: { field: 'hasRoutines', operator: 'equals', value: true } },
      { type: 'email', name: 'E-mail: Semana 1 - Primeiro Insight', stepOrder: 13, config: { templateType: '13-onboarding-day7', subject: 'Sua primeira semana completa! 📊' }, variables: [{ key: 'userName', label: 'Nome do usuário' }, { key: 'babyName', label: 'Nome do bebê' }, { key: 'routineCount', label: 'Total de rotinas' }, { key: 'insight', label: 'Insight personalizado' }, { key: 'unsubscribeUrl', label: 'URL de cancelamento' }] },
    ],
  },
  {
    id: 'onboarding_b2b',
    name: 'Onboarding B2B - Profissionais',
    description: 'Jornada de ativação para pediatras e especialistas',
    category: 'onboarding',
    audience: 'b2b',
    steps: [
      { type: 'email', name: 'E-mail: Convite aceito', stepOrder: 0, config: { templateType: 'professional_invite', subject: 'Bem-vindo ao OlieCare Profissional!' } },
      { type: 'delay', name: 'Aguardar 2 dias', stepOrder: 1, config: { hours: 48 } },
      { type: 'push', name: 'Push: Configure seu perfil', stepOrder: 2, config: { title: 'Configure seu perfil profissional 🏥', body: 'Adicione seu CRM e especialidade para começar a receber pacientes.', clickAction: '/prof/settings' } },
      { type: 'delay', name: 'Aguardar 3 dias', stepOrder: 3, config: { hours: 72 } },
      { type: 'push', name: 'Push: Convide pacientes', stepOrder: 4, config: { title: 'Convide seus pacientes! 📋', body: 'Envie convites para seus pacientes começarem a compartilhar rotinas.', clickAction: '/prof/dashboard' } },
    ],
  },
  {
    id: 'engagement_reactivation',
    name: 'Reativação Multicanal - Inativos 3+ dias',
    description: 'Jornada multicanal (push, email, WhatsApp) para reativar usuários inativos com escalada progressiva',
    category: 'engagement',
    audience: 'b2c',
    steps: [
      { type: 'condition', name: 'Inativo há 3+ dias?', stepOrder: 0, config: { field: 'daysInactive', operator: 'greaterThan', value: 3 } },
      { type: 'push', name: 'Dia 3: Push - Sentimos sua falta', stepOrder: 1, config: { title: 'Sentimos sua falta! 🌿', body: 'Faz alguns dias que você não registra a rotina do bebê. Volte e veja como está o desenvolvimento!', clickAction: '/dashboard', priority: 'high' } },
      { type: 'delay', name: 'Aguardar 2 dias', stepOrder: 2, config: { hours: 48 } },
      { type: 'condition', name: 'Ainda inativo?', stepOrder: 3, config: { field: 'daysInactive', operator: 'greaterThan', value: 5 } },
      { type: 'email', name: 'Dia 5: Email - Lembrete de inatividade', stepOrder: 4, config: { templateType: '21-inactivity-reminder', subject: 'Sentimos sua falta no OlieCare 🌿' }, variables: [{ key: 'userName', label: 'Nome do usuário' }, { key: 'unsubscribeUrl', label: 'URL de cancelamento' }] },
      { type: 'delay', name: 'Aguardar 3 dias', stepOrder: 5, config: { hours: 72 } },
      { type: 'condition', name: 'Ainda inativo?', stepOrder: 6, config: { field: 'daysInactive', operator: 'greaterThan', value: 8 } },
      { type: 'email', name: 'Dia 8: Email - Surpresa de retorno', stepOrder: 7, config: { templateType: '22-comeback-surprise', subject: 'Temos uma surpresa para você! 🎁' }, variables: [{ key: 'userName', label: 'Nome do usuário' }, { key: 'unsubscribeUrl', label: 'URL de cancelamento' }] },
      { type: 'delay', name: 'Aguardar 7 dias', stepOrder: 8, config: { hours: 168 } },
      { type: 'condition', name: 'Ainda inativo?', stepOrder: 9, config: { field: 'daysInactive', operator: 'greaterThan', value: 15 } },
      { type: 'whatsapp', name: 'Dia 15: WhatsApp - Reativação pessoal', stepOrder: 10, config: { message: 'Oi {{userName}}! Aqui é a Olie, do OlieCare 🌿\n\nSentimos sua falta! Faz um tempinho que você não registra as rotinas do bebê.\n\nSabia que manter o registro ajuda a identificar padrões de sono, alimentação e crescimento?\n\nVolte quando quiser, estamos aqui para ajudar! 💚\n\nhttps://app.oliecare.cloud' } },
      { type: 'delay', name: 'Aguardar 5 dias', stepOrder: 11, config: { hours: 120 } },
      { type: 'push', name: 'Dia 20: Push - Última chance', stepOrder: 12, config: { title: 'Última chance: Premium grátis por 7 dias! 🎁', body: 'Volte ao OlieCare e ganhe acesso Premium gratuito por 7 dias. Oferta exclusiva!', clickAction: '/settings/billing', priority: 'high' } },
    ],
  },
  {
    id: 'premium_activation',
    name: 'Conversão Free → Premium (Paywall-triggered)',
    description: 'Jornada inteligente de conversão baseada em uso real: ativa quando o usuário bate no paywall e tem conta ativa há 7+ dias',
    category: 'premium',
    audience: 'free',
    steps: [
      { type: 'condition', name: 'Conta ativa há 7+ dias?', stepOrder: 0, config: { field: 'accountAge', operator: 'greaterThan', value: 7 } },
      { type: 'condition', name: 'Bateu no paywall?', stepOrder: 1, config: { field: 'paywallHits', operator: 'greaterThan', value: 0 } },
      { type: 'email', name: 'Email: Teaser Premium', stepOrder: 2, config: { templateType: '18-premium-teaser', subject: 'Desbloqueie o potencial completo do OlieCare 💎' }, variables: [{ key: 'userName', label: 'Nome do usuário' }, { key: 'unsubscribeUrl', label: 'URL de cancelamento' }] },
      { type: 'delay', name: 'Aguardar 2 dias', stepOrder: 3, config: { hours: 48 } },
      { type: 'push', name: 'Push: Recurso Premium bloqueado', stepOrder: 4, config: { title: 'Desbloqueie insights avançados 🧠', body: 'Análises de IA, exportação de dados e acompanhamento ilimitado de bebês.', clickAction: '/settings/billing', priority: 'high' } },
      { type: 'delay', name: 'Aguardar 3 dias', stepOrder: 5, config: { hours: 72 } },
      { type: 'condition', name: 'Ainda é Free?', stepOrder: 6, config: { field: 'isPremium', operator: 'equals', value: false } },
      { type: 'email', name: 'Email: Feature bloqueada', stepOrder: 7, config: { templateType: '19-premium-feature-locked', subject: 'Esse recurso está esperando por você 🔒' }, variables: [{ key: 'userName', label: 'Nome do usuário' }, { key: 'unsubscribeUrl', label: 'URL de cancelamento' }] },
      { type: 'delay', name: 'Aguardar 4 dias', stepOrder: 8, config: { hours: 96 } },
      { type: 'condition', name: 'Ainda é Free?', stepOrder: 9, config: { field: 'isPremium', operator: 'equals', value: false } },
      { type: 'push', name: 'Push: Desconto exclusivo', stepOrder: 10, config: { title: 'Desconto exclusivo: 20% OFF! 💰', body: 'Primeiro mês Premium com 20% de desconto. Oferta por tempo limitado!', clickAction: '/settings/billing', priority: 'high' } },
      { type: 'delay', name: 'Aguardar 5 dias', stepOrder: 11, config: { hours: 120 } },
      { type: 'condition', name: 'Ainda é Free com 3+ paywall hits?', stepOrder: 12, config: { field: 'paywallHits', operator: 'greaterThan', value: 3 } },
      { type: 'whatsapp', name: 'WhatsApp: Oferta personalizada', stepOrder: 13, config: { message: 'Oi {{userName}}! 🌿\n\nNotamos que você tentou acessar recursos Premium do OlieCare algumas vezes.\n\nQue tal experimentar o Premium por 7 dias grátis? Assim você pode ver tudo que o OlieCare oferece para acompanhar o desenvolvimento do seu bebê.\n\nAcesse: https://app.oliecare.cloud/settings/billing\n\n💚 Equipe OlieCare' } },
    ],
  },
  {
    id: 'invite_campaign',
    name: 'Campanha de Convites',
    description: 'Incentiva usuários a convidarem familiares e profissionais',
    category: 'invites',
    audience: 'b2c',
    steps: [
      { type: 'push', name: 'Push: Convide a família', stepOrder: 0, config: { title: 'Compartilhe com a família! 👨‍👩‍👧', body: 'Convide outros cuidadores para acompanhar a rotina do bebê juntos.', clickAction: '/babies' } },
      { type: 'delay', name: 'Aguardar 5 dias', stepOrder: 1, config: { hours: 120 } },
      { type: 'email', name: 'E-mail: Benefícios do compartilhamento', stepOrder: 2, config: { templateType: 'custom', subject: 'Por que compartilhar o cuidado é importante 🤝', customBody: 'Estudos mostram que bebês com múltiplos cuidadores...' } },
      { type: 'delay', name: 'Aguardar 7 dias', stepOrder: 3, config: { hours: 168 } },
      { type: 'push', name: 'Push: Conecte o pediatra', stepOrder: 4, config: { title: 'Conecte o pediatra do bebê! 👨‍⚕️', body: 'O pediatra pode acompanhar a rotina diretamente pelo OlieCare.', clickAction: '/babies' } },
    ],
  },
  {
    id: 'retention_premium',
    name: 'Retenção Premium',
    description: 'Jornada para reter assinantes Premium próximos do vencimento',
    category: 'retention',
    audience: 'premium',
    steps: [
      { type: 'push', name: 'Push: Resumo de uso', stepOrder: 0, config: { title: 'Veja quanto você usou este mês! 📊', body: 'Seu resumo mensal está pronto. Confira os insights do bebê.', clickAction: '/dashboard' } },
      { type: 'delay', name: 'Aguardar 3 dias', stepOrder: 1, config: { hours: 72 } },
      { type: 'email', name: 'E-mail: Renovação', stepOrder: 2, config: { templateType: 'subscription_cancelled', subject: 'Sua assinatura expira em breve ⏰' } },
      { type: 'delay', name: 'Aguardar 2 dias', stepOrder: 3, config: { hours: 48 } },
      { type: 'push', name: 'Push: Oferta de renovação', stepOrder: 4, config: { title: 'Renove com desconto! 💎', body: 'Renove agora e ganhe 15% de desconto no próximo período.', clickAction: '/settings', priority: 'high' } },
    ],
  },
];

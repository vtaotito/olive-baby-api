// Olive Baby API - Admin Summary Service
// Lightweight aggregates for ops and reporting
import { PrismaClient, VaccineStatus } from '@prisma/client';
import { AppError } from '../utils/errors/AppError';

const prisma = new PrismaClient();

const WINDOW_REGEX = /^(\d{1,3})h$/;
const MAX_WINDOW_HOURS = 168;

export interface SummaryRange {
  from: string;
  to: string;
  windowHours?: number;
  weeks?: number;
}

export interface AdminSummaryPayload {
  range: SummaryRange;
  registrations: {
    users: number;
    babies: number;
    invitesAccepted: number;
  };
  events: {
    growthRecords: number;
    milestones: number;
    vaccinesApplied: number;
  };
  failures: {
    apiErrors4xx: number;
    apiErrors5xx: number;
    apiErrorsTotal: number;
    billingFailedEvents: number;
    billingUnprocessedEvents: number;
  };
}

export interface AdminOpsSummaryPayload {
  range: SummaryRange;
  errors: {
    total: number;
    count4xx: number;
    count5xx: number;
  };
  billing: {
    failedEvents: number;
    unprocessedEvents: number;
  };
}

function parseWindowHours(window: string): number {
  const match = WINDOW_REGEX.exec(window);
  if (!match) {
    throw AppError.badRequest('Parâmetro window inválido');
  }

  const hours = Number(match[1]);
  if (!Number.isInteger(hours) || hours < 1 || hours > MAX_WINDOW_HOURS) {
    throw AppError.badRequest('Parâmetro window inválido');
  }

  return hours;
}

function buildRangeFromHours(window: string): { from: Date; to: Date; range: SummaryRange } {
  const hours = parseWindowHours(window);
  const to = new Date();
  const from = new Date(to);
  from.setHours(from.getHours() - hours);

  return {
    from,
    to,
    range: {
      from: from.toISOString(),
      to: to.toISOString(),
      windowHours: hours,
    },
  };
}

function buildRangeFromWeeks(weeks: number): { from: Date; to: Date; range: SummaryRange } {
  if (!Number.isInteger(weeks) || weeks < 1 || weeks > 12) {
    throw AppError.badRequest('Parâmetro weeks inválido');
  }

  const to = new Date();
  const from = new Date(to);
  from.setDate(from.getDate() - weeks * 7);

  return {
    from,
    to,
    range: {
      from: from.toISOString(),
      to: to.toISOString(),
      weeks,
    },
  };
}

export class AdminSummaryService {
  /**
   * Summary for last X hours
   */
  static async getDailySummary(window: string): Promise<AdminSummaryPayload> {
    const { from, range } = buildRangeFromHours(window);

    const [
      users,
      babies,
      invitesAccepted,
      growthRecords,
      milestones,
      vaccinesApplied,
      apiErrors4xx,
      apiErrors5xx,
      billingFailedEvents,
      billingUnprocessedEvents,
    ] = await Promise.all([
      prisma.user.count({ where: { createdAt: { gte: from } } }),
      prisma.baby.count({ where: { createdAt: { gte: from } } }),
      prisma.babyInvite.count({
        where: {
          status: 'ACCEPTED',
          acceptedAt: { gte: from },
        },
      }),
      prisma.growth.count({ where: { createdAt: { gte: from } } }),
      prisma.milestone.count({ where: { createdAt: { gte: from } } }),
      prisma.babyVaccineRecord.count({
        where: {
          status: VaccineStatus.APPLIED,
          appliedAt: { gte: from },
        },
      }),
      prisma.apiEvent.count({
        where: {
          createdAt: { gte: from },
          statusCode: { gte: 400, lt: 500 },
        },
      }),
      prisma.apiEvent.count({
        where: {
          createdAt: { gte: from },
          statusCode: { gte: 500 },
        },
      }),
      prisma.billingEvent.count({
        where: {
          createdAt: { gte: from },
          errorMessage: { not: null },
        },
      }),
      prisma.billingEvent.count({
        where: {
          createdAt: { gte: from },
          processed: false,
        },
      }),
    ]);

    return {
      range,
      registrations: {
        users,
        babies,
        invitesAccepted,
      },
      events: {
        growthRecords,
        milestones,
        vaccinesApplied,
      },
      failures: {
        apiErrors4xx,
        apiErrors5xx,
        apiErrorsTotal: apiErrors4xx + apiErrors5xx,
        billingFailedEvents,
        billingUnprocessedEvents,
      },
    };
  }

  /**
   * Summary for last N weeks
   */
  static async getWeeklySummary(weeks: number): Promise<AdminSummaryPayload> {
    const { from, range } = buildRangeFromWeeks(weeks);

    const [
      users,
      babies,
      invitesAccepted,
      growthRecords,
      milestones,
      vaccinesApplied,
      apiErrors4xx,
      apiErrors5xx,
      billingFailedEvents,
      billingUnprocessedEvents,
    ] = await Promise.all([
      prisma.user.count({ where: { createdAt: { gte: from } } }),
      prisma.baby.count({ where: { createdAt: { gte: from } } }),
      prisma.babyInvite.count({
        where: {
          status: 'ACCEPTED',
          acceptedAt: { gte: from },
        },
      }),
      prisma.growth.count({ where: { createdAt: { gte: from } } }),
      prisma.milestone.count({ where: { createdAt: { gte: from } } }),
      prisma.babyVaccineRecord.count({
        where: {
          status: VaccineStatus.APPLIED,
          appliedAt: { gte: from },
        },
      }),
      prisma.apiEvent.count({
        where: {
          createdAt: { gte: from },
          statusCode: { gte: 400, lt: 500 },
        },
      }),
      prisma.apiEvent.count({
        where: {
          createdAt: { gte: from },
          statusCode: { gte: 500 },
        },
      }),
      prisma.billingEvent.count({
        where: {
          createdAt: { gte: from },
          errorMessage: { not: null },
        },
      }),
      prisma.billingEvent.count({
        where: {
          createdAt: { gte: from },
          processed: false,
        },
      }),
    ]);

    return {
      range,
      registrations: {
        users,
        babies,
        invitesAccepted,
      },
      events: {
        growthRecords,
        milestones,
        vaccinesApplied,
      },
      failures: {
        apiErrors4xx,
        apiErrors5xx,
        apiErrorsTotal: apiErrors4xx + apiErrors5xx,
        billingFailedEvents,
        billingUnprocessedEvents,
      },
    };
  }

  /**
   * Ops summary for last X hours
   */
  static async getOpsSummary(window: string): Promise<AdminOpsSummaryPayload> {
    const { from, range } = buildRangeFromHours(window);

    const [apiErrors4xx, apiErrors5xx, billingFailedEvents, billingUnprocessedEvents] =
      await Promise.all([
        prisma.apiEvent.count({
          where: {
            createdAt: { gte: from },
            statusCode: { gte: 400, lt: 500 },
          },
        }),
        prisma.apiEvent.count({
          where: {
            createdAt: { gte: from },
            statusCode: { gte: 500 },
          },
        }),
        prisma.billingEvent.count({
          where: {
            createdAt: { gte: from },
            errorMessage: { not: null },
          },
        }),
        prisma.billingEvent.count({
          where: {
            createdAt: { gte: from },
            processed: false,
          },
        }),
      ]);

    return {
      range,
      errors: {
        total: apiErrors4xx + apiErrors5xx,
        count4xx: apiErrors4xx,
        count5xx: apiErrors5xx,
      },
      billing: {
        failedEvents: billingFailedEvents,
        unprocessedEvents: billingUnprocessedEvents,
      },
    };
  }
}

// Olive Baby API - API Events Service
// Analytics and error tracking from api_events table
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface TopRouteByErrors {
  route: string;
  statusCode: number;
  count: number;
}

export interface TopUserByErrors {
  userId: number;
  email: string;
  fullName?: string;
  count: number;
}

export interface ErrorSpike {
  date: string;
  count: number;
  topRoutes: Array<{ route: string; count: number }>;
}

export interface ErrorsAnalytics {
  topRoutesByErrors: TopRouteByErrors[];
  topUsersByErrors: TopUserByErrors[];
  errorsByDay: Array<{ date: string; count4xx: number; count5xx: number }>;
  totalErrors: number;
  errorRate: number; // Percentage
}

export class ApiEventsService {
  /**
   * Get error analytics for admin dashboard
   */
  static async getErrorsAnalytics(
    range: '7d' | '30d' = '7d'
  ): Promise<ErrorsAnalytics> {
    const days = range === '7d' ? 7 : 30;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Top routes by errors (4xx/5xx)
    const topRoutesByErrors = await prisma.$queryRaw<
      Array<{ route: string; status_code: number; count: bigint }>
    >`
      SELECT route, status_code, COUNT(*) as count
      FROM api_events
      WHERE created_at >= ${startDate}
        AND status_code >= 400
      GROUP BY route, status_code
      ORDER BY count DESC
      LIMIT 20
    `;

    // Top users by errors
    const topUsersByErrors = await prisma.$queryRaw<
      Array<{ user_id: number; email: string; full_name: string | null; count: bigint }>
    >`
      SELECT 
        ae.user_id,
        u.email,
        c.full_name,
        COUNT(*) as count
      FROM api_events ae
      INNER JOIN users u ON u.id = ae.user_id
      LEFT JOIN caregivers c ON c.user_id = u.id
      WHERE ae.created_at >= ${startDate}
        AND ae.status_code >= 400
        AND ae.user_id IS NOT NULL
      GROUP BY ae.user_id, u.email, c.full_name
      ORDER BY count DESC
      LIMIT 10
    `;

    // Errors by day
    const errorsByDay = await prisma.$queryRaw<
      Array<{ date: Date; count_4xx: bigint; count_5xx: bigint }>
    >`
      SELECT 
        DATE(created_at) as date,
        SUM(CASE WHEN status_code >= 400 AND status_code < 500 THEN 1 ELSE 0 END) as count_4xx,
        SUM(CASE WHEN status_code >= 500 THEN 1 ELSE 0 END) as count_5xx
      FROM api_events
      WHERE created_at >= ${startDate}
        AND status_code >= 400
      GROUP BY DATE(created_at)
      ORDER BY date ASC
    `;

    // Total errors count
    const totalErrors = await prisma.apiEvent.count({
      where: {
        createdAt: { gte: startDate },
        statusCode: { gte: 400 },
      },
    });

    // Total requests count (estimate from api_events logged)
    // Note: We only log errors, so we need a different metric for total requests
    // For now, we'll estimate based on total events
    const totalEvents = await prisma.apiEvent.count({
      where: {
        createdAt: { gte: startDate },
      },
    });

    const errorRate = totalEvents > 0 ? (totalErrors / totalEvents) * 100 : 0;

    return {
      topRoutesByErrors: topRoutesByErrors.map(r => ({
        route: r.route,
        statusCode: Number(r.status_code),
        count: Number(r.count),
      })),
      topUsersByErrors: topUsersByErrors.map(u => ({
        userId: u.user_id,
        email: u.email,
        fullName: u.full_name || undefined,
        count: Number(u.count),
      })),
      errorsByDay: errorsByDay.map(d => ({
        date: d.date.toISOString().split('T')[0],
        count4xx: Number(d.count_4xx),
        count5xx: Number(d.count_5xx),
      })),
      totalErrors,
      errorRate,
    };
  }

  /**
   * Get slow request analytics
   */
  static async getSlowRequestsAnalytics(range: '7d' | '30d' = '7d') {
    const days = range === '7d' ? 7 : 30;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const slowRequests = await prisma.$queryRaw<
      Array<{ route: string; avg_duration: number; max_duration: number; count: bigint }>
    >`
      SELECT 
        route,
        AVG(duration_ms) as avg_duration,
        MAX(duration_ms) as max_duration,
        COUNT(*) as count
      FROM api_events
      WHERE created_at >= ${startDate}
        AND duration_ms >= 2000
      GROUP BY route
      ORDER BY avg_duration DESC
      LIMIT 20
    `;

    return slowRequests.map(r => ({
      route: r.route,
      avgDurationMs: Math.round(Number(r.avg_duration)),
      maxDurationMs: Number(r.max_duration),
      count: Number(r.count),
    }));
  }
}


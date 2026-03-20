// OlieCare API - Email Data Controller
// Provides dynamic data endpoints for email templates
import { Response } from 'express';
import { AuthenticatedRequest } from '../types';
import { prisma } from '../config/database';
import { logger } from '../config/logger';

/**
 * GET /api/v1/users/:id/stats
 * Get user statistics for email templates
 */
export async function getUserStats(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = parseInt(req.params.id);
    const authenticatedUserId = req.user?.userId;

    // Verify user can access this data
    if (authenticatedUserId !== userId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        babies: {
          include: {
            routines: {
              take: 1,
              orderBy: { createdAt: 'desc' },
            },
          },
        },
      },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Count total routines
    const totalRoutines = await prisma.routine.count({
      where: {
        baby: {
          userId: userId,
        },
      },
    });

    // Count days active (days since first routine)
    const firstRoutine = await prisma.routine.findFirst({
      where: {
        baby: {
          userId: userId,
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    const daysActive = firstRoutine
      ? Math.floor((Date.now() - firstRoutine.createdAt.getTime()) / (1000 * 60 * 60 * 24))
      : 0;

    // Count babies
    const babiesCount = user.babies.length;

    res.json({
      userId: user.id,
      userName: user.name,
      totalRoutines,
      daysActive,
      babiesCount,
      babies: user.babies.map(baby => ({
        id: baby.id,
        name: baby.name,
        birthDate: baby.birthDate,
      })),
    });
  } catch (error: any) {
    logger.error('Failed to get user stats', { error: error.message });
    res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * GET /api/v1/babies/:id/insights
 * Get baby insights for email templates
 */
export async function getBabyInsights(req: AuthenticatedRequest, res: Response) {
  try {
    const babyId = parseInt(req.params.id);
    const authenticatedUserId = req.user?.userId;

    const baby = await prisma.baby.findUnique({
      where: { id: babyId },
      include: {
        user: true,
        routines: {
          take: 100,
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!baby) {
      return res.status(404).json({ error: 'Baby not found' });
    }

    // Verify user can access this baby
    if (baby.userId !== authenticatedUserId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    // Calculate basic insights
    const routines = baby.routines;
    const feedingCount = routines.filter(r => r.type === 'FEEDING').length;
    const sleepCount = routines.filter(r => r.type === 'SLEEP').length;
    const diaperCount = routines.filter(r => r.type === 'DIAPER').length;

    // Simple insight generation
    const insights: string[] = [];
    
    if (routines.length > 0) {
      insights.push(`Você registrou ${routines.length} rotinas para ${baby.name}.`);
    }
    
    if (feedingCount > 0) {
      insights.push(`Total de ${feedingCount} mamadas registradas.`);
    }
    
    if (sleepCount > 0) {
      insights.push(`Total de ${sleepCount} períodos de sono registrados.`);
    }

    res.json({
      babyId: baby.id,
      babyName: baby.name,
      insights: insights.length > 0 ? insights.join(' ') : 'Continue registrando para receber insights personalizados!',
      routineCount: routines.length,
      feedingCount,
      sleepCount,
      diaperCount,
    });
  } catch (error: any) {
    logger.error('Failed to get baby insights', { error: error.message });
    res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * GET /api/v1/users/:id/milestones
 * Get user milestones for email templates
 */
export async function getUserMilestones(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = parseInt(req.params.id);
    const authenticatedUserId = req.user?.userId;

    if (authenticatedUserId !== userId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const totalRoutines = await prisma.routine.count({
      where: {
        baby: {
          userId: userId,
        },
      },
    });

    const firstRoutine = await prisma.routine.findFirst({
      where: {
        baby: {
          userId: userId,
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    const daysActive = firstRoutine
      ? Math.floor((Date.now() - firstRoutine.createdAt.getTime()) / (1000 * 60 * 60 * 24))
      : 0;

    const milestones: Array<{ name: string; achieved: boolean; badge: string }> = [];

    // Define milestones
    if (totalRoutines >= 10) {
      milestones.push({ name: '10 rotinas registradas', achieved: true, badge: '🎯' });
    }
    if (totalRoutines >= 50) {
      milestones.push({ name: '50 rotinas registradas', achieved: true, badge: '🌟' });
    }
    if (totalRoutines >= 100) {
      milestones.push({ name: '100 rotinas registradas', achieved: true, badge: '🏆' });
    }
    if (daysActive >= 7) {
      milestones.push({ name: '7 dias de uso', achieved: true, badge: '📅' });
    }
    if (daysActive >= 30) {
      milestones.push({ name: '30 dias de uso', achieved: true, badge: '📆' });
    }
    if (daysActive >= 365) {
      milestones.push({ name: '1 ano de uso', achieved: true, badge: '🎂' });
    }

    // Get next milestone
    let nextMilestone: string | null = null;
    if (totalRoutines < 10) {
      nextMilestone = '10 rotinas registradas';
    } else if (totalRoutines < 50) {
      nextMilestone = '50 rotinas registradas';
    } else if (totalRoutines < 100) {
      nextMilestone = '100 rotinas registradas';
    }

    res.json({
      userId,
      totalRoutines,
      daysActive,
      milestones,
      nextMilestone,
    });
  } catch (error: any) {
    logger.error('Failed to get user milestones', { error: error.message });
    res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * GET /api/v1/users/:id/weekly-summary
 * Get weekly summary for email templates
 */
export async function getWeeklySummary(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = parseInt(req.params.id);
    const authenticatedUserId = req.user?.userId;

    if (authenticatedUserId !== userId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

    // Get routines from last week
    const routinesThisWeek = await prisma.routine.findMany({
      where: {
        baby: {
          userId: userId,
        },
        createdAt: {
          gte: weekAgo,
        },
      },
    });

    // Get routines from previous week for comparison
    const routinesLastWeek = await prisma.routine.findMany({
      where: {
        baby: {
          userId: userId,
        },
        createdAt: {
          gte: twoWeeksAgo,
          lt: weekAgo,
        },
      },
    });

    const feedingCount = routinesThisWeek.filter(r => r.type === 'FEEDING').length;
    const sleepCount = routinesThisWeek.filter(r => r.type === 'SLEEP').length;
    const diaperCount = routinesThisWeek.filter(r => r.type === 'DIAPER').length;

    // Calculate average sleep hours (simplified)
    const sleepRoutines = routinesThisWeek.filter(r => r.type === 'SLEEP');
    const totalSleepMinutes = sleepRoutines.reduce((sum, r) => {
      const duration = r.durationMinutes || 0;
      return sum + duration;
    }, 0);
    const sleepHours = Math.round((totalSleepMinutes / 60) * 10) / 10;

    // Comparison with last week
    const routineChange = routinesThisWeek.length - routinesLastWeek.length;
    const sleepChange = sleepCount - routinesLastWeek.filter(r => r.type === 'SLEEP').length;
    const feedingChange = feedingCount - routinesLastWeek.filter(r => r.type === 'FEEDING').length;

    // Generate highlight
    let highlight = `Você registrou ${routinesThisWeek.length} rotinas esta semana!`;
    if (feedingCount > 0) {
      highlight += ` Total de ${feedingCount} mamadas.`;
    }
    if (sleepHours > 0) {
      highlight += ` ${sleepHours} horas de sono registradas.`;
    }

    res.json({
      userId,
      weekStart: weekAgo.toISOString(),
      weekEnd: now.toISOString(),
      totalRoutines: routinesThisWeek.length,
      feedingCount,
      sleepCount,
      sleepHours,
      diaperCount,
      highlight,
      comparison: {
        hasComparison: routinesLastWeek.length > 0,
        routineChange: routineChange > 0 ? `+${routineChange}` : routineChange.toString(),
        sleepChange: sleepChange > 0 ? `+${sleepChange}` : sleepChange.toString(),
        feedingChange: feedingChange > 0 ? `+${feedingChange}` : feedingChange.toString(),
      },
    });
  } catch (error: any) {
    logger.error('Failed to get weekly summary', { error: error.message });
    res.status(500).json({ error: 'Internal server error' });
  }
}

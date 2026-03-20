import { Response } from 'express';
import { AuthenticatedRequest } from '../types';
import { prisma } from '../config/database';
import { logger } from '../config/logger';

export async function getUserStats(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = parseInt(req.params.id);
    const authUser = req.user;

    if (authUser?.role !== 'ADMIN' && authUser?.userId !== userId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { caregiver: true },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const babyMembers = await prisma.babyMember.findMany({
      where: { userId, status: 'ACTIVE' },
      select: { babyId: true, baby: { select: { id: true, name: true, birthDate: true } } },
    });

    const validMembers = babyMembers.filter(bm => bm.baby != null);
    const babyIds = validMembers.map(bm => bm.babyId);

    const totalRoutines = babyIds.length > 0
      ? await prisma.routineLog.count({ where: { babyId: { in: babyIds } } })
      : 0;

    const firstRoutine = babyIds.length > 0
      ? await prisma.routineLog.findFirst({
          where: { babyId: { in: babyIds } },
          orderBy: { createdAt: 'asc' },
        })
      : null;

    const daysActive = firstRoutine
      ? Math.floor((Date.now() - firstRoutine.createdAt.getTime()) / (1000 * 60 * 60 * 24))
      : 0;

    res.json({
      userId: user.id,
      userName: user.caregiver?.fullName || user.email,
      totalRoutines,
      daysActive,
      babiesCount: validMembers.length,
      babies: validMembers.map(bm => ({
        id: bm.baby!.id,
        name: bm.baby!.name,
        birthDate: bm.baby!.birthDate,
      })),
    });
  } catch (error: any) {
    logger.error('Failed to get user stats', { error: error.message });
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function getBabyInsights(req: AuthenticatedRequest, res: Response) {
  try {
    const babyId = parseInt(req.params.id);
    const authUser = req.user;

    const baby = await prisma.baby.findUnique({
      where: { id: babyId },
      include: {
        members: {
          where: { status: 'ACTIVE' },
          select: { userId: true },
        },
        routineLogs: {
          take: 100,
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!baby) {
      return res.status(404).json({ error: 'Baby not found' });
    }

    const memberUserIds = baby.members.map(m => m.userId);
    if (authUser?.role !== 'ADMIN' && !memberUserIds.includes(authUser?.userId ?? -1)) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const routines = baby.routineLogs;
    const feedingCount = routines.filter(r => r.routineType === 'FEEDING').length;
    const sleepCount = routines.filter(r => r.routineType === 'SLEEP').length;
    const diaperCount = routines.filter(r => r.routineType === 'DIAPER').length;

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

export async function getUserMilestones(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = parseInt(req.params.id);
    const authUser = req.user;

    if (authUser?.role !== 'ADMIN' && authUser?.userId !== userId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const babyMembers = await prisma.babyMember.findMany({
      where: { userId, status: 'ACTIVE' },
      select: { babyId: true },
    });
    const babyIds = babyMembers.map(bm => bm.babyId);

    const totalRoutines = babyIds.length > 0
      ? await prisma.routineLog.count({ where: { babyId: { in: babyIds } } })
      : 0;

    const firstRoutine = babyIds.length > 0
      ? await prisma.routineLog.findFirst({
          where: { babyId: { in: babyIds } },
          orderBy: { createdAt: 'asc' },
        })
      : null;

    const daysActive = firstRoutine
      ? Math.floor((Date.now() - firstRoutine.createdAt.getTime()) / (1000 * 60 * 60 * 24))
      : 0;

    const milestones: Array<{ name: string; achieved: boolean; badge: string }> = [];

    if (totalRoutines >= 10)  milestones.push({ name: '10 rotinas registradas', achieved: true, badge: '🎯' });
    if (totalRoutines >= 50)  milestones.push({ name: '50 rotinas registradas', achieved: true, badge: '🌟' });
    if (totalRoutines >= 100) milestones.push({ name: '100 rotinas registradas', achieved: true, badge: '🏆' });
    if (daysActive >= 7)   milestones.push({ name: '7 dias de uso', achieved: true, badge: '📅' });
    if (daysActive >= 30)  milestones.push({ name: '30 dias de uso', achieved: true, badge: '📆' });
    if (daysActive >= 365) milestones.push({ name: '1 ano de uso', achieved: true, badge: '🎂' });

    let nextMilestone: string | null = null;
    if (totalRoutines < 10)       nextMilestone = '10 rotinas registradas';
    else if (totalRoutines < 50)  nextMilestone = '50 rotinas registradas';
    else if (totalRoutines < 100) nextMilestone = '100 rotinas registradas';

    res.json({ userId, totalRoutines, daysActive, milestones, nextMilestone });
  } catch (error: any) {
    logger.error('Failed to get user milestones', { error: error.message });
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function getWeeklySummary(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = parseInt(req.params.id);
    const authUser = req.user;

    if (authUser?.role !== 'ADMIN' && authUser?.userId !== userId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

    const babyMembers = await prisma.babyMember.findMany({
      where: { userId, status: 'ACTIVE' },
      select: { babyId: true },
    });
    const babyIds = babyMembers.map(bm => bm.babyId);

    const routinesThisWeek = babyIds.length > 0
      ? await prisma.routineLog.findMany({
          where: { babyId: { in: babyIds }, createdAt: { gte: weekAgo } },
        })
      : [];

    const routinesLastWeek = babyIds.length > 0
      ? await prisma.routineLog.findMany({
          where: { babyId: { in: babyIds }, createdAt: { gte: twoWeeksAgo, lt: weekAgo } },
        })
      : [];

    const feedingCount = routinesThisWeek.filter(r => r.routineType === 'FEEDING').length;
    const sleepCount = routinesThisWeek.filter(r => r.routineType === 'SLEEP').length;
    const diaperCount = routinesThisWeek.filter(r => r.routineType === 'DIAPER').length;

    const sleepRoutines = routinesThisWeek.filter(r => r.routineType === 'SLEEP');
    const totalSleepSeconds = sleepRoutines.reduce((sum, r) => sum + (r.durationSeconds || 0), 0);
    const sleepHours = Math.round((totalSleepSeconds / 3600) * 10) / 10;

    const routineChange = routinesThisWeek.length - routinesLastWeek.length;
    const sleepChange = sleepCount - routinesLastWeek.filter(r => r.routineType === 'SLEEP').length;
    const feedingChange = feedingCount - routinesLastWeek.filter(r => r.routineType === 'FEEDING').length;

    let highlight = `Você registrou ${routinesThisWeek.length} rotinas esta semana!`;
    if (feedingCount > 0) highlight += ` Total de ${feedingCount} mamadas.`;
    if (sleepHours > 0)   highlight += ` ${sleepHours} horas de sono registradas.`;

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

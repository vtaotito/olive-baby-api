// Olive Baby API - Appointment Controller
import { Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { AppointmentService, ScheduleService } from '../services/appointment.service';
import { AppError } from '../utils/errors/AppError';
import { AuthenticatedRequest } from '../types';

const prisma = new PrismaClient();

async function getProfessionalId(userId: number): Promise<number> {
  const prof = await prisma.professional.findUnique({ where: { userId } });
  if (!prof) throw new AppError('Profissional não encontrado', 404);
  return prof.id;
}

export async function createAppointment(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const professionalId = await getProfessionalId(req.user!.userId);
    const data = {
      ...req.body,
      babyId: parseInt(req.body.babyId),
      professionalId,
      startAt: new Date(req.body.startAt),
      endAt: req.body.endAt ? new Date(req.body.endAt) : undefined,
      bookedByUserId: req.user!.userId,
    };
    const appointment = await AppointmentService.create(data);
    res.status(201).json({ success: true, data: appointment });
  } catch (e) {
    next(e);
  }
}

export async function listAppointments(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const professionalId = await getProfessionalId(req.user!.userId);
    const startDate = req.query.startDate ? new Date(req.query.startDate as string) : new Date();
    const endDate = req.query.endDate ? new Date(req.query.endDate as string) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const clinicId = req.query.clinicId ? parseInt(req.query.clinicId as string) : undefined;
    const appointments = await AppointmentService.listForProfessional(professionalId, {
      startDate,
      endDate,
      clinicId,
    });
    res.json({ success: true, data: appointments });
  } catch (e) {
    next(e);
  }
}

export async function getAppointment(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const id = parseInt(req.params.id);
    const professionalId = await getProfessionalId(req.user!.userId);
    const appointment = await AppointmentService.getById(id, professionalId);
    res.json({ success: true, data: appointment });
  } catch (e) {
    next(e);
  }
}

export async function updateAppointmentStatus(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const id = parseInt(req.params.id);
    const professionalId = await getProfessionalId(req.user!.userId);
    const { status, visitId } = req.body;
    const appointment = await AppointmentService.updateStatus(id, status, professionalId, visitId);
    res.json({ success: true, data: appointment });
  } catch (e) {
    next(e);
  }
}

export async function cancelAppointment(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const id = parseInt(req.params.id);
    const professionalId = await getProfessionalId(req.user!.userId);
    const { reason } = req.body;
    await AppointmentService.cancel(id, professionalId, reason);
    res.json({ success: true, message: 'Agendamento cancelado' });
  } catch (e) {
    next(e);
  }
}

export async function getAvailableSlots(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const professionalId = await getProfessionalId(req.user!.userId);
    const date = req.query.date ? new Date(req.query.date as string) : new Date();
    const duration = req.query.duration ? parseInt(req.query.duration as string) : 30;
    const clinicId = req.query.clinicId ? parseInt(req.query.clinicId as string) : undefined;
    const slots = await AppointmentService.getAvailableSlots(professionalId, date, duration, clinicId);
    res.json({ success: true, data: slots });
  } catch (e) {
    next(e);
  }
}

export async function getSchedule(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const professionalId = await getProfessionalId(req.user!.userId);
    const clinicId = req.query.clinicId ? parseInt(req.query.clinicId as string) : undefined;
    const schedule = await ScheduleService.getSchedule(professionalId, clinicId);
    res.json({ success: true, data: schedule });
  } catch (e) {
    next(e);
  }
}

export async function upsertSchedule(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const professionalId = await getProfessionalId(req.user!.userId);
    const data = { ...req.body, professionalId };
    const schedule = await ScheduleService.upsertSchedule(professionalId, data);
    res.json({ success: true, data: schedule });
  } catch (e) {
    next(e);
  }
}

export async function createException(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const professionalId = await getProfessionalId(req.user!.userId);
    const data = {
      ...req.body,
      professionalId,
      exceptionDate: new Date(req.body.exceptionDate),
    };
    const ex = await ScheduleService.createException(professionalId, data);
    res.status(201).json({ success: true, data: ex });
  } catch (e) {
    next(e);
  }
}

export async function listExceptions(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const professionalId = await getProfessionalId(req.user!.userId);
    const startDate = req.query.startDate ? new Date(req.query.startDate as string) : new Date();
    const endDate = req.query.endDate ? new Date(req.query.endDate as string) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    const exceptions = await ScheduleService.listExceptions(professionalId, startDate, endDate);
    res.json({ success: true, data: exceptions });
  } catch (e) {
    next(e);
  }
}

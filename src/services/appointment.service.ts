// Olive Baby API - Appointment & Schedule Service
import { prisma } from '../config/database';
import { AppError } from '../utils/errors/AppError';
import { AppointmentStatus, AppointmentType } from '@prisma/client';
import { addMinutes, parse, format, startOfDay, endOfDay, addDays, isWithinInterval, setHours, setMinutes } from 'date-fns';

export interface CreateAppointmentInput {
  babyId: number;
  professionalId: number;
  clinicId?: number;
  startAt: Date;
  endAt?: Date;
  durationMinutes?: number;
  type?: AppointmentType;
  title?: string;
  notes?: string;
  bookedByUserId?: number;
  source?: string;
}

export interface CreateScheduleInput {
  professionalId: number;
  clinicId?: number;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  slotDuration?: number;
}

export interface CreateExceptionInput {
  professionalId: number;
  clinicId?: number;
  exceptionDate: Date;
  type: 'BLOCKED' | 'REDUCED_HOURS' | 'HOLIDAY';
  startTime?: string;
  endTime?: string;
  reason?: string;
}

async function ensureProfessionalHasAccess(professionalId: number, babyId: number) {
  const link = await prisma.babyProfessional.findFirst({
    where: { babyId, professionalId },
  });
  if (!link) throw AppError.forbidden('Você não tem acesso a este paciente');
}

export class AppointmentService {
  static async create(data: CreateAppointmentInput) {
    await ensureProfessionalHasAccess(data.professionalId, data.babyId);

    const duration = data.durationMinutes ?? 30;
    const endAt = data.endAt ?? addMinutes(data.startAt, duration);

    const overlapping = await prisma.appointment.findFirst({
      where: {
        professionalId: data.professionalId,
        status: { notIn: ['CANCELLED', 'NO_SHOW'] },
        OR: [
          {
            startAt: { lt: endAt },
            endAt: { gt: data.startAt },
          },
        ],
      },
    });
    if (overlapping) throw AppError.conflict('Já existe um agendamento neste horário');

    const baby = await prisma.baby.findUnique({ where: { id: data.babyId } });
    const title = data.title ?? `${baby?.name ?? 'Paciente'} - Consulta`;

    return prisma.appointment.create({
      data: {
        babyId: data.babyId,
        professionalId: data.professionalId,
        clinicId: data.clinicId,
        startAt: data.startAt,
        endAt,
        durationMinutes: duration,
        type: data.type ?? 'CONSULTA_ROTINA',
        status: 'SCHEDULED',
        title,
        notes: data.notes,
        bookedByUserId: data.bookedByUserId,
        source: data.source ?? 'APP',
      },
      include: {
        baby: { select: { id: true, name: true, birthDate: true } },
      },
    });
  }

  static async listForProfessional(
    professionalId: number,
    opts: { startDate: Date; endDate: Date; clinicId?: number; status?: AppointmentStatus[] }
  ) {
    const where: any = {
      professionalId,
      startAt: { gte: opts.startDate },
      endAt: { lte: opts.endDate },
    };
    if (opts.clinicId) where.clinicId = opts.clinicId;
    if (opts.status?.length) where.status = { in: opts.status };

    return prisma.appointment.findMany({
      where,
      orderBy: { startAt: 'asc' },
      include: {
        baby: { select: { id: true, name: true, birthDate: true } },
      },
    });
  }

  static async getById(id: number, professionalId: number) {
    const apt = await prisma.appointment.findUnique({
      where: { id },
      include: { baby: true, visit: true },
    });
    if (!apt) throw AppError.notFound('Agendamento não encontrado');
    if (apt.professionalId !== professionalId) throw AppError.forbidden('Acesso negado');
    return apt;
  }

  static async updateStatus(id: number, status: AppointmentStatus, professionalId: number, visitId?: number) {
    const apt = await this.getById(id, professionalId);

    return prisma.appointment.update({
      where: { id },
      data: {
        status,
        visitId: visitId ?? apt.visitId,
        cancelledAt: status === 'CANCELLED' ? new Date() : undefined,
      },
      include: { baby: true },
    });
  }

  static async cancel(id: number, professionalId: number, reason?: string) {
    return prisma.appointment.update({
      where: { id },
      data: {
        status: 'CANCELLED',
        cancellationReason: reason,
        cancelledAt: new Date(),
      },
    });
  }

  static async getAvailableSlots(
    professionalId: number,
    date: Date,
    durationMinutes: number = 30,
    clinicId?: number
  ) {
    const dayOfWeek = date.getDay();
    const dateStr = format(date, 'yyyy-MM-dd');

    const schedules = await prisma.professionalSchedule.findMany({
      where: {
        professionalId,
        clinicId: clinicId ?? null,
        dayOfWeek,
        isActive: true,
      },
    });

    const exceptions = await prisma.scheduleException.findMany({
      where: {
        professionalId,
        clinicId: clinicId ?? null,
        exceptionDate: date,
      },
    });

    const blocked = exceptions.filter((e) => e.type === 'BLOCKED');
    if (blocked.length) return [];

    const existing = await prisma.appointment.findMany({
      where: {
        professionalId,
        startAt: { gte: startOfDay(date) },
        endAt: { lte: endOfDay(date) },
        status: { notIn: ['CANCELLED', 'NO_SHOW'] },
      },
    });

    const slots: { start: Date; end: Date }[] = [];

    for (const s of schedules) {
      const start = parse(s.startTime, 'HH:mm', date);
      const end = parse(s.endTime, 'HH:mm', date);

      let current = start;
      while (addMinutes(current, durationMinutes) <= end) {
        const slotEnd = addMinutes(current, durationMinutes);
        const overlaps = existing.some(
          (e) =>
            (current >= e.startAt && current < e.endAt) ||
            (slotEnd > e.startAt && slotEnd <= e.endAt) ||
            (current <= e.startAt && slotEnd >= e.endAt)
        );
        if (!overlaps && current >= new Date()) {
          slots.push({ start: new Date(current), end: new Date(slotEnd) });
        }
        current = addMinutes(current, durationMinutes);
      }
    }

    return slots;
  }
}

export class ScheduleService {
  static async upsertSchedule(professionalId: number, data: CreateScheduleInput) {
    const existing = await prisma.professionalSchedule.findFirst({
      where: {
        professionalId,
        clinicId: data.clinicId ?? null,
        dayOfWeek: data.dayOfWeek,
      },
    });

    const payload = {
      professionalId,
      clinicId: data.clinicId,
      dayOfWeek: data.dayOfWeek,
      startTime: data.startTime,
      endTime: data.endTime,
      slotDuration: data.slotDuration ?? 30,
      isActive: true,
    };

    if (existing) {
      return prisma.professionalSchedule.update({
        where: { id: existing.id },
        data: payload,
      });
    }
    return prisma.professionalSchedule.create({ data: payload });
  }

  static async getSchedule(professionalId: number, clinicId?: number) {
    return prisma.professionalSchedule.findMany({
      where: {
        professionalId,
        clinicId: clinicId ?? null,
        isActive: true,
      },
      orderBy: { dayOfWeek: 'asc' },
    });
  }

  static async createException(professionalId: number, data: CreateExceptionInput) {
    return prisma.scheduleException.create({
      data: {
        professionalId,
        clinicId: data.clinicId,
        exceptionDate: data.exceptionDate,
        type: data.type,
        startTime: data.startTime,
        endTime: data.endTime,
        reason: data.reason,
      },
    });
  }

  static async listExceptions(professionalId: number, startDate: Date, endDate: Date) {
    return prisma.scheduleException.findMany({
      where: {
        professionalId,
        exceptionDate: { gte: startDate, lte: endDate },
      },
    });
  }
}

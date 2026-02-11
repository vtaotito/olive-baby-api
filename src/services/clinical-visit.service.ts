// Olive Baby API - Clinical Visit Service
import { prisma } from '../config/database';
import { AppError } from '../utils/errors/AppError';
import { VisitType } from '@prisma/client';

export interface CreateVisitInput {
  babyId: number;
  professionalId: number;
  clinicId?: number;
  visitDate: Date;
  visitType: VisitType;
  chiefComplaint?: string;
  history?: string;
  physicalExam?: string;
  assessment?: string;
  plan?: string;
  weightKg?: number;
  heightCm?: number;
  headCircumferenceCm?: number;
  nextVisitDate?: Date;
}

export interface UpdateVisitInput {
  visitDate?: Date;
  visitType?: VisitType;
  chiefComplaint?: string;
  history?: string;
  physicalExam?: string;
  assessment?: string;
  plan?: string;
  weightKg?: number;
  heightCm?: number;
  headCircumferenceCm?: number;
  nextVisitDate?: Date;
}

export class ClinicalVisitService {
  static async ensureProfessionalHasAccessToBaby(professionalId: number, babyId: number) {
    const link = await prisma.babyProfessional.findFirst({
      where: { babyId, professionalId },
    });
    if (!link) throw AppError.forbidden('Você não tem acesso a este paciente');
    return link;
  }

  static async create(data: CreateVisitInput) {
    await this.ensureProfessionalHasAccessToBaby(data.professionalId, data.babyId);

    const visit = await prisma.clinicalVisit.create({
      data: {
        babyId: data.babyId,
        professionalId: data.professionalId,
        clinicId: data.clinicId,
        visitDate: data.visitDate,
        visitType: data.visitType,
        chiefComplaint: data.chiefComplaint,
        history: data.history,
        physicalExam: data.physicalExam,
        assessment: data.assessment,
        plan: data.plan,
        weightKg: data.weightKg,
        heightCm: data.heightCm,
        headCircumferenceCm: data.headCircumferenceCm,
        nextVisitDate: data.nextVisitDate,
      },
      include: {
        baby: { select: { id: true, name: true, birthDate: true } },
        professional: { select: { id: true, fullName: true } },
      },
    });

    if (data.weightKg || data.heightCm || data.headCircumferenceCm) {
      await prisma.growth.create({
        data: {
          babyId: data.babyId,
          measuredAt: data.visitDate,
          weightKg: data.weightKg,
          heightCm: data.heightCm,
          headCircumferenceCm: data.headCircumferenceCm,
          source: 'clinical_visit',
          notes: `Consulta ${data.visitType}`,
        },
      });
    }

    return visit;
  }

  static async getById(id: number, professionalId: number) {
    const visit = await prisma.clinicalVisit.findUnique({
      where: { id },
      include: {
        baby: true,
        professional: true,
        clinic: true,
      },
    });
    if (!visit) throw AppError.notFound('Consulta não encontrada');
    await this.ensureProfessionalHasAccessToBaby(professionalId, visit.babyId);
    return visit;
  }

  static async listByBaby(babyId: number, professionalId: number, opts?: { limit?: number; offset?: number }) {
    await this.ensureProfessionalHasAccessToBaby(professionalId, babyId);

    const visits = await prisma.clinicalVisit.findMany({
      where: { babyId },
      orderBy: { visitDate: 'desc' },
      take: opts?.limit ?? 50,
      skip: opts?.offset ?? 0,
      include: {
        professional: { select: { id: true, fullName: true } },
      },
    });
    const total = await prisma.clinicalVisit.count({ where: { babyId } });
    return { data: visits, total };
  }

  static async update(id: number, data: UpdateVisitInput, professionalId: number) {
    const visit = await prisma.clinicalVisit.findUnique({ where: { id } });
    if (!visit) throw AppError.notFound('Consulta não encontrada');
    await this.ensureProfessionalHasAccessToBaby(professionalId, visit.babyId);

    return prisma.clinicalVisit.update({
      where: { id },
      data,
      include: { baby: true, professional: true },
    });
  }

  static async delete(id: number, professionalId: number) {
    const visit = await prisma.clinicalVisit.findUnique({ where: { id } });
    if (!visit) throw AppError.notFound('Consulta não encontrada');
    await this.ensureProfessionalHasAccessToBaby(professionalId, visit.babyId);

    await prisma.clinicalVisit.delete({ where: { id } });
    return { success: true };
  }
}

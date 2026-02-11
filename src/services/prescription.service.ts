// Olive Baby API - Prescription Service
import { prisma } from '../config/database';
import { AppError } from '../utils/errors/AppError';
import { ClinicalVisitService } from './clinical-visit.service';

export interface PrescriptionItem {
  medication: string;
  dose?: string;
  route?: string;
  posology?: string;
  duration?: string;
}

export interface CreatePrescriptionInput {
  babyId: number;
  professionalId: number;
  visitId?: number;
  prescriptionDate: Date;
  validUntil?: Date;
  items: PrescriptionItem[];
  instructions?: string;
}

export class PrescriptionService {
  static async create(data: CreatePrescriptionInput) {
    await ClinicalVisitService.ensureProfessionalHasAccessToBaby(data.professionalId, data.babyId);

    return prisma.prescription.create({
      data: {
        babyId: data.babyId,
        professionalId: data.professionalId,
        visitId: data.visitId,
        prescriptionDate: data.prescriptionDate,
        validUntil: data.validUntil,
        items: data.items as any,
        instructions: data.instructions,
      },
      include: {
        baby: { select: { id: true, name: true } },
        professional: { select: { id: true, fullName: true } },
      },
    });
  }

  static async listByBaby(babyId: number, professionalId: number) {
    await ClinicalVisitService.ensureProfessionalHasAccessToBaby(professionalId, babyId);

    return prisma.prescription.findMany({
      where: { babyId },
      orderBy: { prescriptionDate: 'desc' },
      include: {
        professional: { select: { fullName: true } },
      },
    });
  }

  static async getById(id: number, professionalId: number) {
    const rx = await prisma.prescription.findUnique({
      where: { id },
      include: { baby: true, professional: true, visit: true },
    });
    if (!rx) throw AppError.notFound('Receita não encontrada');
    await ClinicalVisitService.ensureProfessionalHasAccessToBaby(professionalId, rx.babyId);
    return rx;
  }
}

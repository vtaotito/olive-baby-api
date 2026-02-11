// Olive Baby API - Medical Certificate Service
import { prisma } from '../config/database';
import { AppError } from '../utils/errors/AppError';
import { ClinicalVisitService } from './clinical-visit.service';

export interface CreateCertificateInput {
  babyId: number;
  professionalId: number;
  type: string;
  content: string;
  validFrom: Date;
  validUntil?: Date;
}

export class MedicalCertificateService {
  static async create(data: CreateCertificateInput) {
    await ClinicalVisitService.ensureProfessionalHasAccessToBaby(data.professionalId, data.babyId);

    return prisma.medicalCertificate.create({
      data: {
        babyId: data.babyId,
        professionalId: data.professionalId,
        type: data.type,
        content: data.content,
        validFrom: data.validFrom,
        validUntil: data.validUntil,
      },
      include: {
        baby: { select: { id: true, name: true, birthDate: true } },
        professional: { select: { id: true, fullName: true, crmNumber: true, crmState: true } },
      },
    });
  }

  static async listByBaby(babyId: number, professionalId: number) {
    await ClinicalVisitService.ensureProfessionalHasAccessToBaby(professionalId, babyId);

    return prisma.medicalCertificate.findMany({
      where: { babyId },
      orderBy: { validFrom: 'desc' },
      include: {
        professional: { select: { fullName: true } },
      },
    });
  }

  static async getById(id: number, professionalId: number) {
    const cert = await prisma.medicalCertificate.findUnique({
      where: { id },
      include: { baby: true, professional: true },
    });
    if (!cert) throw AppError.notFound('Atestado não encontrado');
    await ClinicalVisitService.ensureProfessionalHasAccessToBaby(professionalId, cert.babyId);
    return cert;
  }
}

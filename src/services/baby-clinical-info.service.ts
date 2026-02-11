// Olive Baby API - Baby Clinical Info Service
import { prisma } from '../config/database';
import { AppError } from '../utils/errors/AppError';
import { ClinicalVisitService } from './clinical-visit.service';

export interface BabyClinicalInfoInput {
  allergies?: Array<{ substance: string; type?: string; severity?: string }>;
  chronicConditions?: string[];
  medications?: Array<{ name: string; dose?: string; duration?: string }>;
  familyHistory?: string;
  feedingNotes?: string;
}

export class BabyClinicalInfoService {
  static async getOrCreate(babyId: number, professionalId: number) {
    await ClinicalVisitService.ensureProfessionalHasAccessToBaby(professionalId, babyId);

    let info = await prisma.babyClinicalInfo.findUnique({
      where: { babyId },
    });

    if (!info) {
      info = await prisma.babyClinicalInfo.create({
        data: {
          babyId,
          allergies: [],
          chronicConditions: [],
          medications: [],
        },
      });
    }

    return info;
  }

  static async upsert(babyId: number, data: BabyClinicalInfoInput, professionalId: number) {
    await ClinicalVisitService.ensureProfessionalHasAccessToBaby(professionalId, babyId);

    return prisma.babyClinicalInfo.upsert({
      where: { babyId },
      update: data as any,
      create: {
        babyId,
        allergies: data.allergies ?? [],
        chronicConditions: data.chronicConditions ?? [],
        medications: data.medications ?? [],
        familyHistory: data.familyHistory,
        feedingNotes: data.feedingNotes,
      },
    });
  }
}

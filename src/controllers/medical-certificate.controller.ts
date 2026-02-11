// Olive Baby API - Medical Certificate Controller
import { Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import * as medicalCertificateService from '../services/medical-certificate.service';
import { AppError } from '../utils/errors/AppError';
import { AuthenticatedRequest } from '../types';

const prisma = new PrismaClient();

async function getProfessionalId(userId: number): Promise<number> {
  const prof = await prisma.professional.findUnique({ where: { userId } });
  if (!prof) throw new AppError('Profissional não encontrado', 404);
  return prof.id;
}

export async function createCertificate(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const professionalId = await getProfessionalId(req.user!.userId);
    const data = {
      ...req.body,
      babyId: parseInt(req.params.babyId),
      professionalId,
      validFrom: new Date(req.body.validFrom),
      validUntil: req.body.validUntil ? new Date(req.body.validUntil) : undefined,
    };
    const cert = await medicalCertificateService.MedicalCertificateService.create(data);
    res.status(201).json({ success: true, data: cert });
  } catch (e) {
    next(e);
  }
}

export async function listCertificates(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const babyId = parseInt(req.params.babyId);
    const professionalId = await getProfessionalId(req.user!.userId);
    const list = await medicalCertificateService.MedicalCertificateService.listByBaby(babyId, professionalId);
    res.json({ success: true, data: list });
  } catch (e) {
    next(e);
  }
}

export async function getCertificate(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const id = parseInt(req.params.certificateId);
    const professionalId = await getProfessionalId(req.user!.userId);
    const cert = await medicalCertificateService.MedicalCertificateService.getById(id, professionalId);
    res.json({ success: true, data: cert });
  } catch (e) {
    next(e);
  }
}

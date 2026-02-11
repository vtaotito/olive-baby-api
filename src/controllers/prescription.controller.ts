// Olive Baby API - Prescription Controller
import { Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import * as prescriptionService from '../services/prescription.service';
import { AppError } from '../utils/errors/AppError';
import { AuthenticatedRequest } from '../types';

const prisma = new PrismaClient();

async function getProfessionalId(userId: number): Promise<number> {
  const prof = await prisma.professional.findUnique({ where: { userId } });
  if (!prof) throw new AppError('Profissional não encontrado', 404);
  return prof.id;
}

export async function createPrescription(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const professionalId = await getProfessionalId(req.user!.userId);
    const data = {
      ...req.body,
      babyId: parseInt(req.params.babyId),
      professionalId,
      prescriptionDate: req.body.prescriptionDate ? new Date(req.body.prescriptionDate) : new Date(),
      validUntil: req.body.validUntil ? new Date(req.body.validUntil) : undefined,
    };
    const rx = await prescriptionService.PrescriptionService.create(data);
    res.status(201).json({ success: true, data: rx });
  } catch (e) {
    next(e);
  }
}

export async function listPrescriptions(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const babyId = parseInt(req.params.babyId);
    const professionalId = await getProfessionalId(req.user!.userId);
    const list = await prescriptionService.PrescriptionService.listByBaby(babyId, professionalId);
    res.json({ success: true, data: list });
  } catch (e) {
    next(e);
  }
}

export async function getPrescription(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const id = parseInt(req.params.prescriptionId);
    const professionalId = await getProfessionalId(req.user!.userId);
    const rx = await prescriptionService.PrescriptionService.getById(id, professionalId);
    res.json({ success: true, data: rx });
  } catch (e) {
    next(e);
  }
}

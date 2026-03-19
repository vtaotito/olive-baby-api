// Olive Baby API - Baby Clinical Info Controller
import { Response, NextFunction } from 'express';
import { prisma } from '../config/database';
import * as clinicalInfoService from '../services/baby-clinical-info.service';
import { AppError } from '../utils/errors/AppError';
import { AuthenticatedRequest } from '../types';

async function getProfessionalId(userId: number): Promise<number> {
  const prof = await prisma.professional.findUnique({ where: { userId } });
  if (!prof) throw new AppError('Profissional não encontrado', 404);
  return prof.id;
}

export async function getClinicalInfo(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const babyId = parseInt(req.params.babyId);
    const professionalId = await getProfessionalId(req.user!.userId);
    const info = await clinicalInfoService.BabyClinicalInfoService.getOrCreate(babyId, professionalId);
    res.json({ success: true, data: info });
  } catch (e) {
    next(e);
  }
}

export async function upsertClinicalInfo(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const babyId = parseInt(req.params.babyId);
    const professionalId = await getProfessionalId(req.user!.userId);
    const info = await clinicalInfoService.BabyClinicalInfoService.upsert(babyId, req.body, professionalId);
    res.json({ success: true, data: info });
  } catch (e) {
    next(e);
  }
}

// Olive Baby API - Clinical Visit Controller
import { Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import * as clinicalVisitService from '../services/clinical-visit.service';
import { AppError } from '../utils/errors/AppError';
import { AuthenticatedRequest } from '../types';

const prisma = new PrismaClient();

async function getProfessionalId(userId: number): Promise<number> {
  const prof = await prisma.professional.findUnique({ where: { userId } });
  if (!prof) throw new AppError('Profissional não encontrado', 404);
  return prof.id;
}

export async function createVisit(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const professionalId = await getProfessionalId(req.user!.userId);
    const data = {
      ...req.body,
      babyId: parseInt(req.params.babyId),
      professionalId,
      visitDate: req.body.visitDate ? new Date(req.body.visitDate) : new Date(),
      nextVisitDate: req.body.nextVisitDate ? new Date(req.body.nextVisitDate) : undefined,
    };
    const visit = await clinicalVisitService.ClinicalVisitService.create(data);
    res.status(201).json({ success: true, data: visit });
  } catch (e) {
    next(e);
  }
}

export async function getVisit(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const id = parseInt(req.params.visitId);
    const professionalId = await getProfessionalId(req.user!.userId);
    const visit = await clinicalVisitService.ClinicalVisitService.getById(id, professionalId);
    res.json({ success: true, data: visit });
  } catch (e) {
    next(e);
  }
}

export async function listVisits(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const babyId = parseInt(req.params.babyId);
    const professionalId = await getProfessionalId(req.user!.userId);
    const { limit, offset } = req.query;
    const result = await clinicalVisitService.ClinicalVisitService.listByBaby(babyId, professionalId, {
      limit: limit ? parseInt(limit as string) : undefined,
      offset: offset ? parseInt(offset as string) : undefined,
    });
    res.json({ success: true, data: result.data, pagination: { total: result.total } });
  } catch (e) {
    next(e);
  }
}

export async function updateVisit(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const id = parseInt(req.params.visitId);
    const professionalId = await getProfessionalId(req.user!.userId);
    const data = { ...req.body };
    if (data.visitDate) data.visitDate = new Date(data.visitDate);
    if (data.nextVisitDate) data.nextVisitDate = new Date(data.nextVisitDate);
    const visit = await clinicalVisitService.ClinicalVisitService.update(id, data, professionalId);
    res.json({ success: true, data: visit });
  } catch (e) {
    next(e);
  }
}

export async function deleteVisit(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const id = parseInt(req.params.visitId);
    const professionalId = await getProfessionalId(req.user!.userId);
    await clinicalVisitService.ClinicalVisitService.delete(id, professionalId);
    res.json({ success: true, message: 'Consulta removida' });
  } catch (e) {
    next(e);
  }
}

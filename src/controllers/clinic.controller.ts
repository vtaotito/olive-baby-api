// Olive Baby API - Clinic Controller
import { Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import * as clinicService from '../services/clinic.service';
import { AppError } from '../utils/errors/AppError';
import { AuthenticatedRequest } from '../types';

const prisma = new PrismaClient();

async function getProfessionalId(userId: number): Promise<number> {
  const prof = await prisma.professional.findUnique({
    where: { userId },
  });
  if (!prof) throw new AppError('Profissional não encontrado', 404);
  return prof.id;
}

export async function createClinic(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const professionalId = await getProfessionalId(req.user!.userId);
    const clinic = await clinicService.ClinicService.create(req.body, professionalId);
    res.status(201).json({ success: true, data: clinic });
  } catch (e) {
    next(e);
  }
}

export async function getClinic(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const id = parseInt(req.params.id);
    const professionalId = await getProfessionalId(req.user!.userId);
    await clinicService.ClinicService.ensureProfessionalHasAccess(id, professionalId);
    const clinic = await clinicService.ClinicService.getById(id);
    res.json({ success: true, data: clinic });
  } catch (e) {
    next(e);
  }
}

export async function getClinicBySlugPublic(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const slug = req.params.slug;
    const clinic = await clinicService.ClinicService.getThemeBySlug(slug);
    if (!clinic) return res.status(404).json({ success: false, message: 'Clínica não encontrada' });
    res.json({ success: true, data: clinic });
  } catch (e) {
    next(e);
  }
}

export async function updateClinic(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const id = parseInt(req.params.id);
    const professionalId = await getProfessionalId(req.user!.userId);
    const clinic = await clinicService.ClinicService.update(id, req.body, professionalId);
    res.json({ success: true, data: clinic });
  } catch (e) {
    next(e);
  }
}

export async function getMyClinics(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const professionalId = await getProfessionalId(req.user!.userId);
    const clinics = await clinicService.ClinicService.getClinicsForProfessional(professionalId);
    res.json({ success: true, data: clinics });
  } catch (e) {
    next(e);
  }
}

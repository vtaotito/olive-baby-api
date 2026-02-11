// Olive Baby API - Prescription Routes (baby-scoped)
import { Router } from 'express';
import * as prescriptionController from '../controllers/prescription.controller';
import { authenticate, requireProfessional } from '../middlewares/auth.middleware';

export const babyPrescriptionRouter = Router({ mergeParams: true });

babyPrescriptionRouter.get('/', authenticate, requireProfessional, prescriptionController.listPrescriptions);
babyPrescriptionRouter.post('/', authenticate, requireProfessional, prescriptionController.createPrescription);
babyPrescriptionRouter.get('/:prescriptionId', authenticate, requireProfessional, prescriptionController.getPrescription);

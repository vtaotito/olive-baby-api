// Olive Baby API - Medical Certificate Routes (baby-scoped)
import { Router } from 'express';
import * as medicalCertificateController from '../controllers/medical-certificate.controller';
import { authenticate, requireProfessional } from '../middlewares/auth.middleware';

export const babyMedicalCertificateRouter = Router({ mergeParams: true });

babyMedicalCertificateRouter.get('/', authenticate, requireProfessional, medicalCertificateController.listCertificates);
babyMedicalCertificateRouter.post('/', authenticate, requireProfessional, medicalCertificateController.createCertificate);
babyMedicalCertificateRouter.get('/:certificateId', authenticate, requireProfessional, medicalCertificateController.getCertificate);

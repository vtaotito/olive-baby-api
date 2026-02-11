// Olive Baby API - Clinic Routes
import { Router } from 'express';
import * as clinicController from '../controllers/clinic.controller';
import { authenticate, requireProfessional } from '../middlewares/auth.middleware';

const router = Router();

router.get('/my-clinics', authenticate, requireProfessional, clinicController.getMyClinics);
router.post('/', authenticate, requireProfessional, clinicController.createClinic);
router.get('/by-slug/:slug', clinicController.getClinicBySlugPublic);
router.get('/:id', authenticate, requireProfessional, clinicController.getClinic);
router.patch('/:id', authenticate, requireProfessional, clinicController.updateClinic);

export default router;

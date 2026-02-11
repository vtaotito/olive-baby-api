// Olive Baby API - Baby Clinical Info Routes (baby-scoped)
import { Router } from 'express';
import * as clinicalInfoController from '../controllers/baby-clinical-info.controller';
import { authenticate, requireProfessional } from '../middlewares/auth.middleware';

export const babyClinicalInfoRouter = Router({ mergeParams: true });

babyClinicalInfoRouter.get('/', authenticate, requireProfessional, clinicalInfoController.getClinicalInfo);
babyClinicalInfoRouter.put('/', authenticate, requireProfessional, clinicalInfoController.upsertClinicalInfo);

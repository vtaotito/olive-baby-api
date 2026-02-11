// Olive Baby API - Clinical Visit Routes (baby-scoped)
import { Router } from 'express';
import * as clinicalVisitController from '../controllers/clinical-visit.controller';
import { authenticate, requireProfessional } from '../middlewares/auth.middleware';

export const babyClinicalVisitRouter = Router({ mergeParams: true });

babyClinicalVisitRouter.get('/', authenticate, requireProfessional, clinicalVisitController.listVisits);
babyClinicalVisitRouter.post('/', authenticate, requireProfessional, clinicalVisitController.createVisit);
babyClinicalVisitRouter.get('/:visitId', authenticate, requireProfessional, clinicalVisitController.getVisit);
babyClinicalVisitRouter.patch('/:visitId', authenticate, requireProfessional, clinicalVisitController.updateVisit);
babyClinicalVisitRouter.delete('/:visitId', authenticate, requireProfessional, clinicalVisitController.deleteVisit);

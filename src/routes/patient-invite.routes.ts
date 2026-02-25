// Olive Baby API - Patient Invite Routes
import { Router } from 'express';
import * as patientInviteController from '../controllers/patient-invite.controller';
import { authenticate, requireProfessional } from '../middlewares/auth.middleware';

const router = Router();

// Routes for any authenticated user (patients receiving invites)
router.get('/received', authenticate, patientInviteController.received);
router.post('/:id/accept', authenticate, patientInviteController.accept);
router.post('/:id/reject', authenticate, patientInviteController.reject);

// Routes for professionals (sending invites)
router.get('/', authenticate, requireProfessional, patientInviteController.list);
router.post('/', authenticate, requireProfessional, patientInviteController.create);
router.post('/:id/resend', authenticate, requireProfessional, patientInviteController.resend);
router.delete('/:id', authenticate, requireProfessional, patientInviteController.cancel);

export default router;

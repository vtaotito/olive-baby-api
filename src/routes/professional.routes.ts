// Olive Baby API - Professional Routes
import { Router } from 'express';
import * as professionalController from '../controllers/professional.controller';
import { authenticate, requireCaregiver, requireProfessional } from '../middlewares/auth.middleware';
import { requireProfessionalInviteAllowed } from '../middlewares/entitlements.middleware';

const router = Router();

// Public routes (for invite activation)
router.post('/verify-token', professionalController.verifyInviteToken);
router.post('/activate', professionalController.activateProfessional);

// Professional dashboard routes
router.get('/my-patients', authenticate, requireProfessional, professionalController.getMyPatients);

// Get professional by ID (authenticated)
router.get('/:id', authenticate, professionalController.getProfessional);

export default router;

// Baby-scoped professional routes (to be mounted on /babies/:babyId/professionals)
export const babyProfessionalRouter = Router({ mergeParams: true });

// List professionals for a baby
babyProfessionalRouter.get('/', authenticate, requireCaregiver, professionalController.getProfessionals);

// Invite a professional
// Verifica: limite do plano de profissionais
babyProfessionalRouter.post('/invite', authenticate, requireCaregiver, requireProfessionalInviteAllowed(), professionalController.inviteProfessional);

// Resend invite
babyProfessionalRouter.post('/:id/resend-invite', authenticate, requireCaregiver, professionalController.resendInvite);

// Remove professional from baby
babyProfessionalRouter.delete('/:linkId', authenticate, requireCaregiver, professionalController.removeProfessional);

// Update professional link (notes, role)
babyProfessionalRouter.patch('/:linkId', authenticate, requireCaregiver, professionalController.updateProfessionalLink);

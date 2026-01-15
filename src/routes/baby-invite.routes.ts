// Olive Baby API - Baby Invite Routes
import { Router } from 'express';
import { BabyInviteController } from '../controllers/baby-invite.controller';
import { authMiddleware } from '../middlewares/auth.middleware';

const router = Router();

// POST /invites/verify-token - Verifica token (público, não requer autenticação)
router.post('/invites/verify-token', BabyInviteController.verifyToken);

// POST /invites/accept - Aceita convite por token (requer autenticação)
router.post('/invites/accept', authMiddleware, BabyInviteController.acceptInvite);

// Rotas que requerem autenticação
router.use(authMiddleware);

// GET /invites/pending - Lista convites pendentes recebidos pelo usuário logado
router.get('/invites/pending', BabyInviteController.getPendingInvites);

// POST /invites/:inviteId/accept - Aceita convite por ID (para usuários já logados)
router.post('/invites/:inviteId/accept', BabyInviteController.acceptInviteById);

// POST /invites/:inviteId/reject - Rejeita convite recebido
router.post('/invites/:inviteId/reject', BabyInviteController.rejectInvite);

// POST /babies/:babyId/invites - Cria convite
router.post('/babies/:babyId/invites', BabyInviteController.createInvite);

// GET /babies/:babyId/invites - Lista convites
router.get('/babies/:babyId/invites', BabyInviteController.listInvites);

// POST /babies/:babyId/invites/:inviteId/resend - Reenvia convite
router.post('/babies/:babyId/invites/:inviteId/resend', BabyInviteController.resendInvite);

// DELETE /babies/:babyId/invites/:inviteId - Revoga convite
router.delete('/babies/:babyId/invites/:inviteId', BabyInviteController.revokeInvite);

export default router;

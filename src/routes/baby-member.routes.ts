// Olive Baby API - Baby Member Routes
import { Router } from 'express';
import { BabyMemberController } from '../controllers/baby-member.controller';
import { authMiddleware } from '../middlewares/auth.middleware';

const router = Router();

// Todas as rotas requerem autenticação
router.use(authMiddleware);

// GET /babies/:babyId/members - Lista membros
router.get('/babies/:babyId/members', BabyMemberController.listMembers);

// PATCH /babies/:babyId/members/:memberId - Atualiza vínculo
router.patch('/babies/:babyId/members/:memberId', BabyMemberController.updateMember);

// DELETE /babies/:babyId/members/:memberId - Revoga acesso
router.delete('/babies/:babyId/members/:memberId', BabyMemberController.revokeMember);

export default router;

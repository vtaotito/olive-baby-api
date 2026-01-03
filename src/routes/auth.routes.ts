// Olive Baby API - Auth Routes
import { Router } from 'express';
import { 
  AuthController, 
  registerSchema, 
  loginSchema, 
  refreshSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  changePasswordSchema,
  deleteAccountSchema,
  setupAdminSchema
} from '../controllers/auth.controller';
import { validateBody } from '../middlewares/validation.middleware';
import { authMiddleware } from '../middlewares/auth.middleware';

const router = Router();

// POST /api/v1/auth/register - Registro de usuário
router.post('/register', validateBody(registerSchema), AuthController.register);

// POST /api/v1/auth/login - Login
router.post('/login', validateBody(loginSchema), AuthController.login);

// POST /api/v1/auth/refresh - Refresh token
router.post('/refresh', validateBody(refreshSchema), AuthController.refresh);

// POST /api/v1/auth/logout - Logout
router.post('/logout', validateBody(refreshSchema), AuthController.logout);

// POST /api/v1/auth/forgot-password - Solicita reset de senha
router.post('/forgot-password', validateBody(forgotPasswordSchema), AuthController.forgotPassword);

// POST /api/v1/auth/reset-password - Reseta senha
router.post('/reset-password', validateBody(resetPasswordSchema), AuthController.resetPassword);

// POST /api/v1/auth/change-password - Altera senha (autenticado)
router.post('/change-password', authMiddleware, validateBody(changePasswordSchema), AuthController.changePassword);

// DELETE /api/v1/auth/account - Exclui conta (autenticado)
router.delete('/account', authMiddleware, validateBody(deleteAccountSchema), AuthController.deleteAccount);

// POST /api/v1/auth/setup-admin - Setup inicial do admin (requer chave de setup)
router.post('/setup-admin', validateBody(setupAdminSchema), AuthController.setupInitialAdmin);

export default router;

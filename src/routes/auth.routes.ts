// Olive Baby API - Auth Routes
import { Router } from 'express';
import { 
  AuthController, 
  registerSchema, 
  loginSchema, 
  refreshSchema,
  forgotPasswordSchema,
  resetPasswordSchema 
} from '../controllers/auth.controller';
import { validateBody } from '../middlewares/validation.middleware';

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

export default router;

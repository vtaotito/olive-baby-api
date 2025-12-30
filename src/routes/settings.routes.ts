// Olive Baby API - Settings Routes
import { Router } from 'express';
import { 
  SettingsController, 
  notificationSettingsSchema, 
  appearanceSettingsSchema 
} from '../controllers/settings.controller';
import { validateBody } from '../middlewares/validation.middleware';
import { authMiddleware } from '../middlewares/auth.middleware';

const router = Router();

// Todas as rotas requerem autenticação
router.use(authMiddleware);

// GET /api/v1/settings - Buscar todas as configurações
router.get('/', SettingsController.getSettings);

// PUT /api/v1/settings/notifications - Atualizar configurações de notificações
router.put('/notifications', validateBody(notificationSettingsSchema), SettingsController.updateNotifications);

// PUT /api/v1/settings/appearance - Atualizar configurações de aparência
router.put('/appearance', validateBody(appearanceSettingsSchema), SettingsController.updateAppearance);

export default router;


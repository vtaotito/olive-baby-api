// Olive Baby API - Device Token Routes
// Endpoints para gerenciamento de device tokens (push notifications)
import { Router } from 'express';
import { DeviceTokenController } from '../controllers/device-token.controller';
import { authMiddleware, requireAdmin } from '../middlewares/auth.middleware';
import { validateBody } from '../middlewares/validation.middleware';
import { registerTokenSchema, unregisterTokenSchema } from '../controllers/device-token.controller';

const router = Router();

// ==========================================
// Public routes (no auth required)
// ==========================================

// GET /device-tokens/vapid-public-key - Get VAPID public key for Web Push subscription
router.get('/vapid-public-key', DeviceTokenController.getVapidPublicKey);

// GET /device-tokens/capabilities - Check which push providers are configured
router.get('/capabilities', DeviceTokenController.getCapabilities);

// ==========================================
// Authenticated routes
// ==========================================

// POST /device-tokens - Register a device token
router.post('/', authMiddleware, validateBody(registerTokenSchema), DeviceTokenController.register);

// GET /device-tokens - List user's device tokens
router.get('/', authMiddleware, DeviceTokenController.list);

// DELETE /device-tokens - Unregister a device token (by token value in body)
router.delete('/', authMiddleware, validateBody(unregisterTokenSchema), DeviceTokenController.unregister);

// POST /device-tokens/test - Test push notification delivery
router.post('/test', authMiddleware, DeviceTokenController.testPush);

// DELETE /device-tokens/:id - Remove a device token by ID
router.delete('/:id', authMiddleware, DeviceTokenController.removeById);

// ==========================================
// Admin routes
// ==========================================

// GET /device-tokens/stats - Device token statistics (admin only)
router.get('/stats', authMiddleware, requireAdmin, DeviceTokenController.getStats);

export default router;

// Olive Baby API - AI Routes
import { Router } from 'express';
import { AIController } from '../controllers/ai.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
import rateLimit from 'express-rate-limit';

const router = Router();

// Rate limiting for AI endpoints (more restrictive)
const aiRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // 30 requests per minute
  message: {
    success: false,
    error: 'Muitas requisições. Aguarde um momento e tente novamente.',
  },
});

const chatRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // 10 messages per minute
  message: {
    success: false,
    error: 'Muitas mensagens enviadas. Aguarde um momento.',
  },
});

// Apply authentication to all routes
router.use(authMiddleware);

// ==========================================
// Health Check
// ==========================================
router.get('/health', AIController.healthCheck);

// ==========================================
// Chat Sessions
// ==========================================
router.post('/chat/sessions', aiRateLimiter, AIController.createSession);
router.get('/chat/sessions', aiRateLimiter, AIController.listSessions);
router.get('/chat/sessions/:id', aiRateLimiter, AIController.getSession);
router.post('/chat/sessions/:id/messages', chatRateLimiter, AIController.sendMessage);
router.delete('/chat/sessions/:id', aiRateLimiter, AIController.deleteSession);
router.patch('/chat/sessions/:id/archive', aiRateLimiter, AIController.archiveSession);

// ==========================================
// Insights
// ==========================================
router.get('/insights/:babyId', aiRateLimiter, AIController.getInsights);
router.post('/insights/:babyId/generate', aiRateLimiter, AIController.generateInsights);
router.patch('/insights/:id/read', aiRateLimiter, AIController.markInsightRead);
router.patch('/insights/:id/dismiss', aiRateLimiter, AIController.dismissInsight);

// ==========================================
// Knowledge Base (Admin/Debug)
// ==========================================
router.get('/documents', aiRateLimiter, AIController.listDocuments);
router.post('/documents/ingest', aiRateLimiter, AIController.ingestDocument);
router.delete('/documents/:id', aiRateLimiter, AIController.deleteDocument);
router.post('/search', aiRateLimiter, AIController.searchKnowledge);

export default router;

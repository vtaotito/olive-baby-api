// Olive Baby API - Main Application
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';

import { env, isDevelopment } from './config/env';
import { connectDatabase, disconnectDatabase } from './config/database';
import { errorMiddleware, notFoundMiddleware } from './middlewares/error.middleware';
import { logger } from './config/logger';
import { monitoringService } from './services/monitoring.service';
import routes from './routes';

// Criar aplicação Express
const app = express();

// ==========================================
// Middlewares de Segurança
// ==========================================

// Helmet - Headers de segurança
app.use(helmet());

// CORS
app.use(cors({
  origin: isDevelopment 
    ? ['http://localhost:3000', 'http://localhost:5173'] 
    : env.FRONTEND_URL,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Rate Limiting
const limiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.RATE_LIMIT_MAX,
  message: {
    success: false,
    message: 'Muitas requisições. Tente novamente mais tarde.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

// ==========================================
// Middlewares de Parsing
// ==========================================

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ==========================================
// Logging
// ==========================================

if (isDevelopment) {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

// Middleware para tracking de requisições e erros
app.use((req, res, next) => {
  monitoringService.recordRequest();
  next();
});

// Middleware para log de requisições
app.use((req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info('HTTP Request', {
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip,
      userAgent: req.get('user-agent'),
    });

    // Registrar erro se status >= 400
    if (res.statusCode >= 400) {
      monitoringService.recordError();
    }
  });

  next();
});

// ==========================================
// Rotas
// ==========================================

// Health check na raiz
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    environment: env.NODE_ENV,
  });
});

// API Routes
app.use(env.API_PREFIX, routes);

// ==========================================
// Error Handling
// ==========================================

app.use(notFoundMiddleware);
app.use(errorMiddleware);

// ==========================================
// Server Startup
// ==========================================

async function startServer(): Promise<void> {
  try {
    // Conectar ao banco de dados
    await connectDatabase();

    // Iniciar monitoramento periódico
    const { startHealthMonitoring } = require('./utils/monitoring');
    startHealthMonitoring(60000); // A cada 1 minuto

    // Iniciar servidor
    app.listen(env.PORT, () => {
      logger.info('Server started', {
        port: env.PORT,
        environment: env.NODE_ENV,
        apiPrefix: env.API_PREFIX,
      });

      console.log('🍼 ====================================');
      console.log('   OLIVE BABY API');
      console.log('🍼 ====================================');
      console.log(`✅ Server running on port ${env.PORT}`);
      console.log(`📍 Environment: ${env.NODE_ENV}`);
      console.log(`🔗 API: http://localhost:${env.PORT}${env.API_PREFIX}`);
      console.log(`❤️  Health: http://localhost:${env.PORT}/health`);
      console.log(`📊 Monitoring: http://localhost:${env.PORT}${env.API_PREFIX}/monitoring/health`);
      console.log('🍼 ====================================');
    });
  } catch (error) {
    logger.error('Failed to start server', { error });
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n👋 Shutting down gracefully...');
  await disconnectDatabase();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n👋 Shutting down gracefully...');
  await disconnectDatabase();
  process.exit(0);
});

// Iniciar servidor
startServer();

export default app;

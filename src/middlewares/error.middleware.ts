// Olive Baby API - Error Middleware
import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/errors/AppError';
import { logger } from '../config/logger';
import { monitoringService } from '../services/monitoring.service';
import { ZodError } from 'zod';

/**
 * Middleware para rotas não encontradas
 */
export function notFoundMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const error = new AppError(`Rota não encontrada: ${req.method} ${req.originalUrl}`, 404);
  next(error);
}

/**
 * Middleware centralizado de tratamento de erros
 */
export function errorMiddleware(
  error: Error | AppError | ZodError,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // Registrar erro
  monitoringService.recordError();

  // Log do erro
  if (error instanceof AppError) {
    logger.warn('Application Error', {
      message: error.message,
      statusCode: error.statusCode,
      stack: error.stack,
      url: req.originalUrl,
      method: req.method,
    });

    // Enviar alerta para erros críticos
    if (error.statusCode >= 500) {
      monitoringService.sendAlert({
        level: 'error',
        title: 'Application Error',
        message: error.message,
        component: 'api',
        metadata: {
          statusCode: error.statusCode,
          url: req.originalUrl,
          method: req.method,
        },
      });
    }

    return res.status(error.statusCode).json({
      success: false,
      message: error.message,
      ...(process.env.NODE_ENV === 'development' && { stack: error.stack }),
    });
  }

  // Erro de validação Zod
  if (error instanceof ZodError) {
    logger.warn('Validation Error', {
      errors: error.errors,
      url: req.originalUrl,
      method: req.method,
    });

    return res.status(400).json({
      success: false,
      message: 'Erro de validação',
      errors: error.errors.map((err) => ({
        path: err.path.join('.'),
        message: err.message,
      })),
    });
  }

  // Erro não tratado
  logger.error('Unhandled Error', {
    message: error.message,
    stack: error.stack,
    url: req.originalUrl,
    method: req.method,
  });

  // Enviar alerta crítico
  monitoringService.sendAlert({
    level: 'critical',
    title: 'Unhandled Error',
    message: error.message,
    component: 'api',
    metadata: {
      stack: error.stack,
      url: req.originalUrl,
      method: req.method,
    },
  });

  res.status(500).json({
    success: false,
    message: process.env.NODE_ENV === 'production' 
      ? 'Erro interno do servidor' 
      : error.message,
    ...(process.env.NODE_ENV === 'development' && { stack: error.stack }),
  });
}

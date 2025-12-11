// Olive Baby API - Error Middleware
import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/errors/AppError';
import { isDevelopment } from '../config/env';
import { ApiResponse } from '../types';

export function errorMiddleware(
  error: Error,
  req: Request,
  res: Response<ApiResponse>,
  next: NextFunction
): void {
  // Log do erro
  if (isDevelopment) {
    console.error('❌ Error:', error);
  } else {
    console.error('❌ Error:', error.message);
  }

  // AppError (erros controlados)
  if (error instanceof AppError) {
    res.status(error.statusCode).json({
      success: false,
      message: error.message,
      errors: error.errors,
      ...(isDevelopment && { stack: error.stack }),
    });
    return;
  }

  // Prisma errors
  if (error.name === 'PrismaClientKnownRequestError') {
    const prismaError = error as any;
    
    if (prismaError.code === 'P2002') {
      // Unique constraint violation
      const target = prismaError.meta?.target as string[] | undefined;
      res.status(409).json({
        success: false,
        message: `Registro duplicado: ${target?.join(', ') || 'campo único'}`,
      });
      return;
    }

    if (prismaError.code === 'P2025') {
      // Record not found
      res.status(404).json({
        success: false,
        message: 'Registro não encontrado',
      });
      return;
    }
  }

  // Erro genérico
  res.status(500).json({
    success: false,
    message: isDevelopment ? error.message : 'Erro interno do servidor',
    ...(isDevelopment && { stack: error.stack }),
  });
}

export function notFoundMiddleware(
  req: Request,
  res: Response<ApiResponse>,
  next: NextFunction
): void {
  res.status(404).json({
    success: false,
    message: `Rota não encontrada: ${req.method} ${req.originalUrl}`,
  });
}

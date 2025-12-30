// Olive Baby API - Auth Controller
import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { AuthService } from '../services/auth.service';
import { ApiResponse } from '../types';
import { AppError } from '../utils/errors/AppError';

// Schemas de validação
export const registerSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(8, 'Senha deve ter no mínimo 8 caracteres'),
  fullName: z.string().min(2, 'Nome deve ter no mínimo 2 caracteres'),
  cpf: z.string().min(11, 'CPF inválido'),
  phone: z.string().optional(),
  dateOfBirth: z.string().datetime().optional().transform(val => val ? new Date(val) : undefined),
  gender: z.enum(['FEMALE', 'MALE', 'OTHER', 'NOT_INFORMED']).optional(),
  city: z.string().optional(),
  state: z.string().length(2, 'Estado deve ter 2 caracteres').optional(),
  country: z.string().length(2, 'País deve ter 2 caracteres').default('BR'),
});

export const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(1, 'Senha obrigatória'),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token obrigatório'),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email('Email inválido'),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Token obrigatório'),
  password: z.string().min(8, 'Senha deve ter no mínimo 8 caracteres'),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Senha atual obrigatória'),
  newPassword: z.string().min(8, 'Nova senha deve ter no mínimo 8 caracteres'),
});

export const deleteAccountSchema = z.object({
  password: z.string().min(1, 'Senha obrigatória para confirmar exclusão'),
});

export class AuthController {
  static async register(
    req: Request,
    res: Response<ApiResponse>,
    next: NextFunction
  ): Promise<void> {
    try {
      const data = req.body;
      const result = await AuthService.register(data);

      res.status(201).json({
        success: true,
        message: 'Usuário criado com sucesso',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  static async login(
    req: Request,
    res: Response<ApiResponse>,
    next: NextFunction
  ): Promise<void> {
    try {
      const data = req.body;
      const result = await AuthService.login(data);

      res.status(200).json({
        success: true,
        message: 'Login realizado com sucesso',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  static async refresh(
    req: Request,
    res: Response<ApiResponse>,
    next: NextFunction
  ): Promise<void> {
    try {
      const { refreshToken } = req.body;
      const tokens = await AuthService.refresh(refreshToken);

      res.status(200).json({
        success: true,
        message: 'Token renovado com sucesso',
        data: tokens,
      });
    } catch (error) {
      next(error);
    }
  }

  static async logout(
    req: Request,
    res: Response<ApiResponse>,
    next: NextFunction
  ): Promise<void> {
    try {
      const { refreshToken } = req.body;
      await AuthService.logout(refreshToken);

      res.status(200).json({
        success: true,
        message: 'Logout realizado com sucesso',
      });
    } catch (error) {
      next(error);
    }
  }

  static async forgotPassword(
    req: Request,
    res: Response<ApiResponse>,
    next: NextFunction
  ): Promise<void> {
    try {
      const { email } = req.body;
      
      // Importar rate limiting
      const { checkRateLimit, hashEmailForRateLimit, getClientIp } = await import('../services/rate-limit.service');
      
      // Obter IP do cliente
      const clientIp = getClientIp(req);
      const emailHash = hashEmailForRateLimit(email);
      
      // Rate limiting por IP (5 requisições a cada 10 minutos)
      const ipLimit = await checkRateLimit(`forgot-password:ip:${clientIp}`, 10 * 60 * 1000, 5);
      if (!ipLimit.allowed) {
        throw AppError.tooManyRequests('Muitas tentativas. Tente novamente em alguns minutos.');
      }
      
      // Rate limiting por email (3 requisições a cada 30 minutos)
      const emailLimit = await checkRateLimit(`forgot-password:email:${emailHash}`, 30 * 60 * 1000, 3);
      if (!emailLimit.allowed) {
        throw AppError.tooManyRequests('Muitas tentativas para este email. Tente novamente em alguns minutos.');
      }
      
      // Processar solicitação
      await AuthService.forgotPassword(
        email,
        clientIp,
        req.get('user-agent')
      );

      // Sempre retorna sucesso para não revelar se email existe
      res.status(200).json({
        success: true,
        message: 'Se o email existir em nossa base, você receberá um link de recuperação em breve.',
      });
    } catch (error) {
      next(error);
    }
  }

  static async resetPassword(
    req: Request,
    res: Response<ApiResponse>,
    next: NextFunction
  ): Promise<void> {
    try {
      const { token, password } = req.body;
      await AuthService.resetPassword(token, password);

      res.status(200).json({
        success: true,
        message: 'Senha alterada com sucesso',
      });
    } catch (error) {
      next(error);
    }
  }

  static async changePassword(
    req: Request,
    res: Response<ApiResponse>,
    next: NextFunction
  ): Promise<void> {
    try {
      const { currentPassword, newPassword } = req.body;
      const userId = (req as any).user?.userId;

      if (!userId) {
        throw AppError.unauthorized('Usuário não autenticado');
      }

      await AuthService.changePassword(userId, currentPassword, newPassword);

      res.status(200).json({
        success: true,
        message: 'Senha alterada com sucesso',
      });
    } catch (error) {
      next(error);
    }
  }

  static async deleteAccount(
    req: Request,
    res: Response<ApiResponse>,
    next: NextFunction
  ): Promise<void> {
    try {
      const { password } = req.body;
      const userId = (req as any).user?.userId;

      if (!userId) {
        throw AppError.unauthorized('Usuário não autenticado');
      }

      await AuthService.deleteAccount(userId, password);

      res.status(200).json({
        success: true,
        message: 'Conta excluída com sucesso',
      });
    } catch (error) {
      next(error);
    }
  }
}

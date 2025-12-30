// Olive Baby API - Auth Service
import bcrypt from 'bcryptjs';
import { prisma } from '../config/database';
import { JwtService } from './jwt.service';
import { AppError } from '../utils/errors/AppError';
import { validateCPF, cleanCPF } from '../utils/validators/cpf.validator';
import { validatePassword } from '../utils/validators/password.validator';
import { JwtPayload } from '../types';
import { UserRole, Relationship } from '@prisma/client';
import { logger } from '../config/logger';

const SALT_ROUNDS = 10;

interface RegisterInput {
  email: string;
  password: string;
  fullName: string;
  cpf: string;
  phone?: string;
  dateOfBirth?: Date;
  gender?: 'FEMALE' | 'MALE' | 'OTHER' | 'NOT_INFORMED';
  city?: string;
  state?: string;
  country?: string;
}

interface LoginInput {
  email: string;
  password: string;
}

interface AuthResponse {
  user: {
    id: number;
    email: string;
    role: UserRole;
    caregiver: {
      id: number;
      fullName: string;
      cpf: string;
    } | null;
  };
  tokens: {
    accessToken: string;
    refreshToken: string;
  };
}

export class AuthService {
  static async register(input: RegisterInput): Promise<AuthResponse> {
    // Validar CPF
    const cleanedCpf = cleanCPF(input.cpf);
    if (!validateCPF(cleanedCpf)) {
      throw AppError.badRequest('CPF inválido');
    }

    // Validar senha
    const passwordValidation = validatePassword(input.password);
    if (!passwordValidation.valid) {
      throw AppError.badRequest('Senha inválida', { password: passwordValidation.errors });
    }

    // Verificar se email já existe
    const existingEmail = await prisma.user.findUnique({
      where: { email: input.email.toLowerCase() },
    });
    if (existingEmail) {
      throw AppError.conflict('Este email já está cadastrado');
    }

    // Verificar se CPF já existe
    const existingCpf = await prisma.caregiver.findUnique({
      where: { cpf: cleanedCpf },
    });
    if (existingCpf) {
      throw AppError.conflict('Este CPF já está cadastrado');
    }

    // Hash da senha
    const passwordHash = await bcrypt.hash(input.password, SALT_ROUNDS);

    // Criar usuário e cuidador em transação
    const user = await prisma.user.create({
      data: {
        email: input.email.toLowerCase(),
        passwordHash,
        role: UserRole.PARENT,
        caregiver: {
          create: {
            fullName: input.fullName,
            cpf: cleanedCpf,
            phone: input.phone,
            dateOfBirth: input.dateOfBirth,
            gender: input.gender,
            city: input.city,
            state: input.state,
            country: input.country || 'BR',
          },
        },
      },
      include: {
        caregiver: true,
      },
    });

    // Gerar tokens
    const payload: JwtPayload = {
      userId: user.id,
      email: user.email,
      role: user.role,
    };
    const tokens = JwtService.generateTokens(payload);

    // Salvar refresh token
    await JwtService.saveRefreshToken(user.id, tokens.refreshToken);

    return {
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        caregiver: user.caregiver ? {
          id: user.caregiver.id,
          fullName: user.caregiver.fullName,
          cpf: user.caregiver.cpf,
        } : null,
      },
      tokens,
    };
  }

  static async login(input: LoginInput): Promise<AuthResponse> {
    // Buscar usuário
    const user = await prisma.user.findUnique({
      where: { email: input.email.toLowerCase() },
      include: { caregiver: true },
    });

    if (!user) {
      throw AppError.unauthorized('Email ou senha inválidos');
    }

    if (!user.isActive) {
      throw AppError.unauthorized('Conta desativada');
    }

    // Verificar senha
    const isValidPassword = await bcrypt.compare(input.password, user.passwordHash);
    if (!isValidPassword) {
      throw AppError.unauthorized('Email ou senha inválidos');
    }

    // Gerar tokens
    const payload: JwtPayload = {
      userId: user.id,
      email: user.email,
      role: user.role,
    };
    const tokens = JwtService.generateTokens(payload);

    // Salvar refresh token
    await JwtService.saveRefreshToken(user.id, tokens.refreshToken);

    return {
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        caregiver: user.caregiver ? {
          id: user.caregiver.id,
          fullName: user.caregiver.fullName,
          cpf: user.caregiver.cpf,
        } : null,
      },
      tokens,
    };
  }

  static async refresh(refreshToken: string): Promise<{ accessToken: string; refreshToken: string }> {
    // Verificar se token é válido
    const payload = JwtService.verifyRefreshToken(refreshToken);
    if (!payload) {
      throw AppError.unauthorized('Token inválido');
    }

    // Verificar se token está no banco
    const isValid = await JwtService.isRefreshTokenValid(refreshToken);
    if (!isValid) {
      throw AppError.unauthorized('Token revogado ou expirado');
    }

    // Buscar usuário atualizado
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
    });

    if (!user || !user.isActive) {
      throw AppError.unauthorized('Usuário não encontrado ou inativo');
    }

    // Revogar token antigo
    await JwtService.revokeRefreshToken(refreshToken);

    // Gerar novos tokens
    const newPayload: JwtPayload = {
      userId: user.id,
      email: user.email,
      role: user.role,
    };
    const tokens = JwtService.generateTokens(newPayload);

    // Salvar novo refresh token
    await JwtService.saveRefreshToken(user.id, tokens.refreshToken);

    return tokens;
  }

  static async logout(refreshToken: string): Promise<void> {
    await JwtService.revokeRefreshToken(refreshToken);
  }

  static async forgotPassword(
    email: string,
    requestIp?: string,
    userAgent?: string
  ): Promise<void> {
    const normalizedEmail = email.toLowerCase().trim();
    
    // Buscar usuário (sem revelar se existe)
    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      include: { caregiver: true },
    });

    // Sempre retornar sucesso para não revelar se email existe
    // Se usuário não existe, apenas retornar sem fazer nada
    if (!user) {
      // Log de segurança (sem revelar email completo)
      logger.info('Password reset requested for non-existent email', {
        emailPrefix: normalizedEmail.substring(0, 3) + '***',
        ip: requestIp,
      });
      return;
    }

    // Importar serviços necessários
    const { generateResetToken, createPasswordReset } = await import('./password-reset.service');
    const { sendPasswordResetEmail } = await import('./email.service');

    // Gerar token seguro
    const { token, tokenHash } = generateResetToken();
    
    // Definir expiração (30 minutos)
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 30);

    // Criar registro no banco
    await createPasswordReset(
      user.id,
      tokenHash,
      expiresAt,
      requestIp,
      userAgent
    );

    // Enviar email
    try {
      await sendPasswordResetEmail({
        email: normalizedEmail,
        resetToken: token,
        userName: user.caregiver?.fullName,
      });
    } catch (error: any) {
      // Log erro mas não falhar a requisição (segurança)
      logger.error('Failed to send password reset email', {
        userId: user.id,
        emailPrefix: normalizedEmail.substring(0, 3) + '***',
        error: error.message,
      });
      // Não lançar erro para não revelar que email existe
    }

    // Log de segurança (sem token)
    logger.info('Password reset token created', {
      userId: user.id,
      emailPrefix: normalizedEmail.substring(0, 3) + '***',
      ip: requestIp,
      expiresAt: expiresAt.toISOString(),
    });
  }

  static async resetPassword(token: string, newPassword: string): Promise<void> {
    // Validar senha
    const passwordValidation = validatePassword(newPassword);
    if (!passwordValidation.valid) {
      throw AppError.badRequest('Senha inválida', { password: passwordValidation.errors });
    }

    // Importar serviços necessários
    const { validateResetToken, findValidResetToken, markTokenAsUsed } = await import('./password-reset.service');

    // Criar hash do token recebido
    const crypto = await import('crypto');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    // Buscar token válido no banco
    const resetRecord = await findValidResetToken(tokenHash);

    if (!resetRecord) {
      // Mensagem genérica para não revelar detalhes
      throw AppError.badRequest('Token inválido ou expirado. Por favor, solicite um novo link de recuperação.');
    }

    // Validar token (double check)
    if (!validateResetToken(token, resetRecord.tokenHash)) {
      throw AppError.badRequest('Token inválido ou expirado. Por favor, solicite um novo link de recuperação.');
    }

    const user = resetRecord.user;

    // Atualizar senha e invalidar tokens em transação
    const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);

    await prisma.$transaction(async (tx) => {
      // Atualizar senha
      await tx.user.update({
        where: { id: user.id },
        data: { passwordHash },
      });
      // Marcar token como usado
      await tx.passwordReset.update({
        where: { tokenHash },
        data: { usedAt: new Date() },
      });
      // Revogar todos os refresh tokens (forçar novo login)
      await tx.refreshToken.deleteMany({
        where: { userId: user.id },
      });
    });

    // Log de segurança (sem token)
    logger.info('Password reset completed', {
      userId: user.id,
      emailPrefix: user.email.substring(0, 3) + '***',
      ip: resetRecord.requestIp,
    });
  }

  static async changePassword(
    userId: number,
    currentPassword: string,
    newPassword: string
  ): Promise<void> {
    // Buscar usuário
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw AppError.notFound('Usuário não encontrado');
    }

    // Verificar senha atual
    const isValidPassword = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isValidPassword) {
      throw AppError.badRequest('Senha atual incorreta');
    }

    // Validar nova senha
    const passwordValidation = validatePassword(newPassword);
    if (!passwordValidation.valid) {
      throw AppError.badRequest('Nova senha inválida', { password: passwordValidation.errors });
    }

    // Verificar se nova senha é diferente da atual
    const isSamePassword = await bcrypt.compare(newPassword, user.passwordHash);
    if (isSamePassword) {
      throw AppError.badRequest('A nova senha deve ser diferente da senha atual');
    }

    // Hash da nova senha
    const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);

    // Atualizar senha
    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });

    // Log de segurança
    logger.info('Password changed', {
      userId: user.id,
      emailPrefix: user.email.substring(0, 3) + '***',
    });
  }

  static async deleteAccount(userId: number, password: string): Promise<void> {
    // Buscar usuário
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        caregiver: {
          include: {
            babies: true,
          },
        },
      },
    });

    if (!user) {
      throw AppError.notFound('Usuário não encontrado');
    }

    // Verificar senha
    const isValidPassword = await bcrypt.compare(password, user.passwordHash);
    if (!isValidPassword) {
      throw AppError.badRequest('Senha incorreta');
    }

    // Executar exclusão em transação
    await prisma.$transaction(async (tx) => {
      // Revogar todos os refresh tokens
      await tx.refreshToken.deleteMany({
        where: { userId },
      });

      // Revogar todos os password resets
      await tx.passwordReset.deleteMany({
        where: { userId },
      });

      // Se tiver caregiver, verificar bebês
      if (user.caregiver) {
        // Remover vínculos com bebês
        await tx.caregiverBaby.deleteMany({
          where: { caregiverId: user.caregiver.id },
        });

        // Deletar caregiver
        await tx.caregiver.delete({
          where: { id: user.caregiver.id },
        });
      }

      // Remover memberships de bebês
      await tx.babyMember.deleteMany({
        where: { userId },
      });

      // Deletar sessões de chat AI
      await tx.aiChatSession.deleteMany({
        where: { userId },
      });

      // Deletar usuário
      await tx.user.delete({
        where: { id: userId },
      });
    });

    // Log de segurança
    logger.info('Account deleted', {
      userId: user.id,
      emailPrefix: user.email.substring(0, 3) + '***',
    });
  }
}

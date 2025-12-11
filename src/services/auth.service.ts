// Olive Baby API - Auth Service
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { prisma } from '../config/database';
import { JwtService } from './jwt.service';
import { AppError } from '../utils/errors/AppError';
import { validateCPF, cleanCPF } from '../utils/validators/cpf.validator';
import { validatePassword } from '../utils/validators/password.validator';
import { JwtPayload } from '../types';
import { UserRole, Relationship } from '@prisma/client';

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

  static async forgotPassword(email: string): Promise<void> {
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    // Não revelar se email existe
    if (!user) return;

    // Gerar token de reset
    const token = uuidv4();
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 1); // 1 hora

    await prisma.passwordReset.create({
      data: {
        email: email.toLowerCase(),
        token,
        expiresAt,
      },
    });

    // TODO: Enviar email com link de reset
    console.log(`Password reset token for ${email}: ${token}`);
  }

  static async resetPassword(token: string, newPassword: string): Promise<void> {
    // Validar senha
    const passwordValidation = validatePassword(newPassword);
    if (!passwordValidation.valid) {
      throw AppError.badRequest('Senha inválida', { password: passwordValidation.errors });
    }

    // Buscar token
    const resetRecord = await prisma.passwordReset.findUnique({
      where: { token },
    });

    if (!resetRecord || resetRecord.used || resetRecord.expiresAt < new Date()) {
      throw AppError.badRequest('Token inválido ou expirado');
    }

    // Buscar usuário
    const user = await prisma.user.findUnique({
      where: { email: resetRecord.email },
    });

    if (!user) {
      throw AppError.badRequest('Usuário não encontrado');
    }

    // Atualizar senha
    const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);

    await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: { passwordHash },
      }),
      prisma.passwordReset.update({
        where: { token },
        data: { used: true },
      }),
      // Revogar todos os tokens de refresh
      prisma.refreshToken.deleteMany({
        where: { userId: user.id },
      }),
    ]);
  }
}

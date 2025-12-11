// Olive Baby API - JWT Service
import jwt, { SignOptions, JwtPayload as JwtPayloadLib } from 'jsonwebtoken';
import { JWT_CONFIG } from '../config/jwt';
import { JwtPayload } from '../types';
import { prisma } from '../config/database';
import { v4 as uuidv4 } from 'uuid';

export class JwtService {
  static generateAccessToken(payload: JwtPayload): string {
    return jwt.sign(payload, JWT_CONFIG.accessToken.secret, {
      expiresIn: JWT_CONFIG.accessToken.expiresIn,
    } as SignOptions);
  }

  static generateRefreshToken(payload: JwtPayload): string {
    return jwt.sign(payload, JWT_CONFIG.refreshToken.secret, {
      expiresIn: JWT_CONFIG.refreshToken.expiresIn,
    } as SignOptions);
  }

  static verifyAccessToken(token: string): JwtPayload | null {
    try {
      return jwt.verify(token, JWT_CONFIG.accessToken.secret) as JwtPayload;
    } catch {
      return null;
    }
  }

  static verifyRefreshToken(token: string): JwtPayload | null {
    try {
      return jwt.verify(token, JWT_CONFIG.refreshToken.secret) as JwtPayload;
    } catch {
      return null;
    }
  }

  static async saveRefreshToken(userId: number, token: string): Promise<void> {
    // Remove tokens expirados do usuário
    await prisma.refreshToken.deleteMany({
      where: {
        userId,
        expiresAt: { lt: new Date() },
      },
    });

    // Salva novo token
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 dias

    await prisma.refreshToken.create({
      data: {
        token,
        userId,
        expiresAt,
      },
    });
  }

  static async revokeRefreshToken(token: string): Promise<void> {
    await prisma.refreshToken.deleteMany({
      where: { token },
    });
  }

  static async revokeAllUserTokens(userId: number): Promise<void> {
    await prisma.refreshToken.deleteMany({
      where: { userId },
    });
  }

  static async isRefreshTokenValid(token: string): Promise<boolean> {
    const storedToken = await prisma.refreshToken.findUnique({
      where: { token },
    });

    if (!storedToken) return false;
    if (storedToken.expiresAt < new Date()) {
      await this.revokeRefreshToken(token);
      return false;
    }

    return true;
  }

  static generateTokens(payload: JwtPayload): { accessToken: string; refreshToken: string } {
    return {
      accessToken: this.generateAccessToken(payload),
      refreshToken: this.generateRefreshToken(payload),
    };
  }
}

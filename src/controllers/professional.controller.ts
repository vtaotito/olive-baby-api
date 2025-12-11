// Olive Baby API - Professional Controller
import { Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import * as professionalService from '../services/professional.service';
import * as emailService from '../services/email.service';
import { AppError } from '../utils/errors/AppError';
import { AuthenticatedRequest } from '../types';
import { logger } from '../config/logger';

const prisma = new PrismaClient();

// Helper to get caregiverId from userId
async function getCaregiverId(userId: number): Promise<number> {
  const caregiver = await prisma.caregiver.findUnique({
    where: { userId }
  });
  if (!caregiver) {
    throw new AppError('Cuidador não encontrado', 404);
  }
  return caregiver.id;
}

// GET /babies/:babyId/professionals - List professionals for a baby
export async function getProfessionals(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const babyId = parseInt(req.params.babyId);
    const caregiverId = await getCaregiverId(req.user!.userId);

    const professionals = await professionalService.getProfessionalsByBaby(babyId, caregiverId);

    res.json({
      success: true,
      data: professionals
    });
  } catch (error) {
    next(error);
  }
}

// GET /professionals/:id - Get professional details
export async function getProfessional(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const professionalId = parseInt(req.params.id);

    const professional = await professionalService.getProfessionalById(professionalId);

    res.json({
      success: true,
      data: professional
    });
  } catch (error) {
    next(error);
  }
}

// POST /babies/:babyId/professionals/invite - Invite a professional
export async function inviteProfessional(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const babyId = parseInt(req.params.babyId);
    
    if (isNaN(babyId)) {
      throw new AppError('ID do bebê inválido', 400);
    }

    const caregiverId = await getCaregiverId(req.user!.userId);
    const { email, fullName, specialty, role, crmNumber, crmState, phone, notes } = req.body;

    const result = await professionalService.inviteProfessional(
      {
        email,
        fullName,
        specialty,
        role,
        babyId,
        crmNumber,
        crmState,
        phone,
        notes
      },
      caregiverId
    );

    // Send invite email
    try {
      await emailService.sendProfessionalInvite({
        professionalEmail: result.professional.email,
        professionalName: result.professional.fullName,
        caregiverName: result.caregiver!.fullName,
        babyName: result.baby!.name,
        inviteToken: result.inviteToken,
        role
      });
    } catch (emailError: any) {
      logger.error('Error sending invite email', { error: emailError.message });
      // Don't fail the request if email fails
    }

    res.status(201).json({
      success: true,
      message: 'Convite enviado com sucesso',
      data: {
        id: result.professional.id,
        email: result.professional.email,
        fullName: result.professional.fullName,
        status: result.professional.status
      }
    });
  } catch (error) {
    next(error);
  }
}

// POST /professionals/verify-token - Verify invite token
export async function verifyInviteToken(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const { token } = req.body;

    if (!token) {
      throw new AppError('Token é obrigatório', 400);
    }

    const professional = await professionalService.verifyInviteToken(token);

    res.json({
      success: true,
      data: {
        email: professional.email,
        fullName: professional.fullName,
        specialty: professional.specialty
      }
    });
  } catch (error) {
    next(error);
  }
}

// POST /professionals/activate - Activate professional account
export async function activateProfessional(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const { token, password, phone, city, state } = req.body;

    if (!token || !password) {
      throw new AppError('Token e senha são obrigatórios', 400);
    }

    if (password.length < 8) {
      throw new AppError('Senha deve ter pelo menos 8 caracteres', 400);
    }

    const result = await professionalService.activateProfessional({
      token,
      password,
      phone,
      city,
      state
    });

    res.json({
      success: true,
      message: 'Conta ativada com sucesso! Você já pode fazer login.',
      data: {
        email: result.user.email,
        role: result.user.role
      }
    });
  } catch (error) {
    next(error);
  }
}

// POST /babies/:babyId/professionals/:id/resend-invite - Resend invite
export async function resendInvite(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const professionalId = parseInt(req.params.id);
    const babyId = parseInt(req.params.babyId);
    const caregiverId = await getCaregiverId(req.user!.userId);

    const result = await professionalService.resendInvite(professionalId, caregiverId);

    // Get baby name for email
    const baby = await prisma.baby.findUnique({ where: { id: babyId } });

    // Send invite email
    try {
      await emailService.sendProfessionalInvite({
        professionalEmail: result.professional.email,
        professionalName: result.professional.fullName,
        caregiverName: result.caregiver!.fullName,
        babyName: baby?.name || 'seu bebê',
        inviteToken: result.inviteToken,
        role: 'PEDIATRICIAN' // Default, ideally get from babyProfessional
      });
    } catch (emailError: any) {
      logger.error('Error sending resend invite email', { error: emailError.message });
    }

    res.json({
      success: true,
      message: 'Convite reenviado com sucesso'
    });
  } catch (error) {
    next(error);
  }
}

// DELETE /babies/:babyId/professionals/:linkId - Remove professional from baby
export async function removeProfessional(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const linkId = parseInt(req.params.linkId);
    const caregiverId = await getCaregiverId(req.user!.userId);

    await professionalService.removeProfessionalFromBaby(linkId, caregiverId);

    res.json({
      success: true,
      message: 'Profissional removido com sucesso'
    });
  } catch (error) {
    next(error);
  }
}

// PATCH /babies/:babyId/professionals/:linkId - Update professional link
export async function updateProfessionalLink(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const linkId = parseInt(req.params.linkId);
    const caregiverId = await getCaregiverId(req.user!.userId);
    const { notes, role } = req.body;

    const updated = await professionalService.updateProfessionalLink(
      linkId,
      caregiverId,
      { notes, role }
    );

    res.json({
      success: true,
      data: updated
    });
  } catch (error) {
    next(error);
  }
}

// GET /professionals/my-patients - Get babies for professional (professional dashboard)
export async function getMyPatients(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.userId;

    const babies = await professionalService.getBabiesForProfessional(userId);

    res.json({
      success: true,
      data: babies
    });
  } catch (error) {
    next(error);
  }
}

// Olive Baby API - Patient Invite Controller
import { Request, Response } from 'express';
import { prisma } from '../config/database';
import {
  createPatientInvite,
  listPatientInvites,
  resendPatientInvite,
  cancelPatientInvite,
  getReceivedPatientInvites,
  acceptPatientInvite,
  rejectPatientInvite,
} from '../services/patient-invite.service';
import { logger } from '../config/logger';

/**
 * Helper: get professional ID from authenticated user
 */
async function getProfessionalId(req: Request): Promise<number | null> {
  const userId = (req as any).user?.userId;
  if (!userId) return null;
  const prof = await prisma.professional.findUnique({
    where: { userId },
    select: { id: true },
  });
  return prof?.id ?? null;
}

/**
 * Create a patient invitation
 */
export async function create(req: Request, res: Response) {
  try {
    const professionalId = await getProfessionalId(req);
    if (!professionalId) {
      return res.status(403).json({ success: false, message: 'Apenas profissionais podem enviar convites' });
    }

    const { patientName, email, phone, babyName, message } = req.body;

    if (!patientName || !email) {
      return res.status(400).json({ success: false, message: 'Nome do paciente e email são obrigatórios' });
    }

    const invite = await createPatientInvite(professionalId, {
      patientName,
      email,
      phone,
      babyName,
      message,
    });

    return res.status(201).json({ success: true, data: invite });
  } catch (error: any) {
    logger.error('Error creating patient invite', { error: error.message });
    return res.status(400).json({ success: false, message: error.message });
  }
}

/**
 * List all invites for the authenticated professional
 */
export async function list(req: Request, res: Response) {
  try {
    const professionalId = await getProfessionalId(req);
    if (!professionalId) {
      return res.status(403).json({ success: false, message: 'Apenas profissionais podem listar convites' });
    }

    const invites = await listPatientInvites(professionalId);

    return res.json({ success: true, data: invites });
  } catch (error: any) {
    logger.error('Error listing patient invites', { error: error.message });
    return res.status(500).json({ success: false, message: 'Erro ao listar convites' });
  }
}

/**
 * Resend a patient invitation email
 */
export async function resend(req: Request, res: Response) {
  try {
    const professionalId = await getProfessionalId(req);
    if (!professionalId) {
      return res.status(403).json({ success: false, message: 'Apenas profissionais podem reenviar convites' });
    }

    const inviteId = parseInt(req.params.id);
    if (isNaN(inviteId)) {
      return res.status(400).json({ success: false, message: 'ID do convite inválido' });
    }

    const result = await resendPatientInvite(professionalId, inviteId);

    return res.json({ success: true, data: result });
  } catch (error: any) {
    logger.error('Error resending patient invite', { error: error.message });
    return res.status(400).json({ success: false, message: error.message });
  }
}

/**
 * Cancel a patient invitation
 */
export async function cancel(req: Request, res: Response) {
  try {
    const professionalId = await getProfessionalId(req);
    if (!professionalId) {
      return res.status(403).json({ success: false, message: 'Apenas profissionais podem cancelar convites' });
    }

    const inviteId = parseInt(req.params.id);
    if (isNaN(inviteId)) {
      return res.status(400).json({ success: false, message: 'ID do convite inválido' });
    }

    const result = await cancelPatientInvite(professionalId, inviteId);

    return res.json({ success: true, data: result });
  } catch (error: any) {
    logger.error('Error cancelling patient invite', { error: error.message });
    return res.status(400).json({ success: false, message: error.message });
  }
}

/**
 * Get patient invites received by the authenticated user
 */
export async function received(req: Request, res: Response) {
  try {
    const user = (req as any).user;
    if (!user?.email) {
      return res.status(401).json({ success: false, message: 'Não autenticado' });
    }

    const invites = await getReceivedPatientInvites(user.email);

    const formatted = invites.map((inv: any) => ({
      id: inv.id,
      inviteType: 'PATIENT_INVITE' as const,
      patientName: inv.patientName,
      babyName: inv.babyName,
      message: inv.message,
      professional: inv.professional,
      expiresAt: inv.expiresAt,
      createdAt: inv.createdAt,
    }));

    return res.json({ success: true, data: formatted });
  } catch (error: any) {
    logger.error('Error fetching received patient invites', { error: error.message });
    return res.status(500).json({ success: false, message: 'Erro ao buscar convites recebidos' });
  }
}

/**
 * Accept a patient invite with baby selection
 */
export async function accept(req: Request, res: Response) {
  try {
    const user = (req as any).user;
    if (!user?.userId || !user?.email) {
      return res.status(401).json({ success: false, message: 'Não autenticado' });
    }

    const inviteId = parseInt(req.params.id);
    if (isNaN(inviteId)) {
      return res.status(400).json({ success: false, message: 'ID do convite inválido' });
    }

    const { babyIds } = req.body;
    if (!Array.isArray(babyIds) || babyIds.length === 0) {
      return res.status(400).json({ success: false, message: 'Selecione pelo menos um bebê' });
    }

    const result = await acceptPatientInvite(inviteId, user.userId, user.email, babyIds);

    return res.json({ success: true, data: result, message: `Convite aceito! ${result.babiesLinked} bebê(s) compartilhado(s) com ${result.professionalName}` });
  } catch (error: any) {
    logger.error('Error accepting patient invite', { error: error.message });
    return res.status(400).json({ success: false, message: error.message });
  }
}

/**
 * Reject a patient invite
 */
export async function reject(req: Request, res: Response) {
  try {
    const user = (req as any).user;
    if (!user?.email) {
      return res.status(401).json({ success: false, message: 'Não autenticado' });
    }

    const inviteId = parseInt(req.params.id);
    if (isNaN(inviteId)) {
      return res.status(400).json({ success: false, message: 'ID do convite inválido' });
    }

    const result = await rejectPatientInvite(inviteId, user.email);

    return res.json({ success: true, data: result });
  } catch (error: any) {
    logger.error('Error rejecting patient invite', { error: error.message });
    return res.status(400).json({ success: false, message: error.message });
  }
}

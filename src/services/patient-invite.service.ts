// Olive Baby API - Patient Invite Service
// Professionals invite patients/caregivers to join OlieCare
import { randomBytes } from 'crypto';
import { prisma } from '../config/database';
import { sendPatientInviteEmail } from './email.service';
import { logger } from '../config/logger';

interface CreateInviteData {
  patientName: string;
  email: string;
  phone?: string;
  babyName?: string;
  message?: string;
}

/**
 * Create a patient invitation and send email
 */
export async function createPatientInvite(professionalId: number, data: CreateInviteData) {
  // Get professional info
  const professional = await prisma.professional.findUnique({
    where: { id: professionalId },
    select: { id: true, fullName: true, specialty: true, crmNumber: true, crmState: true },
  });

  if (!professional) {
    throw new Error('Profissional não encontrado');
  }

  // Check for existing pending invite to same email
  const existing = await prisma.patientInvite.findFirst({
    where: {
      professionalId,
      email: data.email.toLowerCase().trim(),
      status: 'PENDING',
    },
  });

  if (existing) {
    throw new Error('Já existe um convite pendente para este email');
  }

  // Generate unique token
  const token = randomBytes(32).toString('hex');

  // Create invite (expires in 30 days)
  const invite = await prisma.patientInvite.create({
    data: {
      professionalId,
      patientName: data.patientName.trim(),
      email: data.email.toLowerCase().trim(),
      phone: data.phone?.trim() || null,
      babyName: data.babyName?.trim() || null,
      message: data.message?.trim() || null,
      token,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 dias
    },
  });

  // Send email
  try {
    await sendPatientInviteEmail({
      patientEmail: data.email.toLowerCase().trim(),
      patientName: data.patientName.trim(),
      professionalName: professional.fullName,
      professionalSpecialty: professional.specialty,
      professionalCRM: professional.crmNumber && professional.crmState
        ? `CRM ${professional.crmState} ${professional.crmNumber}`
        : undefined,
      babyName: data.babyName?.trim(),
      message: data.message?.trim(),
      inviteToken: token,
    });
  } catch (error) {
    logger.error('Failed to send patient invite email', { error, inviteId: invite.id });
    // Don't fail the invite creation if email fails
  }

  logger.info('Patient invite created', {
    inviteId: invite.id,
    professionalId,
    email: data.email.substring(0, 3) + '***',
  });

  return invite;
}

/**
 * List all invites sent by a professional
 */
export async function listPatientInvites(professionalId: number) {
  const invites = await prisma.patientInvite.findMany({
    where: { professionalId },
    orderBy: { createdAt: 'desc' },
  });

  // Auto-expire old invites
  const now = new Date();
  const updated = invites.map((inv: any) => {
    if (inv.status === 'PENDING' && inv.expiresAt < now) {
      return { ...inv, status: 'EXPIRED' as const };
    }
    return inv;
  });

  return updated;
}

/**
 * Resend invite email
 */
export async function resendPatientInvite(professionalId: number, inviteId: number) {
  const invite = await prisma.patientInvite.findFirst({
    where: { id: inviteId, professionalId },
    include: {
      professional: {
        select: { fullName: true, specialty: true, crmNumber: true, crmState: true },
      },
    },
  });

  if (!invite) {
    throw new Error('Convite não encontrado');
  }

  if (invite.status !== 'PENDING') {
    throw new Error('Apenas convites pendentes podem ser reenviados');
  }

  // Generate new token and extend expiry
  const newToken = randomBytes(32).toString('hex');

  await prisma.patientInvite.update({
    where: { id: inviteId },
    data: {
      token: newToken,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
  });

  await sendPatientInviteEmail({
    patientEmail: invite.email,
    patientName: invite.patientName,
    professionalName: invite.professional.fullName,
    professionalSpecialty: invite.professional.specialty,
    professionalCRM: invite.professional.crmNumber && invite.professional.crmState
      ? `CRM ${invite.professional.crmState} ${invite.professional.crmNumber}`
      : undefined,
    babyName: invite.babyName || undefined,
    message: invite.message || undefined,
    inviteToken: newToken,
  });

  logger.info('Patient invite resent', { inviteId, professionalId });

  return { success: true };
}

/**
 * Cancel a pending invite
 */
export async function cancelPatientInvite(professionalId: number, inviteId: number) {
  const invite = await prisma.patientInvite.findFirst({
    where: { id: inviteId, professionalId },
  });

  if (!invite) {
    throw new Error('Convite não encontrado');
  }

  if (invite.status !== 'PENDING') {
    throw new Error('Apenas convites pendentes podem ser cancelados');
  }

  await prisma.patientInvite.update({
    where: { id: inviteId },
    data: { status: 'CANCELLED' },
  });

  return { success: true };
}

// Olive Baby API - Patient Invite Service
// Professionals invite patients/caregivers to join OlieCare
import { randomBytes } from 'crypto';
import { prisma } from '../config/database';
import { sendPatientInviteEmail } from './email.service';
import { logger } from '../config/logger';
import { ProfessionalRole } from '@prisma/client';

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

  // Check if user already has an account
  const existingUser = await prisma.user.findUnique({
    where: { email: data.email.toLowerCase().trim() },
    select: { id: true },
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
      userExists: !!existingUser,
    });
  } catch (error) {
    logger.error('Failed to send patient invite email', { error, inviteId: invite.id });
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

/**
 * Get pending patient invites received by a user (matched by email)
 */
export async function getReceivedPatientInvites(userEmail: string) {
  const invites = await prisma.patientInvite.findMany({
    where: {
      email: { equals: userEmail.toLowerCase().trim(), mode: 'insensitive' },
      status: 'PENDING',
      expiresAt: { gt: new Date() },
    },
    include: {
      professional: {
        select: {
          id: true,
          fullName: true,
          email: true,
          specialty: true,
          crmNumber: true,
          crmState: true,
          phone: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  return invites;
}

const SPECIALTY_TO_ROLE: Record<string, ProfessionalRole> = {
  'Pediatria': ProfessionalRole.PEDIATRICIAN,
  'Pediatra': ProfessionalRole.PEDIATRICIAN,
  'PEDIATRICIAN': ProfessionalRole.PEDIATRICIAN,
  'Obstetra': ProfessionalRole.OBGYN,
  'Ginecologista': ProfessionalRole.OBGYN,
  'OBGYN': ProfessionalRole.OBGYN,
  'Consultora de Amamentação': ProfessionalRole.LACTATION_CONSULTANT,
  'LACTATION_CONSULTANT': ProfessionalRole.LACTATION_CONSULTANT,
};

/**
 * Accept a patient invite, linking selected babies to the professional
 */
export async function acceptPatientInvite(
  inviteId: number,
  userId: number,
  userEmail: string,
  babyIds: number[]
) {
  const invite = await prisma.patientInvite.findFirst({
    where: {
      id: inviteId,
      email: { equals: userEmail.toLowerCase().trim(), mode: 'insensitive' },
      status: 'PENDING',
    },
    include: {
      professional: { select: { id: true, specialty: true, fullName: true } },
    },
  });

  if (!invite) {
    throw new Error('Convite não encontrado ou já processado');
  }

  if (invite.expiresAt < new Date()) {
    throw new Error('Este convite expirou');
  }

  if (babyIds.length === 0) {
    throw new Error('Selecione pelo menos um bebê para compartilhar');
  }

  const userCaregiverBabies = await prisma.caregiverBaby.findMany({
    where: {
      caregiver: { userId },
      babyId: { in: babyIds },
    },
    select: { babyId: true },
  });

  const validBabyIds = userCaregiverBabies.map(cb => cb.babyId);
  if (validBabyIds.length === 0) {
    throw new Error('Nenhum dos bebês selecionados pertence ao seu perfil');
  }

  const role = SPECIALTY_TO_ROLE[invite.professional.specialty] || ProfessionalRole.PEDIATRICIAN;

  await prisma.$transaction(async (tx) => {
    for (const babyId of validBabyIds) {
      const existing = await tx.babyProfessional.findFirst({
        where: { babyId, professionalId: invite.professionalId, role },
      });
      if (!existing) {
        await tx.babyProfessional.create({
          data: {
            babyId,
            professionalId: invite.professionalId,
            role,
          },
        });
      }
    }

    await tx.patientInvite.update({
      where: { id: inviteId },
      data: { status: 'ACCEPTED', acceptedAt: new Date() },
    });
  });

  logger.info('Patient invite accepted', {
    inviteId,
    userId,
    professionalId: invite.professionalId,
    babyIds: validBabyIds,
  });

  return {
    professionalName: invite.professional.fullName,
    babiesLinked: validBabyIds.length,
  };
}

/**
 * Reject a patient invite
 */
export async function rejectPatientInvite(inviteId: number, userEmail: string) {
  const invite = await prisma.patientInvite.findFirst({
    where: {
      id: inviteId,
      email: { equals: userEmail.toLowerCase().trim(), mode: 'insensitive' },
      status: 'PENDING',
    },
  });

  if (!invite) {
    throw new Error('Convite não encontrado ou já processado');
  }

  await prisma.patientInvite.update({
    where: { id: inviteId },
    data: { status: 'CANCELLED' },
  });

  logger.info('Patient invite rejected', { inviteId, email: userEmail.substring(0, 3) + '***' });

  return { success: true };
}

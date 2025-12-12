// Olive Baby API - Professional Service
import { PrismaClient, ProfessionalStatus, ProfessionalRole, RegistrationSource, UserRole } from '@prisma/client';
import { AppError } from '../utils/errors/AppError';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

export interface InviteProfessionalData {
  email: string;
  fullName: string;
  specialty: string;
  role: ProfessionalRole;
  babyId: number;
  crmNumber?: string;
  crmState?: string;
  phone?: string;
  notes?: string;
}

export interface ActivateProfessionalData {
  token: string;
  password: string;
  phone?: string;
  city?: string;
  state?: string;
}

export interface UpdateProfessionalData {
  fullName?: string;
  specialty?: string;
  crmNumber?: string;
  crmState?: string;
  phone?: string;
  city?: string;
  state?: string;
}

// Get all professionals linked to a baby
export async function getProfessionalsByBaby(babyId: number, caregiverId: number) {
  // Verify caregiver has access to this baby
  const caregiverBaby = await prisma.caregiverBaby.findUnique({
    where: {
      caregiverId_babyId: { caregiverId, babyId }
    }
  });

  if (!caregiverBaby) {
    throw new AppError('Você não tem acesso a este bebê', 403);
  }

  const babyProfessionals = await prisma.babyProfessional.findMany({
    where: { babyId },
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
          city: true,
          state: true,
          status: true,
          createdAt: true,
        }
      }
    },
    orderBy: { createdAt: 'desc' }
  });

  return babyProfessionals.map(bp => ({
    id: bp.id,
    role: bp.role,
    notes: bp.notes,
    createdAt: bp.createdAt,
    professional: bp.professional
  }));
}

// Get a single professional
export async function getProfessionalById(professionalId: number) {
  const professional = await prisma.professional.findUnique({
    where: { id: professionalId },
    include: {
      babies: {
        include: {
          baby: {
            select: {
              id: true,
              name: true,
              birthDate: true,
            }
          }
        }
      }
    }
  });

  if (!professional) {
    throw new AppError('Profissional não encontrado', 404);
  }

  return professional;
}

// Invite a professional (by caregiver)
export async function inviteProfessional(data: InviteProfessionalData, caregiverId: number) {
  // Verify caregiver is primary for this baby
  const caregiverBaby = await prisma.caregiverBaby.findUnique({
    where: {
      caregiverId_babyId: { caregiverId, babyId: data.babyId }
    }
  });

  if (!caregiverBaby) {
    throw new AppError('Você não tem acesso a este bebê', 403);
  }

  if (!caregiverBaby.isPrimary) {
    throw new AppError('Apenas o cuidador principal pode convidar profissionais', 403);
  }

  // Check if professional already exists
  let professional = await prisma.professional.findUnique({
    where: { email: data.email }
  });

  const inviteToken = crypto.randomBytes(32).toString('hex');
  const inviteExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  if (professional) {
    // Professional exists, check if already linked to this baby
    const existingLink = await prisma.babyProfessional.findFirst({
      where: {
        babyId: data.babyId,
        professionalId: professional.id,
        role: data.role
      }
    });

    if (existingLink) {
      throw new AppError('Este profissional já está vinculado a este bebê com este papel', 400);
    }

    // Update invite token if not active
    if (professional.status !== 'ACTIVE') {
      professional = await prisma.professional.update({
        where: { id: professional.id },
        data: {
          inviteToken,
          inviteExpiresAt,
          status: 'INVITED'
        }
      });
    }
  } else {
    // Create new professional
    professional = await prisma.professional.create({
      data: {
        email: data.email,
        fullName: data.fullName,
        specialty: data.specialty,
        crmNumber: data.crmNumber,
        crmState: data.crmState,
        phone: data.phone,
        registrationSource: 'BY_CAREGIVER',
        status: 'INVITED',
        inviteToken,
        inviteExpiresAt
      }
    });
  }

  // Link professional to baby
  await prisma.babyProfessional.create({
    data: {
      babyId: data.babyId,
      professionalId: professional.id,
      role: data.role,
      notes: data.notes
    }
  });

  // Get baby and caregiver info for email
  const baby = await prisma.baby.findUnique({ where: { id: data.babyId } });
  const caregiver = await prisma.caregiver.findUnique({ where: { id: caregiverId } });

  return {
    professional,
    inviteToken,
    baby,
    caregiver
  };
}

// Verify invite token
export async function verifyInviteToken(token: string) {
  const professional = await prisma.professional.findUnique({
    where: { inviteToken: token }
  });

  if (!professional) {
    throw new AppError('Token de convite inválido', 400);
  }

  if (professional.inviteExpiresAt && professional.inviteExpiresAt < new Date()) {
    throw new AppError('Token de convite expirado', 400);
  }

  if (professional.status === 'ACTIVE') {
    throw new AppError('Este convite já foi ativado', 400);
  }

  return professional;
}

// Activate professional account
export async function activateProfessional(data: ActivateProfessionalData) {
  const professional = await verifyInviteToken(data.token);

  // Check if user already exists with this email
  const existingUser = await prisma.user.findUnique({
    where: { email: professional.email }
  });

  if (existingUser) {
    throw new AppError('Já existe um usuário com este email', 400);
  }

  // Create user and update professional in transaction
  const result = await prisma.$transaction(async (tx) => {
    // Determine user role based on specialty
    const userRole = professional.specialty.toLowerCase().includes('pediatr')
      ? UserRole.PEDIATRICIAN
      : UserRole.SPECIALIST;

    // Create user account
    const passwordHash = await bcrypt.hash(data.password, 12);
    const user = await tx.user.create({
      data: {
        email: professional.email,
        passwordHash,
        role: userRole,
        isActive: true
      }
    });

    // Update professional
    const updatedProfessional = await tx.professional.update({
      where: { id: professional.id },
      data: {
        userId: user.id,
        status: 'ACTIVE',
        inviteToken: null,
        inviteExpiresAt: null,
        phone: data.phone || professional.phone,
        city: data.city || professional.city,
        state: data.state || professional.state
      }
    });

    return { user, professional: updatedProfessional };
  });

  return result;
}

// Resend invite
export async function resendInvite(professionalId: number, caregiverId: number) {
  const professional = await prisma.professional.findUnique({
    where: { id: professionalId },
    include: {
      babies: {
        include: {
          baby: true
        }
      }
    }
  });

  if (!professional) {
    throw new AppError('Profissional não encontrado', 404);
  }

  if (professional.status === 'ACTIVE') {
    throw new AppError('Este profissional já está ativo', 400);
  }

  // Check if caregiver has access
  const hasAccess = professional.babies.some(bp => 
    prisma.caregiverBaby.findUnique({
      where: {
        caregiverId_babyId: { caregiverId, babyId: bp.babyId }
      }
    })
  );

  // Generate new token
  const inviteToken = crypto.randomBytes(32).toString('hex');
  const inviteExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  const updatedProfessional = await prisma.professional.update({
    where: { id: professionalId },
    data: {
      inviteToken,
      inviteExpiresAt,
      status: 'INVITED'
    }
  });

  const caregiver = await prisma.caregiver.findUnique({ where: { id: caregiverId } });

  return {
    professional: updatedProfessional,
    inviteToken,
    caregiver
  };
}

// Remove professional from baby
export async function removeProfessionalFromBaby(
  babyProfessionalId: number,
  caregiverId: number
) {
  const babyProfessional = await prisma.babyProfessional.findUnique({
    where: { id: babyProfessionalId },
    include: { baby: true }
  });

  if (!babyProfessional) {
    throw new AppError('Vínculo não encontrado', 404);
  }

  // Verify caregiver is primary for this baby
  const caregiverBaby = await prisma.caregiverBaby.findUnique({
    where: {
      caregiverId_babyId: { caregiverId, babyId: babyProfessional.babyId }
    }
  });

  if (!caregiverBaby || !caregiverBaby.isPrimary) {
    throw new AppError('Apenas o cuidador principal pode remover profissionais', 403);
  }

  await prisma.babyProfessional.delete({
    where: { id: babyProfessionalId }
  });

  return { message: 'Profissional removido com sucesso' };
}

// Update professional link (notes, role)
export async function updateProfessionalLink(
  babyProfessionalId: number,
  caregiverId: number,
  data: { notes?: string; role?: ProfessionalRole }
) {
  const babyProfessional = await prisma.babyProfessional.findUnique({
    where: { id: babyProfessionalId }
  });

  if (!babyProfessional) {
    throw new AppError('Vínculo não encontrado', 404);
  }

  // Verify caregiver has access
  const caregiverBaby = await prisma.caregiverBaby.findUnique({
    where: {
      caregiverId_babyId: { caregiverId, babyId: babyProfessional.babyId }
    }
  });

  if (!caregiverBaby) {
    throw new AppError('Você não tem acesso a este bebê', 403);
  }

  return prisma.babyProfessional.update({
    where: { id: babyProfessionalId },
    data: {
      notes: data.notes,
      role: data.role
    },
    include: {
      professional: true
    }
  });
}

// Get professional's babies (for professional dashboard)
export async function getBabiesForProfessional(userId: number) {
  const professional = await prisma.professional.findUnique({
    where: { userId }
  });

  if (!professional) {
    throw new AppError('Profissional não encontrado', 404);
  }

  const babies = await prisma.babyProfessional.findMany({
    where: { professionalId: professional.id },
    include: {
      baby: {
        include: {
          caregivers: {
            where: { isPrimary: true },
            include: {
              caregiver: {
                select: {
                  fullName: true,
                  phone: true
                }
              }
            }
          }
        }
      }
    }
  });

  return babies.map(bp => ({
    id: bp.baby.id,
    name: bp.baby.name,
    birthDate: bp.baby.birthDate,
    role: bp.role,
    notes: bp.notes,
    primaryCaregiver: bp.baby.caregivers[0]?.caregiver || null
  }));
}

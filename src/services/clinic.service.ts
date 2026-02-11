// Olive Baby API - Clinic Service
import { prisma } from '../config/database';
import { AppError } from '../utils/errors/AppError';
import { VisitType } from '@prisma/client';

export interface CreateClinicInput {
  name: string;
  slug: string;
  cnpj?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  logoUrl?: string;
  primaryColor?: string;
  faviconUrl?: string;
  supportEmail?: string;
}

export interface UpdateClinicInput {
  name?: string;
  slug?: string;
  cnpj?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  logoUrl?: string;
  primaryColor?: string;
  faviconUrl?: string;
  supportEmail?: string;
  isActive?: boolean;
}

export class ClinicService {
  static async create(data: CreateClinicInput, professionalId: number) {
    const slug = data.slug.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    const existing = await prisma.clinic.findUnique({ where: { slug } });
    if (existing) throw AppError.conflict('Este slug já está em uso');

    const clinic = await prisma.clinic.create({
      data: {
        ...data,
        slug,
      },
    });

    await prisma.clinicProfessional.create({
      data: {
        clinicId: clinic.id,
        professionalId,
        role: 'OWNER',
      },
    });

    return clinic;
  }

  static async getById(id: number) {
    const clinic = await prisma.clinic.findUnique({
      where: { id },
      include: {
        professionals: { include: { professional: true } },
      },
    });
    if (!clinic) throw AppError.notFound('Clínica não encontrada');
    return clinic;
  }

  static async getBySlug(slug: string) {
    const clinic = await prisma.clinic.findUnique({
      where: { slug: slug.toLowerCase(), isActive: true },
    });
    if (!clinic) throw AppError.notFound('Clínica não encontrada');
    return clinic;
  }

  static async getThemeBySlug(slug: string) {
    const clinic = await prisma.clinic.findUnique({
      where: { slug: slug.toLowerCase(), isActive: true },
      select: { name: true, logoUrl: true, primaryColor: true, faviconUrl: true, supportEmail: true },
    });
    return clinic || null;
  }

  static async update(id: number, data: UpdateClinicInput, professionalId: number) {
    await this.ensureProfessionalHasAccess(id, professionalId, ['OWNER', 'ADMIN']);

    if (data.slug) {
      data.slug = data.slug.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
      const existing = await prisma.clinic.findFirst({
        where: { slug: data.slug, NOT: { id } },
      });
      if (existing) throw AppError.conflict('Este slug já está em uso');
    }

    return prisma.clinic.update({
      where: { id },
      data: data as any,
    });
  }

  static async addProfessional(clinicId: number, professionalId: number, role: string, ownerId: number) {
    await this.ensureProfessionalHasAccess(clinicId, ownerId, ['OWNER', 'ADMIN']);

    return prisma.clinicProfessional.create({
      data: { clinicId, professionalId, role: role || 'MEMBER' },
    });
  }

  static async removeProfessional(clinicId: number, professionalId: number, operatorId: number) {
    await this.ensureProfessionalHasAccess(clinicId, operatorId, ['OWNER', 'ADMIN']);

    await prisma.clinicProfessional.delete({
      where: {
        clinicId_professionalId: { clinicId, professionalId },
      },
    });
    return { success: true };
  }

  static async getClinicsForProfessional(professionalId: number) {
    return prisma.clinicProfessional.findMany({
      where: { professionalId },
      include: { clinic: true },
    });
  }

  static async ensureProfessionalHasAccess(
    clinicId: number,
    professionalId: number,
    allowedRoles?: string[]
  ) {
    const link = await prisma.clinicProfessional.findUnique({
      where: {
        clinicId_professionalId: { clinicId, professionalId },
      },
    });
    if (!link) throw AppError.forbidden('Você não tem acesso a esta clínica');
    if (allowedRoles && !allowedRoles.includes(link.role)) {
      throw AppError.forbidden('Permissão insuficiente');
    }
    return link;
  }
}

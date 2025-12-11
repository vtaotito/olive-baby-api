// Olive Baby API - Type Definitions
import { Request } from 'express';
import { UserRole } from '@prisma/client';

// ==========================================
// Auth Types
// ==========================================

export interface JwtPayload {
  userId: number;
  email: string;
  role: UserRole;
}

export interface AuthenticatedRequest extends Request {
  user?: JwtPayload;
}

// ==========================================
// API Response Types
// ==========================================

export interface ApiResponse<T = unknown> {
  success: boolean;
  message?: string;
  data?: T;
  error?: string;
  errors?: Record<string, string[]>;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// ==========================================
// Routine Meta Types
// ==========================================

export interface FeedingMeta {
  feedingType?: 'breast' | 'bottle' | 'solid';
  breastSide?: 'left' | 'right' | 'both';
  bottleMl?: number;
  bottleMilkType?: 'breast_milk' | 'formula' | 'mixed';
  complement?: 'yes' | 'no';
  complementMl?: number;
  complementType?: 'breast_milk' | 'formula';
  solidFoods?: string[];
}

export interface DiaperMeta {
  diaperType?: 'pee' | 'poop' | 'both';
}

export interface MilkExtractionMeta {
  extractionMl?: number;
  extractionMethod?: 'manual' | 'electric';
}

export interface BathMeta {
  bathTemperature?: number;
}

export interface SleepMeta {
  sleepQuality?: 'good' | 'regular' | 'bad';
  wokeUpCount?: number;
}

export type RoutineMeta = FeedingMeta | DiaperMeta | MilkExtractionMeta | BathMeta | SleepMeta;

// ==========================================
// Stats Types
// ==========================================

export interface BabyStats {
  period: { start: Date; end: Date };
  
  // Sono
  totalSleepHours24h: number;
  averageSleepPerDay: number;
  sleepHoursPerDay: number[];
  
  // Alimentação
  totalFeedingMinutes24h: number;
  feedingCount24h: number;
  feedingCountsPerDay: number[];
  feedingMinutesPerDay: number[];
  breastSideDistribution: { left: number; right: number; both: number };
  
  // Complemento
  totalComplementMl24h: number;
  complementMlPerDay: number[];
  
  // Mamadeira
  totalBottleMl24h: number;
  bottleMlPerDay: number[];
  
  // Extração
  totalExtractionMl24h: number;
  extractionMlPerDay: number[];
  
  // Fraldas
  totalDiaper24h: number;
  diaperCountsPerDay: number[];
  
  // Atividade por hora (0-23)
  hourlyCounts: number[];
}

// ==========================================
// Export Options
// ==========================================

export interface ExportOptions {
  babyId: number;
  startDate: Date;
  endDate: Date;
  routineTypes?: ('FEEDING' | 'SLEEP' | 'DIAPER' | 'BATH' | 'MILK_EXTRACTION')[];
}

// ==========================================
// Permissions
// ==========================================

export interface RolePermissions {
  canManageBabies: boolean;
  canRegisterRoutines: boolean;
  canViewStats: boolean;
  canManageTeam: boolean;
  canExportData: boolean;
  canViewClinical: boolean;
  canEditRoutines: boolean;
  canDeleteRoutines: boolean;
}

export const ROLE_PERMISSIONS: Record<UserRole, RolePermissions> = {
  PARENT: {
    canManageBabies: true,
    canRegisterRoutines: true,
    canViewStats: true,
    canManageTeam: true,
    canExportData: true,
    canViewClinical: true,
    canEditRoutines: true,
    canDeleteRoutines: true,
  },
  CAREGIVER: {
    canManageBabies: false,
    canRegisterRoutines: true,
    canViewStats: true,
    canManageTeam: false,
    canExportData: false,
    canViewClinical: false,
    canEditRoutines: true,
    canDeleteRoutines: false,
  },
  PEDIATRICIAN: {
    canManageBabies: false,
    canRegisterRoutines: false,
    canViewStats: true,
    canManageTeam: false,
    canExportData: true,
    canViewClinical: true,
    canEditRoutines: false,
    canDeleteRoutines: false,
  },
  SPECIALIST: {
    canManageBabies: false,
    canRegisterRoutines: false,
    canViewStats: true,
    canManageTeam: false,
    canExportData: false,
    canViewClinical: true,
    canEditRoutines: false,
    canDeleteRoutines: false,
  },
  ADMIN: {
    canManageBabies: true,
    canRegisterRoutines: true,
    canViewStats: true,
    canManageTeam: true,
    canExportData: true,
    canViewClinical: true,
    canEditRoutines: true,
    canDeleteRoutines: true,
  },
};

// ==========================================
// Predefined Milestones
// ==========================================

export const PREDEFINED_MILESTONES = [
  { key: 'head_control', label: 'Controle de cabeça' },
  { key: 'social_smile', label: 'Primeiro sorriso social' },
  { key: 'roll_over', label: 'Virar sozinho' },
  { key: 'sit', label: 'Sentar sem apoio' },
  { key: 'crawl', label: 'Engatinhar' },
  { key: 'stand', label: 'Ficar em pé' },
  { key: 'first_steps', label: 'Primeiros passos' },
  { key: 'first_words', label: 'Primeiras palavras' },
  { key: 'other', label: 'Outro marco' },
] as const;

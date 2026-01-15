// Olive Baby API - Entitlements Types
import { PlanType, SubscriptionStatus } from '@prisma/client';

// ==========================================
// Plan Limits & Features
// ==========================================

export interface PlanLimits {
  maxBabies: number;           // -1 = unlimited
  maxProfessionals: number;    // -1 = unlimited
  maxExportsPerMonth: number;  // -1 = unlimited
  historyDays: number;         // -1 = unlimited
}

export interface PlanFeatures {
  exportPdf: boolean;
  exportCsv: boolean;
  advancedInsights: boolean;
  aiChat: boolean;
  multiCaregivers: boolean;
  prioritySupport: boolean;
  vaccines: boolean; // Calendário de vacinas
}

// Feature keys for type-safe checks
export type FeatureKey = keyof PlanFeatures;

// Resource keys for limit checks
export type ResourceKey = keyof PlanLimits;

// ==========================================
// User Entitlements
// ==========================================

export interface UserEntitlements {
  userId: number;
  planId: number;
  planType: PlanType;
  planName: string;
  subscriptionStatus: SubscriptionStatus | null;
  limits: PlanLimits;
  features: PlanFeatures;
  isActive: boolean;
}

// ==========================================
// Default Plan Values
// ==========================================

export const DEFAULT_FREE_LIMITS: PlanLimits = {
  maxBabies: 1,
  maxProfessionals: 0,
  maxExportsPerMonth: 0,
  historyDays: 7,
};

export const DEFAULT_FREE_FEATURES: PlanFeatures = {
  exportPdf: false,
  exportCsv: false,
  advancedInsights: false,
  aiChat: false,
  multiCaregivers: false,
  prioritySupport: false,
  vaccines: false,
};

export const DEFAULT_PREMIUM_LIMITS: PlanLimits = {
  maxBabies: 5,
  maxProfessionals: 10,
  maxExportsPerMonth: -1,
  historyDays: -1,
};

export const DEFAULT_PREMIUM_FEATURES: PlanFeatures = {
  exportPdf: true,
  exportCsv: true,
  advancedInsights: true,
  aiChat: true,
  multiCaregivers: true,
  prioritySupport: true,
  vaccines: true,
};

// ==========================================
// Error Codes
// ==========================================

export const ENTITLEMENT_ERRORS = {
  PLAN_UPGRADE_REQUIRED: 'PLAN_UPGRADE_REQUIRED',
  LIMIT_EXCEEDED: 'LIMIT_EXCEEDED',
  FEATURE_NOT_AVAILABLE: 'FEATURE_NOT_AVAILABLE',
  SUBSCRIPTION_INACTIVE: 'SUBSCRIPTION_INACTIVE',
  USER_BLOCKED: 'USER_BLOCKED',
} as const;

export type EntitlementErrorCode = typeof ENTITLEMENT_ERRORS[keyof typeof ENTITLEMENT_ERRORS];

// ==========================================
// Feature Display Names (i18n ready)
// ==========================================

export const FEATURE_DISPLAY_NAMES: Record<FeatureKey, string> = {
  exportPdf: 'Exportar PDF',
  exportCsv: 'Exportar CSV',
  advancedInsights: 'Insights Avançados',
  aiChat: 'Assistente IA',
  multiCaregivers: 'Múltiplos Cuidadores',
  prioritySupport: 'Suporte Prioritário',
  vaccines: 'Calendário de Vacinas',
};

export const RESOURCE_DISPLAY_NAMES: Record<ResourceKey, string> = {
  maxBabies: 'Número de Bebês',
  maxProfessionals: 'Profissionais Vinculados',
  maxExportsPerMonth: 'Exportações por Mês',
  historyDays: 'Dias de Histórico',
};


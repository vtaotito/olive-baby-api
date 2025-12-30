// Olive Baby API - Entitlements Service
import { PrismaClient, PlanType, UserStatus } from '@prisma/client';
import { AppError } from '../../utils/errors/AppError';
import {
  UserEntitlements,
  PlanLimits,
  PlanFeatures,
  FeatureKey,
  ResourceKey,
  DEFAULT_FREE_LIMITS,
  DEFAULT_FREE_FEATURES,
  ENTITLEMENT_ERRORS,
  FEATURE_DISPLAY_NAMES,
  RESOURCE_DISPLAY_NAMES,
} from './types';

const prisma = new PrismaClient();

// Cache for plan data (5 minutes TTL)
const planCache = new Map<number, { data: any; expiry: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export class EntitlementsService {
  /**
   * Get user entitlements (plan, features, limits)
   */
  static async getUserEntitlements(userId: number): Promise<UserEntitlements> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        plan: true,
        subscription: true,
      },
    });

    if (!user) {
      throw AppError.notFound('Usuário não encontrado');
    }

    // Check if user is blocked
    if (user.status === UserStatus.BLOCKED) {
      throw AppError.forbidden('Conta bloqueada. Entre em contato com o suporte.', {
        errorCode: ENTITLEMENT_ERRORS.USER_BLOCKED,
      });
    }

    // If user has no plan, assign FREE plan defaults
    if (!user.plan) {
      return {
        userId: user.id,
        planId: 0,
        planType: PlanType.FREE,
        planName: 'Free',
        subscriptionStatus: null,
        limits: DEFAULT_FREE_LIMITS,
        features: DEFAULT_FREE_FEATURES,
        isActive: true,
      };
    }

    // Parse limits and features from JSON
    const limits = (user.plan.limits as unknown as PlanLimits) || DEFAULT_FREE_LIMITS;
    const features = (user.plan.features as unknown as PlanFeatures) || DEFAULT_FREE_FEATURES;

    // Check subscription status
    const subscriptionStatus = user.subscription?.status || null;
    const isSubscriptionActive = !subscriptionStatus || 
      subscriptionStatus === 'ACTIVE' || 
      subscriptionStatus === 'TRIAL';

    return {
      userId: user.id,
      planId: user.plan.id,
      planType: user.plan.type,
      planName: user.plan.name,
      subscriptionStatus,
      limits,
      features,
      isActive: isSubscriptionActive && user.plan.isActive,
    };
  }

  /**
   * Check if user can use a feature
   */
  static async can(userId: number, feature: FeatureKey): Promise<boolean> {
    try {
      const entitlements = await this.getUserEntitlements(userId);
      return entitlements.isActive && entitlements.features[feature] === true;
    } catch {
      return false;
    }
  }

  /**
   * Assert user can use a feature (throws if not)
   */
  static async assertCan(userId: number, feature: FeatureKey): Promise<void> {
    const entitlements = await this.getUserEntitlements(userId);

    if (!entitlements.isActive) {
      throw AppError.forbidden('Sua assinatura não está ativa.', {
        errorCode: ENTITLEMENT_ERRORS.SUBSCRIPTION_INACTIVE,
      });
    }

    if (!entitlements.features[feature]) {
      throw AppError.forbidden(
        `Este recurso requer um plano superior: ${FEATURE_DISPLAY_NAMES[feature]}`,
        {
          success: false,
          errorCode: ENTITLEMENT_ERRORS.PLAN_UPGRADE_REQUIRED,
          feature,
          featureName: FEATURE_DISPLAY_NAMES[feature],
          currentPlan: entitlements.planType,
          requiredPlan: 'PREMIUM',
        }
      );
    }
  }

  /**
   * Check if user is within resource limits
   */
  static async isWithinLimit(
    userId: number,
    resource: ResourceKey,
    currentCount: number
  ): Promise<boolean> {
    try {
      const entitlements = await this.getUserEntitlements(userId);
      const limit = entitlements.limits[resource];
      
      // -1 means unlimited
      if (limit === -1) return true;
      
      return currentCount < limit;
    } catch {
      return false;
    }
  }

  /**
   * Assert user is within resource limits (throws if exceeded)
   */
  static async assertWithinLimit(
    userId: number,
    resource: ResourceKey,
    currentCount: number
  ): Promise<void> {
    const entitlements = await this.getUserEntitlements(userId);
    const limit = entitlements.limits[resource];

    // -1 means unlimited
    if (limit === -1) return;

    if (currentCount >= limit) {
      throw AppError.forbidden(
        `Limite atingido: ${RESOURCE_DISPLAY_NAMES[resource]} (${currentCount}/${limit})`,
        {
          success: false,
          errorCode: ENTITLEMENT_ERRORS.LIMIT_EXCEEDED,
          resource,
          resourceName: RESOURCE_DISPLAY_NAMES[resource],
          currentCount,
          limit,
          currentPlan: entitlements.planType,
          requiredPlan: 'PREMIUM',
        }
      );
    }
  }

  /**
   * Get remaining quota for a resource
   */
  static async getRemainingQuota(
    userId: number,
    resource: ResourceKey,
    currentCount: number
  ): Promise<{ limit: number; used: number; remaining: number; unlimited: boolean }> {
    const entitlements = await this.getUserEntitlements(userId);
    const limit = entitlements.limits[resource];

    if (limit === -1) {
      return { limit: -1, used: currentCount, remaining: -1, unlimited: true };
    }

    return {
      limit,
      used: currentCount,
      remaining: Math.max(0, limit - currentCount),
      unlimited: false,
    };
  }

  /**
   * Get plan by type
   */
  static async getPlanByType(type: PlanType) {
    // Check cache first
    const cached = planCache.get(type === 'FREE' ? 1 : 2);
    if (cached && cached.expiry > Date.now()) {
      return cached.data;
    }

    const plan = await prisma.plan.findUnique({
      where: { type },
    });

    if (plan) {
      planCache.set(plan.id, { data: plan, expiry: Date.now() + CACHE_TTL });
    }

    return plan;
  }

  /**
   * Assign plan to user
   */
  static async assignPlan(userId: number, planType: PlanType): Promise<void> {
    const plan = await this.getPlanByType(planType);
    
    if (!plan) {
      throw AppError.notFound(`Plano ${planType} não encontrado`);
    }

    await prisma.user.update({
      where: { id: userId },
      data: { planId: plan.id },
    });
  }

  /**
   * Get all available plans
   */
  static async getAvailablePlans() {
    return prisma.plan.findMany({
      where: { isActive: true },
      orderBy: { price: 'asc' },
    });
  }

  /**
   * Check if user needs upgrade for specific action
   * Returns upgrade info if needed, null if allowed
   */
  static async checkUpgradeNeeded(
    userId: number,
    action: 'create_baby' | 'invite_professional' | 'export' | 'ai_chat'
  ): Promise<{
    needed: boolean;
    feature?: FeatureKey;
    resource?: ResourceKey;
    message?: string;
  }> {
    const entitlements = await this.getUserEntitlements(userId);

    switch (action) {
      case 'create_baby': {
        const babyCount = await prisma.caregiverBaby.count({
          where: {
            caregiver: { userId },
          },
        });
        const limit = entitlements.limits.maxBabies;
        if (limit !== -1 && babyCount >= limit) {
          return {
            needed: true,
            resource: 'maxBabies',
            message: `Você atingiu o limite de ${limit} bebê(s) no plano ${entitlements.planName}`,
          };
        }
        break;
      }

      case 'invite_professional': {
        const profCount = await prisma.babyProfessional.count({
          where: {
            baby: {
              caregivers: {
                some: {
                  caregiver: { userId },
                  isPrimary: true,
                },
              },
            },
          },
        });
        const limit = entitlements.limits.maxProfessionals;
        if (limit !== -1 && profCount >= limit) {
          return {
            needed: true,
            resource: 'maxProfessionals',
            message: `Você atingiu o limite de ${limit} profissional(is) no plano ${entitlements.planName}`,
          };
        }
        break;
      }

      case 'export': {
        if (!entitlements.features.exportPdf && !entitlements.features.exportCsv) {
          return {
            needed: true,
            feature: 'exportPdf',
            message: 'Exportação de dados está disponível apenas no plano Premium',
          };
        }
        break;
      }

      case 'ai_chat': {
        if (!entitlements.features.aiChat) {
          return {
            needed: true,
            feature: 'aiChat',
            message: 'Assistente IA está disponível apenas no plano Premium',
          };
        }
        break;
      }
    }

    return { needed: false };
  }
}


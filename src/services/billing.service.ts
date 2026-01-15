// Olive Baby API - Billing Service
// Stripe integration for subscriptions management

import Stripe from 'stripe';
import { PrismaClient, SubscriptionStatus, BillingInterval, PlanType } from '@prisma/client';
import { env } from '../config/env';
import { AppError } from '../utils/errors/AppError';
import { logger } from '../config/logger';

const prisma = new PrismaClient();

// Initialize Stripe (only if key is configured)
const stripe = env.STRIPE_SECRET_KEY 
  ? new Stripe(env.STRIPE_SECRET_KEY)
  : null;

// Map Stripe subscription status to our enum
function mapStripeStatus(stripeStatus: Stripe.Subscription.Status): SubscriptionStatus {
  const statusMap: Record<string, SubscriptionStatus> = {
    'active': 'ACTIVE',
    'incomplete': 'INCOMPLETE',
    'incomplete_expired': 'INCOMPLETE_EXPIRED',
    'past_due': 'PAST_DUE',
    'canceled': 'CANCELED',
    'unpaid': 'UNPAID',
    'trialing': 'TRIALING',
    'paused': 'PAUSED',
  };
  return statusMap[stripeStatus] || 'ACTIVE';
}

export class BillingService {
  /**
   * Check if Stripe is configured
   */
  static isStripeConfigured(): boolean {
    return !!stripe;
  }

  /**
   * Get or create Stripe customer for user
   */
  static async getOrCreateStripeCustomer(userId: number): Promise<string> {
    if (!stripe) {
      throw AppError.internal('Stripe não está configurado');
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { caregiver: true },
    });

    if (!user) {
      throw AppError.notFound('Usuário não encontrado');
    }

    // Return existing customer
    if (user.stripeCustomerId) {
      return user.stripeCustomerId;
    }

    // Create new customer
    const customer = await stripe.customers.create({
      email: user.email,
      name: user.caregiver?.fullName || user.email,
      metadata: {
        userId: user.id.toString(),
      },
    });

    // Save customer ID
    await prisma.user.update({
      where: { id: userId },
      data: { stripeCustomerId: customer.id },
    });

    logger.info(`Stripe customer created: ${customer.id} for user ${userId}`);
    return customer.id;
  }

  /**
   * Create Checkout Session for subscription
   */
  static async createCheckoutSession(
    userId: number,
    planCode: string,
    interval: 'monthly' | 'yearly' = 'monthly'
  ): Promise<{ url: string; sessionId: string }> {
    if (!stripe) {
      throw AppError.internal('Stripe não está configurado');
    }

    // Get plan (case-insensitive search)
    const plan = await prisma.plan.findFirst({
      where: { 
        code: {
          equals: planCode,
          mode: 'insensitive',
        },
        isActive: true,
      },
    });

    if (!plan) {
      throw AppError.notFound(`Plano '${planCode}' não encontrado`);
    }

    // Determine price ID based on interval
    const priceId = interval === 'yearly' 
      ? plan.stripePriceIdYearly 
      : plan.stripePriceIdMonthly;

    if (!priceId) {
      throw AppError.badRequest(`Plano ${planCode} não tem preço configurado para intervalo ${interval}`);
    }

    // Get or create customer
    const customerId = await this.getOrCreateStripeCustomer(userId);

    // Check for existing subscription
    const existingSubscription = await prisma.subscription.findUnique({
      where: { userId },
    });

    if (existingSubscription) {
      // If subscription has Stripe ID and is active, block new checkout
      if (existingSubscription.status === 'ACTIVE' && existingSubscription.stripeSubscriptionId) {
        throw AppError.conflict('Usuário já possui uma assinatura ativa. Use o portal para gerenciar.');
      }
      
      // If subscription exists but has no Stripe ID (orphan) or is not active, clean it up
      if (!existingSubscription.stripeSubscriptionId || existingSubscription.status !== 'ACTIVE') {
        await prisma.subscription.delete({
          where: { userId },
        });
        logger.info(`Orphan subscription removed for user ${userId}`);
      }
    }

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: `${env.FRONTEND_URL}/settings/billing?success=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${env.FRONTEND_URL}/settings/billing?canceled=true`,
      subscription_data: {
        metadata: {
          userId: userId.toString(),
          planCode: planCode,
        },
      },
      metadata: {
        userId: userId.toString(),
        planCode: planCode,
      },
    });

    if (!session.url) {
      throw AppError.internal('Falha ao criar sessão de checkout');
    }

    logger.info(`Checkout session created: ${session.id} for user ${userId}`);
    return { url: session.url, sessionId: session.id };
  }

  /**
   * Create Customer Portal session
   */
  static async createPortalSession(userId: number, returnUrl?: string): Promise<{ url: string }> {
    if (!stripe) {
      throw AppError.internal('Stripe não está configurado');
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || !user.stripeCustomerId) {
      throw AppError.badRequest('Usuário não possui conta de billing');
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: user.stripeCustomerId,
      return_url: returnUrl || `${env.FRONTEND_URL}/settings/billing`,
    });

    logger.info(`Portal session created for user ${userId}`);
    return { url: session.url };
  }

  /**
   * Create Customer Portal session for a user (admin only)
   */
  static async createPortalSessionForUser(
    targetUserId: number,
    returnUrl?: string
  ): Promise<{ url: string }> {
    if (!stripe) {
      throw AppError.internal('Stripe não está configurado');
    }

    const user = await prisma.user.findUnique({
      where: { id: targetUserId },
    });

    if (!user || !user.stripeCustomerId) {
      throw AppError.badRequest('Usuário não possui conta de billing');
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: user.stripeCustomerId,
      return_url: returnUrl || `${env.FRONTEND_URL}/admin/billing`,
    });

    return { url: session.url };
  }

  /**
   * Get user billing status
   */
  static async getBillingStatus(userId: number) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        plan: true,
        subscription: {
          include: {
            plan: true,
          },
        },
      },
    });

    if (!user) {
      throw AppError.notFound('Usuário não encontrado');
    }

    // Use EntitlementsService to get correct features (with Premium defaults)
    const { EntitlementsService } = await import('../core/entitlements');
    const entitlements = await EntitlementsService.getUserEntitlements(userId);

    return {
      // Return both 'plan' and 'planType' for compatibility
      plan: entitlements.planType,
      planType: entitlements.planType,
      planName: entitlements.planName,
      isActive: entitlements.isActive,
      subscription: user.subscription ? {
        status: user.subscription.status,
        interval: user.subscription.interval,
        currentPeriodStart: user.subscription.currentPeriodStart,
        currentPeriodEnd: user.subscription.currentPeriodEnd,
        cancelAtPeriodEnd: user.subscription.cancelAtPeriodEnd,
      } : null,
      stripeCustomerId: user.stripeCustomerId,
      features: entitlements.features, // Use features from EntitlementsService (guaranteed complete)
      limits: entitlements.limits, // Use limits from EntitlementsService
    };
  }

  /**
   * Process webhook event (idempotent)
   */
  static async processWebhookEvent(event: Stripe.Event): Promise<void> {
    // Check if event already processed (idempotency)
    const existingEvent = await prisma.billingEvent.findUnique({
      where: { stripeEventId: event.id },
    });

    if (existingEvent?.processed) {
      logger.info(`Event ${event.id} already processed, skipping`);
      return;
    }

    // Create or update billing event
    const billingEvent = await prisma.billingEvent.upsert({
      where: { stripeEventId: event.id },
      create: {
        stripeEventId: event.id,
        type: event.type,
        payload: event.data.object as any,
        processed: false,
      },
      update: {},
    });

    try {
      // Process based on event type
      switch (event.type) {
        case 'checkout.session.completed':
          await this.handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
          break;
        case 'customer.subscription.created':
        case 'customer.subscription.updated':
          await this.handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
          break;
        case 'customer.subscription.deleted':
          await this.handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
          break;
        case 'invoice.paid':
          await this.handleInvoicePaid(event.data.object as Stripe.Invoice);
          break;
        case 'invoice.payment_failed':
          await this.handleInvoicePaymentFailed(event.data.object as Stripe.Invoice);
          break;
        default:
          logger.info(`Unhandled event type: ${event.type}`);
      }

      // Mark as processed
      await prisma.billingEvent.update({
        where: { id: billingEvent.id },
        data: { processed: true, processedAt: new Date() },
      });

      logger.info(`Event ${event.id} processed successfully`);
    } catch (error) {
      // Log error but don't throw (webhook should return 200)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      await prisma.billingEvent.update({
        where: { id: billingEvent.id },
        data: { errorMessage },
      });
      logger.error(`Error processing event ${event.id}: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * Handle checkout.session.completed
   */
  private static async handleCheckoutCompleted(session: Stripe.Checkout.Session): Promise<void> {
    const userId = parseInt(session.metadata?.userId || '0', 10);
    if (!userId) {
      logger.warn('Checkout completed without userId in metadata');
      return;
    }

    logger.info(`Checkout completed for user ${userId}, processing subscription...`);

    // Fetch the subscription from Stripe and process it
    if (session.subscription && stripe) {
      try {
        const subscription = await stripe.subscriptions.retrieve(session.subscription as string);
        await this.handleSubscriptionUpdated(subscription);
        logger.info(`Subscription ${subscription.id} processed from checkout for user ${userId}`);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        logger.error(`Failed to process subscription from checkout: ${errorMessage}`);
      }
    }
  }

  /**
   * Handle subscription created/updated
   */
  private static async handleSubscriptionUpdated(subscription: Stripe.Subscription): Promise<void> {
    const userId = parseInt(subscription.metadata?.userId || '0', 10);
    
    // If no userId in metadata, find by customer
    let finalUserId = userId;
    if (!finalUserId) {
      const user = await prisma.user.findFirst({
        where: { stripeCustomerId: subscription.customer as string },
      });
      if (user) {
        finalUserId = user.id;
      }
    }

    if (!finalUserId) {
      logger.warn('Subscription updated without valid userId');
      return;
    }

    // Get plan from metadata or price (case-insensitive code search)
    const planCode = subscription.metadata?.planCode || 'PREMIUM';
    const plan = await prisma.plan.findFirst({
      where: { 
        OR: [
          { code: { equals: planCode, mode: 'insensitive' } },
          { stripePriceIdMonthly: subscription.items.data[0]?.price.id },
          { stripePriceIdYearly: subscription.items.data[0]?.price.id },
        ],
      },
    });

    if (!plan) {
      logger.error(`Plan not found for subscription ${subscription.id}`);
      return;
    }

    // Determine interval from price
    const priceId = subscription.items.data[0]?.price.id;
    const interval: BillingInterval = priceId === plan.stripePriceIdYearly ? 'YEARLY' : 'MONTHLY';

    // Get period dates from subscription
    const currentPeriodStart = (subscription as any).current_period_start 
      ? new Date((subscription as any).current_period_start * 1000) 
      : null;
    const currentPeriodEnd = (subscription as any).current_period_end 
      ? new Date((subscription as any).current_period_end * 1000) 
      : null;

    // Upsert subscription
    await prisma.subscription.upsert({
      where: { userId: finalUserId },
      create: {
        userId: finalUserId,
        planId: plan.id,
        stripeSubscriptionId: subscription.id,
        stripePriceId: priceId,
        status: mapStripeStatus(subscription.status),
        interval,
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
        currentPeriodStart,
        currentPeriodEnd,
        provider: 'stripe',
      },
      update: {
        planId: plan.id,
        stripeSubscriptionId: subscription.id,
        stripePriceId: priceId,
        status: mapStripeStatus(subscription.status),
        interval,
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
        currentPeriodStart,
        currentPeriodEnd,
      },
    });

    // Update user plan if subscription is active
    if (subscription.status === 'active' || subscription.status === 'trialing') {
      await prisma.user.update({
        where: { id: finalUserId },
        data: {
          planId: plan.id,
          currentPeriodEnd,
        },
      });
    }

    logger.info(`Subscription ${subscription.id} updated for user ${finalUserId}`);
  }

  /**
   * Handle subscription deleted/canceled
   */
  private static async handleSubscriptionDeleted(subscription: Stripe.Subscription): Promise<void> {
    // Find subscription in our database
    const dbSubscription = await prisma.subscription.findFirst({
      where: { stripeSubscriptionId: subscription.id },
    });

    if (!dbSubscription) {
      logger.warn(`Subscription ${subscription.id} not found in database`);
      return;
    }

    // Get FREE plan
    const freePlan = await prisma.plan.findFirst({
      where: { type: 'FREE' },
    });

    // Update subscription status
    await prisma.subscription.update({
      where: { id: dbSubscription.id },
      data: {
        status: 'CANCELED',
        canceledAt: new Date(),
      },
    });

    // Downgrade user to FREE plan
    await prisma.user.update({
      where: { id: dbSubscription.userId },
      data: {
        planId: freePlan?.id || null,
        currentPeriodEnd: null,
      },
    });

    logger.info(`Subscription ${subscription.id} canceled, user ${dbSubscription.userId} downgraded to FREE`);
  }

  /**
   * Handle invoice paid
   */
  private static async handleInvoicePaid(invoice: Stripe.Invoice): Promise<void> {
    const subscriptionId = (invoice as any).subscription;
    if (!subscriptionId) return;

    logger.info(`Invoice ${invoice.id} paid for subscription ${subscriptionId}`);
    
    // Subscription status is updated via subscription.updated event
  }

  /**
   * Handle invoice payment failed
   */
  private static async handleInvoicePaymentFailed(invoice: Stripe.Invoice): Promise<void> {
    const subscriptionId = (invoice as any).subscription;
    if (!subscriptionId) return;

    logger.warn(`Invoice ${invoice.id} payment failed for subscription ${subscriptionId}`);
    
    // Could send notification email here
  }

  /**
   * Verify webhook signature
   */
  static verifyWebhookSignature(payload: string | Buffer, signature: string): Stripe.Event {
    if (!stripe || !env.STRIPE_WEBHOOK_SECRET) {
      throw AppError.internal('Stripe webhook não está configurado');
    }

    try {
      return stripe.webhooks.constructEvent(payload, signature, env.STRIPE_WEBHOOK_SECRET);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      throw AppError.unauthorized(`Webhook signature verification failed: ${message}`);
    }
  }

  /**
   * Get available plans for display
   */
  static async getAvailablePlans() {
    const plans = await prisma.plan.findMany({
      where: { isActive: true },
      orderBy: { price: 'asc' },
    });

    return plans.map(plan => ({
      id: plan.id,
      code: plan.code,
      name: plan.name,
      type: plan.type,
      description: plan.description,
      price: parseFloat(plan.price.toString()),
      priceYearly: plan.priceYearly ? parseFloat(plan.priceYearly.toString()) : null,
      currency: plan.currency,
      features: plan.features,
      limits: plan.limits,
      hasStripeIntegration: !!(plan.stripePriceIdMonthly || plan.stripePriceIdYearly),
    }));
  }

  /**
   * Admin: Get recent subscriptions
   */
  static async getRecentSubscriptions(limit = 50) {
    const subscriptions = await prisma.subscription.findMany({
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            caregiver: {
              select: { fullName: true },
            },
          },
        },
        plan: {
          select: {
            code: true,
            name: true,
            type: true,
          },
        },
      },
    });

    return subscriptions;
  }

  /**
   * Admin: Get recent billing events
   */
  static async getRecentBillingEvents(limit = 100) {
    const events = await prisma.billingEvent.findMany({
      take: limit,
      orderBy: { createdAt: 'desc' },
    });

    return events;
  }

  /**
   * Admin: Update plan Stripe configuration
   */
  static async updatePlanStripeConfig(
    planId: number,
    data: {
      stripeProductId?: string;
      stripePriceIdMonthly?: string;
      stripePriceIdYearly?: string;
    }
  ) {
    const plan = await prisma.plan.update({
      where: { id: planId },
      data: {
        stripeProductId: data.stripeProductId,
        stripePriceIdMonthly: data.stripePriceIdMonthly,
        stripePriceIdYearly: data.stripePriceIdYearly,
      },
    });

    return plan;
  }
}

export default BillingService;

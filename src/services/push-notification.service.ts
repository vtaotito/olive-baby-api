// OlieCare API - Push Notification Service
// Envio real de push notifications via Web Push (VAPID), FCM (Firebase) e Expo
import { DevicePlatform } from '@prisma/client';
import { DeviceTokenService } from './device-token.service';
import { sendWebPushNotification, isWebPushConfigured } from '../config/webpush';
import { getFirebaseMessaging, isFirebaseConfigured } from '../config/firebase';
import { logger } from '../config/logger';
import { prisma } from '../config/database';

// ==========================================
// Types
// ==========================================

export interface PushPayload {
  title: string;
  body: string;
  icon?: string;                           // Notification icon URL
  data?: Record<string, string>;           // Custom data payload
  badge?: number;                          // iOS badge count
  sound?: string;                          // Notification sound
  imageUrl?: string;                       // Rich notification image
  clickAction?: string;                    // URL or deep link
  channelId?: string;                      // Android notification channel
  collapseKey?: string;                    // Group/collapse notifications
  priority?: 'default' | 'high';
  tag?: string;                            // Notification tag (replace existing)
}

export interface PushResult {
  success: boolean;
  token: string;
  platform: DevicePlatform;
  error?: string;
}

// ==========================================
// Service
// ==========================================

export class PushNotificationService {
  /**
   * Send push notification to a single user (all their devices)
   */
  static async sendToUser(userId: number, payload: PushPayload): Promise<PushResult[]> {
    const tokens = await DeviceTokenService.getActiveTokensForUser(userId);

    if (tokens.length === 0) {
      logger.debug(`[Push] Nenhum device token ativo para user ${userId}`);
      return [];
    }

    const results = await Promise.allSettled(
      tokens.map((t) => PushNotificationService.sendToDevice(t.token, t.platform, payload))
    );

    const pushResults: PushResult[] = results.map((result, index) => {
      if (result.status === 'fulfilled') {
        return result.value;
      }
      return {
        success: false,
        token: tokens[index].token,
        platform: tokens[index].platform,
        error: result.reason?.message || 'Erro desconhecido',
      };
    });

    // Deactivate tokens that failed permanently
    for (const result of pushResults) {
      if (!result.success && PushNotificationService.isTokenInvalid(result.error)) {
        await DeviceTokenService.deactivateToken(result.token);
        logger.warn(`[Push] Token inválido desativado: ${result.token.substring(0, 20)}...`);
      }
    }

    const successCount = pushResults.filter((r) => r.success).length;
    logger.info(`[Push] Enviado para user ${userId}: ${successCount}/${pushResults.length} sucesso`);

    return pushResults;
  }

  /**
   * Send push notification to multiple users
   */
  static async sendToUsers(userIds: number[], payload: PushPayload): Promise<Map<number, PushResult[]>> {
    const tokens = await DeviceTokenService.getActiveTokensForUsers(userIds);
    const resultMap = new Map<number, PushResult[]>();

    // Group tokens by userId
    const tokensByUser = new Map<number, typeof tokens>();
    for (const t of tokens) {
      if (!tokensByUser.has(t.userId)) {
        tokensByUser.set(t.userId, []);
      }
      tokensByUser.get(t.userId)!.push(t);
    }

    // Send to each user's devices
    for (const [userId, userTokens] of tokensByUser) {
      const results = await Promise.allSettled(
        userTokens.map((t) => PushNotificationService.sendToDevice(t.token, t.platform, payload))
      );

      resultMap.set(
        userId,
        results.map((result, index) => {
          if (result.status === 'fulfilled') {
            return result.value;
          }
          return {
            success: false,
            token: userTokens[index].token,
            platform: userTokens[index].platform,
            error: result.reason?.message || 'Erro desconhecido',
          };
        })
      );
    }

    return resultMap;
  }

  /**
   * Send to a single device — router for platform-specific implementation
   */
  private static async sendToDevice(
    token: string,
    platform: DevicePlatform,
    payload: PushPayload
  ): Promise<PushResult> {
    switch (platform) {
      case 'WEB':
        return PushNotificationService.sendWebPush(token, payload);
      case 'ANDROID':
      case 'IOS':
        return PushNotificationService.sendFCM(token, platform, payload);
      case 'EXPO':
        return PushNotificationService.sendExpo(token, payload);
      default:
        return { success: false, token, platform, error: `Plataforma não suportada: ${platform}` };
    }
  }

  // ==========================================
  // Web Push (PWA / Service Worker)
  // ==========================================

  /**
   * Envia notificação via Web Push API (VAPID)
   * O token é o PushSubscription serializado como JSON string
   */
  private static async sendWebPush(subscriptionJson: string, payload: PushPayload): Promise<PushResult> {
    if (!isWebPushConfigured()) {
      logger.debug('[Push:WEB] Web Push não configurado (VAPID keys ausentes)');
      return { success: false, token: subscriptionJson, platform: 'WEB', error: 'Web Push não configurado' };
    }

    try {
      // Formatar payload para a Notification API do browser
      const webPayload = {
        title: payload.title,
        body: payload.body,
        icon: payload.icon || '/icon-192x192.png',
        badge: '/icon-72x72.png',
        image: payload.imageUrl,
        data: {
          ...payload.data,
          url: payload.clickAction || '/',
        },
        tag: payload.tag || payload.collapseKey,
        renotify: !!payload.tag,
        actions: [
          { action: 'open', title: 'Abrir' },
          { action: 'dismiss', title: 'Dispensar' },
        ],
      };

      await sendWebPushNotification(subscriptionJson, webPayload);

      logger.debug(`[Push:WEB] Enviado com sucesso`);
      return { success: true, token: subscriptionJson, platform: 'WEB' };
    } catch (error: any) {
      const statusCode = error?.statusCode;
      const errorBody = error?.body || error?.message || 'Erro desconhecido';

      logger.error(`[Push:WEB] Falha (status: ${statusCode}): ${errorBody}`);

      return {
        success: false,
        token: subscriptionJson,
        platform: 'WEB',
        error: `${statusCode || 'UNKNOWN'}: ${errorBody}`,
      };
    }
  }

  // ==========================================
  // Firebase Cloud Messaging (Android + iOS)
  // ==========================================

  /**
   * Envia notificação via Firebase Cloud Messaging
   * O token é o FCM registration token (string)
   */
  private static async sendFCM(
    token: string,
    platform: DevicePlatform,
    payload: PushPayload
  ): Promise<PushResult> {
    if (!isFirebaseConfigured()) {
      logger.debug('[Push:FCM] Firebase não configurado');
      return { success: false, token, platform, error: 'Firebase não configurado' };
    }

    const messaging = getFirebaseMessaging();
    if (!messaging) {
      return { success: false, token, platform, error: 'Firebase Messaging não inicializado' };
    }

    try {
      const message: any = {
        token,
        notification: {
          title: payload.title,
          body: payload.body,
        },
        data: payload.data || {},
      };

      // Adicionar imagem se fornecida
      if (payload.imageUrl) {
        message.notification.imageUrl = payload.imageUrl;
      }

      // Configurações específicas por plataforma
      if (platform === 'ANDROID') {
        message.android = {
          priority: payload.priority === 'high' ? 'high' : 'normal',
          notification: {
            channelId: payload.channelId || 'olive_baby_default',
            sound: payload.sound || 'default',
            clickAction: payload.clickAction,
            tag: payload.tag || payload.collapseKey,
            icon: 'ic_notification',
            color: '#738251',
          },
          collapseKey: payload.collapseKey,
        };
      }

      if (platform === 'IOS') {
        message.apns = {
          headers: {
            'apns-priority': payload.priority === 'high' ? '10' : '5',
            ...(payload.collapseKey && { 'apns-collapse-id': payload.collapseKey }),
          },
          payload: {
            aps: {
              alert: {
                title: payload.title,
                body: payload.body,
              },
              sound: payload.sound || 'default',
              badge: payload.badge,
              'mutable-content': 1,
              'thread-id': payload.tag || 'olive-baby',
            },
          },
          ...(payload.imageUrl && {
            fcmOptions: {
              imageUrl: payload.imageUrl,
            },
          }),
        };
      }

      const messageId = await messaging.send(message);
      logger.debug(`[Push:FCM] Enviado com sucesso (messageId: ${messageId})`);

      return { success: true, token, platform };
    } catch (error: any) {
      const errorCode = error?.code || error?.errorInfo?.code || 'UNKNOWN';
      const errorMsg = error?.message || 'Erro desconhecido';

      logger.error(`[Push:FCM] Falha (${errorCode}): ${errorMsg}`);

      return {
        success: false,
        token,
        platform,
        error: `${errorCode}: ${errorMsg}`,
      };
    }
  }

  // ==========================================
  // Expo Push Notifications
  // ==========================================

  /**
   * Envia notificação via Expo Push API
   * TODO: Implementar quando migrar para React Native/Expo
   */
  private static async sendExpo(token: string, payload: PushPayload): Promise<PushResult> {
    logger.debug(`[Push:EXPO] Stub - token: ${token.substring(0, 20)}..., title: ${payload.title}`);
    // TODO: Implementar com expo-server-sdk quando o app nativo existir
    // import { Expo } from 'expo-server-sdk';
    // const expo = new Expo();
    // await expo.sendPushNotificationsAsync([{
    //   to: token,
    //   title: payload.title,
    //   body: payload.body,
    //   data: payload.data,
    //   sound: payload.sound || 'default',
    //   badge: payload.badge,
    // }]);
    return { success: false, token, platform: 'EXPO', error: 'Expo Push ainda não implementado' };
  }

  // ==========================================
  // Helpers
  // ==========================================

  /**
   * Check if a push error indicates the token is permanently invalid
   */
  private static isTokenInvalid(error?: string): boolean {
    if (!error) return false;
    const invalidTokenErrors = [
      // Web Push
      '404',
      '410',
      'NotRegistered',
      'InvalidRegistration',
      // FCM
      'messaging/registration-token-not-registered',
      'messaging/invalid-registration-token',
      'messaging/invalid-argument',
      // APNS
      'BadDeviceToken',
      'Unregistered',
      'DeviceNotRegistered',
      // Expo
      'DeviceNotRegistered',
      'InvalidToken',
    ];
    return invalidTokenErrors.some((e) => error.includes(e));
  }

  /**
   * Get push notification capabilities status
   */
  static getCapabilities(): {
    webPush: boolean;
    fcm: boolean;
    expo: boolean;
  } {
    return {
      webPush: isWebPushConfigured(),
      fcm: isFirebaseConfigured(),
      expo: false,
    };
  }

  /**
   * Log push notification send to EmailCommunication table for unified tracking
   */
  static async logPushCommunication(
    triggerType: string,
    channel: 'B2C' | 'B2B' | 'INTERNAL',
    userId?: number,
    metadata?: Record<string, unknown>
  ): Promise<void> {
    try {
      await prisma.emailCommunication.create({
        data: {
          templateType: `push_${triggerType}`,
          channel,
          recipientDomain: userId ? `user:${userId}` : null,
          metadata: (metadata ?? {}) as any,
        },
      });
    } catch (err) {
      logger.warn('[Push] Communication log failed', { triggerType, error: (err as Error).message });
    }
  }

  /**
   * Send push to a segment of users (admin broadcast)
   */
  static async sendToSegment(
    segment: 'all' | 'b2c' | 'b2b' | 'premium' | 'free',
    payload: PushPayload
  ): Promise<{ sent: number; failed: number; noToken: number }> {
    let whereClause: any = { status: 'ACTIVE', isActive: true };

    switch (segment) {
      case 'b2c':
        whereClause.role = { in: ['PARENT', 'CAREGIVER'] };
        break;
      case 'b2b':
        whereClause.role = { in: ['PEDIATRICIAN', 'SPECIALIST'] };
        break;
      case 'premium':
        whereClause.plan = { planType: 'PREMIUM' };
        break;
      case 'free':
        whereClause.OR = [{ planId: null }, { plan: { planType: 'FREE' } }];
        break;
    }

    const users = await prisma.user.findMany({
      where: whereClause,
      select: { id: true },
    });

    if (users.length === 0) {
      return { sent: 0, failed: 0, noToken: 0 };
    }

    const results = await PushNotificationService.sendToUsers(
      users.map(u => u.id),
      payload
    );

    let sent = 0;
    let failed = 0;
    let noToken = 0;

    for (const [userId, pushResults] of results) {
      if (pushResults.length === 0) {
        noToken++;
      } else {
        sent += pushResults.filter(r => r.success).length;
        failed += pushResults.filter(r => !r.success).length;
      }
    }

    const usersWithNoResults = users.length - results.size;
    noToken += usersWithNoResults;

    const channel = segment === 'b2b' ? 'B2B' : segment === 'all' ? 'INTERNAL' : 'B2C';
    await PushNotificationService.logPushCommunication('broadcast', channel, undefined, {
      segment,
      title: payload.title,
      sent,
      failed,
      noToken,
      totalUsers: users.length,
    });

    return { sent, failed, noToken };
  }
}

// ==========================================
// Push Trigger Definitions
// ==========================================

export interface PushTriggerDefinition {
  id: string;
  name: string;
  description: string;
  channel: 'B2C' | 'B2B' | 'INTERNAL';
  category: 'engagement' | 'lifecycle' | 'clinical' | 'system';
  defaultEnabled: boolean;
  defaultPayload: PushPayload;
  configSchema: {
    key: string;
    label: string;
    type: 'number' | 'boolean' | 'string';
    default: number | boolean | string;
  }[];
}

export const PUSH_TRIGGERS: PushTriggerDefinition[] = [
  // B2C - Engagement
  {
    id: 'routine_reminder',
    name: 'Lembrete de Rotina',
    description: 'Lembra o cuidador de registrar a rotina do bebê quando não há registros há X horas',
    channel: 'B2C',
    category: 'engagement',
    defaultEnabled: true,
    defaultPayload: {
      title: 'Hora de registrar! 📝',
      body: 'Não se esqueça de registrar a rotina do seu bebê. Manter os dados atualizados ajuda a identificar padrões.',
      clickAction: '/dashboard',
      icon: '/icon-192x192.png',
    },
    configSchema: [
      { key: 'hoursThreshold', label: 'Horas sem registro', type: 'number', default: 6 },
      { key: 'maxPerDay', label: 'Máximo por dia', type: 'number', default: 2 },
    ],
  },
  {
    id: 'inactivity_nudge',
    name: 'Nudge de Inatividade',
    description: 'Envia push para usuários inativos há X dias incentivando o retorno',
    channel: 'B2C',
    category: 'engagement',
    defaultEnabled: true,
    defaultPayload: {
      title: 'Sentimos sua falta! 🌿',
      body: 'Faz alguns dias que você não registra a rotina. Volte para acompanhar o desenvolvimento do seu bebê.',
      clickAction: '/dashboard',
    },
    configSchema: [
      { key: 'daysInactive', label: 'Dias de inatividade', type: 'number', default: 3 },
    ],
  },
  {
    id: 'weekly_summary',
    name: 'Resumo Semanal',
    description: 'Notifica o usuário sobre o resumo semanal da rotina do bebê',
    channel: 'B2C',
    category: 'engagement',
    defaultEnabled: false,
    defaultPayload: {
      title: 'Seu resumo semanal está pronto! 📊',
      body: 'Veja os padrões de alimentação, sono e crescimento do seu bebê nesta semana.',
      clickAction: '/dashboard',
    },
    configSchema: [
      { key: 'dayOfWeek', label: 'Dia da semana (0=Dom, 6=Sáb)', type: 'number', default: 1 },
    ],
  },
  // B2C - Lifecycle
  {
    id: 'subscription_expiring',
    name: 'Assinatura Expirando',
    description: 'Avisa quando a assinatura Premium está próxima do vencimento',
    channel: 'B2C',
    category: 'lifecycle',
    defaultEnabled: true,
    defaultPayload: {
      title: 'Sua assinatura expira em breve ⏰',
      body: 'Renove sua assinatura OlieCare Premium para continuar com acesso a todos os recursos.',
      clickAction: '/settings',
      priority: 'high',
    },
    configSchema: [
      { key: 'daysBefore', label: 'Dias antes do vencimento', type: 'number', default: 3 },
    ],
  },
  {
    id: 'welcome_onboarding',
    name: 'Onboarding Incompleto',
    description: 'Incentiva novos usuários que não completaram o cadastro do bebê',
    channel: 'B2C',
    category: 'lifecycle',
    defaultEnabled: true,
    defaultPayload: {
      title: 'Falta pouco para começar! 👶',
      body: 'Complete o cadastro do seu bebê para começar a acompanhar a rotina e receber insights personalizados.',
      clickAction: '/onboarding',
    },
    configSchema: [
      { key: 'hoursAfterRegister', label: 'Horas após registro', type: 'number', default: 24 },
    ],
  },
  // B2B - Clinical
  {
    id: 'patient_inactivity',
    name: 'Paciente Inativo',
    description: 'Alerta o profissional quando um paciente não registra rotina há X dias',
    channel: 'B2B',
    category: 'clinical',
    defaultEnabled: true,
    defaultPayload: {
      title: 'Paciente com registros desatualizados 📋',
      body: 'Um dos seus pacientes não registra a rotina há vários dias. Considere entrar em contato.',
      clickAction: '/prof/dashboard',
    },
    configSchema: [
      { key: 'daysInactive', label: 'Dias sem registro do paciente', type: 'number', default: 5 },
    ],
  },
  {
    id: 'new_patient_assigned',
    name: 'Novo Paciente',
    description: 'Notifica o profissional quando um novo paciente aceita o convite',
    channel: 'B2B',
    category: 'clinical',
    defaultEnabled: true,
    defaultPayload: {
      title: 'Novo paciente conectado! 🎉',
      body: 'Um paciente aceitou seu convite e já está disponível no seu painel.',
      clickAction: '/prof/dashboard',
      priority: 'high',
    },
    configSchema: [],
  },
  {
    id: 'patient_milestone',
    name: 'Marco do Paciente',
    description: 'Notifica o profissional sobre marcos de desenvolvimento dos pacientes',
    channel: 'B2B',
    category: 'clinical',
    defaultEnabled: false,
    defaultPayload: {
      title: 'Marco de desenvolvimento registrado! 🏆',
      body: 'Um paciente registrou um novo marco de desenvolvimento. Confira no painel.',
      clickAction: '/prof/dashboard',
    },
    configSchema: [],
  },
  // B2B - Engagement
  {
    id: 'prof_weekly_summary',
    name: 'Resumo Semanal Profissional',
    description: 'Resumo semanal com visão geral de todos os pacientes',
    channel: 'B2B',
    category: 'engagement',
    defaultEnabled: false,
    defaultPayload: {
      title: 'Resumo semanal dos pacientes 📊',
      body: 'Confira o resumo de atividade dos seus pacientes nesta semana.',
      clickAction: '/prof/dashboard',
    },
    configSchema: [
      { key: 'dayOfWeek', label: 'Dia da semana (0=Dom, 6=Sáb)', type: 'number', default: 1 },
    ],
  },
  // System
  {
    id: 'system_maintenance',
    name: 'Manutenção do Sistema',
    description: 'Avisa sobre manutenções programadas (envio manual pelo admin)',
    channel: 'INTERNAL',
    category: 'system',
    defaultEnabled: false,
    defaultPayload: {
      title: 'Manutenção programada 🔧',
      body: 'O OlieCare passará por manutenção. O serviço pode ficar indisponível por alguns minutos.',
    },
    configSchema: [],
  },
];

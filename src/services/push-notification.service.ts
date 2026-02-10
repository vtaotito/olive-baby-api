// Olive Baby API - Push Notification Service
// Envio real de push notifications via Web Push (VAPID), FCM (Firebase) e Expo
import { DevicePlatform } from '@prisma/client';
import { DeviceTokenService } from './device-token.service';
import { sendWebPushNotification, isWebPushConfigured } from '../config/webpush';
import { getFirebaseMessaging, isFirebaseConfigured } from '../config/firebase';
import { logger } from '../config/logger';

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
      expo: false, // TODO: implementar quando adicionar Expo
    };
  }
}

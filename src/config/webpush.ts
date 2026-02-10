// Olive Baby API - Web Push Configuration
// Configura VAPID keys para Web Push API (PWA notifications)
import webpush from 'web-push';
import { env } from './env';
import { logger } from './logger';

let isInitialized = false;

/**
 * Inicializa o web-push com VAPID keys
 * Requer: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT
 */
export function initializeWebPush(): boolean {
  if (isInitialized) return true;

  const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT } = env;

  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    logger.warn('[WebPush] VAPID keys não configuradas. Web Push desabilitado.');
    logger.warn('[WebPush] Configure: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY');
    return false;
  }

  try {
    webpush.setVapidDetails(
      VAPID_SUBJECT,
      VAPID_PUBLIC_KEY,
      VAPID_PRIVATE_KEY
    );

    isInitialized = true;
    logger.info('[WebPush] VAPID configurado com sucesso');
    return true;
  } catch (error) {
    logger.error('[WebPush] Erro ao configurar VAPID:', error);
    return false;
  }
}

/**
 * Envia uma notificação Web Push para uma subscription
 * @param subscription - PushSubscription serializada como JSON string
 * @param payload - Payload da notificação (será serializado como JSON)
 */
export async function sendWebPushNotification(
  subscriptionJson: string,
  payload: object
): Promise<webpush.SendResult> {
  if (!isInitialized) {
    const success = initializeWebPush();
    if (!success) {
      throw new Error('Web Push não está configurado. Configure as VAPID keys.');
    }
  }

  const subscription = JSON.parse(subscriptionJson) as webpush.PushSubscription;
  
  return webpush.sendNotification(
    subscription,
    JSON.stringify(payload),
    {
      TTL: 60 * 60, // 1 hora
      urgency: 'high',
    }
  );
}

/**
 * Retorna a VAPID public key (necessária pelo frontend para subscribe)
 */
export function getVapidPublicKey(): string | null {
  return env.VAPID_PUBLIC_KEY || null;
}

/**
 * Verifica se Web Push está configurado
 */
export function isWebPushConfigured(): boolean {
  return !!(env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY);
}

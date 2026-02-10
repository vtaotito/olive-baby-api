// Olive Baby API - Firebase Admin Configuration
// Inicializa o Firebase Admin SDK para envio de push notifications via FCM
import * as admin from 'firebase-admin';
import { env } from './env';
import { logger } from './logger';

let firebaseApp: admin.app.App | null = null;
let messagingInstance: admin.messaging.Messaging | null = null;

/**
 * Inicializa o Firebase Admin SDK (lazy initialization)
 * Requer: FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY
 */
function initializeFirebase(): admin.app.App | null {
  if (firebaseApp) return firebaseApp;

  const { FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY } = env;

  if (!FIREBASE_PROJECT_ID || !FIREBASE_CLIENT_EMAIL || !FIREBASE_PRIVATE_KEY) {
    logger.warn('[Firebase] Variáveis de ambiente não configuradas. FCM desabilitado.');
    logger.warn('[Firebase] Configure: FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY');
    return null;
  }

  try {
    firebaseApp = admin.initializeApp({
      credential: admin.credential.cert({
        projectId: FIREBASE_PROJECT_ID,
        clientEmail: FIREBASE_CLIENT_EMAIL,
        privateKey: FIREBASE_PRIVATE_KEY,
      }),
    });

    logger.info(`[Firebase] Admin SDK inicializado com sucesso (projeto: ${FIREBASE_PROJECT_ID})`);
    return firebaseApp;
  } catch (error) {
    logger.error('[Firebase] Erro ao inicializar Admin SDK:', error);
    return null;
  }
}

/**
 * Retorna a instância de Messaging do Firebase (para FCM)
 */
export function getFirebaseMessaging(): admin.messaging.Messaging | null {
  if (messagingInstance) return messagingInstance;

  const app = initializeFirebase();
  if (!app) return null;

  messagingInstance = admin.messaging(app);
  return messagingInstance;
}

/**
 * Verifica se o Firebase está configurado e disponível
 */
export function isFirebaseConfigured(): boolean {
  return !!(env.FIREBASE_PROJECT_ID && env.FIREBASE_CLIENT_EMAIL && env.FIREBASE_PRIVATE_KEY);
}

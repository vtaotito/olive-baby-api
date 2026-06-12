// OlieCare API - Push Trigger Execution
// Resolve a audiência elegível de cada trigger agendado e dispara os pushes.
// Sem isso, o cron enviaria todos os triggers para todos os usuários (spam).
import { prisma } from '../config/database';
import { logger } from '../config/logger';
import {
  PushNotificationService,
  PUSH_TRIGGERS,
  type PushPayload,
} from './push-notification.service';

export interface TriggerExecutionResult {
  triggerId: string;
  eligible: number;
  sent: number;
  failed: number;
  noToken: number;
  skipped: boolean;
  reason?: string;
  dryRun: boolean;
}

type TriggerConfigValues = Record<string, number | boolean | string>;

function numberConfig(config: TriggerConfigValues, key: string, fallback: number): number {
  const value = Number(config[key]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

/** Dia da semana atual em São Paulo (0=Dom ... 6=Sáb) */
function currentDayOfWeekSaoPaulo(): number {
  const weekday = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Sao_Paulo',
    weekday: 'short',
  }).format(new Date());
  return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(weekday);
}

// Triggers que são disparados por eventos da aplicação (não por cron)
const EVENT_DRIVEN_TRIGGERS = new Set(['new_patient_assigned', 'patient_milestone']);
// Triggers de envio manual pelo admin
const MANUAL_TRIGGERS = new Set(['system_maintenance']);

export class PushTriggerService {
  /**
   * Resolve os usuários elegíveis para um trigger agendado.
   * Retorna null quando o trigger não deve rodar agora (ex: dia da semana errado).
   */
  static async resolveAudience(
    triggerId: string,
    config: TriggerConfigValues
  ): Promise<{ userIds: number[] } | { skipped: true; reason: string }> {
    switch (triggerId) {
      case 'routine_reminder': {
        const hours = numberConfig(config, 'hoursThreshold', 6);
        const rows = await prisma.$queryRaw<Array<{ id: number }>>`
          SELECT DISTINCT u.id FROM users u
          JOIN caregivers c ON c.user_id = u.id
          WHERE u.status = 'ACTIVE' AND u.is_active = true
            AND u.role IN ('PARENT', 'CAREGIVER')
            AND EXISTS (SELECT 1 FROM caregiver_babies cb WHERE cb.caregiver_id = c.id)
            AND NOT EXISTS (
              SELECT 1 FROM caregiver_babies cb2
              JOIN routine_logs rl ON rl.baby_id = cb2.baby_id
              WHERE cb2.caregiver_id = c.id
                AND rl.start_time > NOW() - ${hours} * INTERVAL '1 hour'
            )
        `;
        return { userIds: rows.map(r => r.id) };
      }

      case 'inactivity_nudge': {
        const days = numberConfig(config, 'daysInactive', 3);
        const rows = await prisma.$queryRaw<Array<{ id: number }>>`
          SELECT u.id FROM users u
          WHERE u.status = 'ACTIVE' AND u.is_active = true
            AND u.role IN ('PARENT', 'CAREGIVER')
            AND u.last_activity_at IS NOT NULL
            AND u.last_activity_at < NOW() - ${days} * INTERVAL '1 day'
        `;
        return { userIds: rows.map(r => r.id) };
      }

      case 'weekly_summary': {
        const dayOfWeek = numberConfig(config, 'dayOfWeek', 1);
        if (currentDayOfWeekSaoPaulo() !== dayOfWeek) {
          return { skipped: true, reason: `Agendado para dia ${dayOfWeek} da semana` };
        }
        const rows = await prisma.$queryRaw<Array<{ id: number }>>`
          SELECT DISTINCT u.id FROM users u
          JOIN caregivers c ON c.user_id = u.id
          JOIN caregiver_babies cb ON cb.caregiver_id = c.id
          JOIN routine_logs rl ON rl.baby_id = cb.baby_id
            AND rl.start_time > NOW() - INTERVAL '7 days'
          WHERE u.status = 'ACTIVE' AND u.is_active = true
        `;
        return { userIds: rows.map(r => r.id) };
      }

      case 'subscription_expiring': {
        const days = numberConfig(config, 'daysBefore', 3);
        const rows = await prisma.$queryRaw<Array<{ user_id: number }>>`
          SELECT s.user_id FROM subscriptions s
          WHERE s.status = 'ACTIVE'
            AND s.current_period_end IS NOT NULL
            AND s.current_period_end BETWEEN NOW() AND NOW() + ${days} * INTERVAL '1 day'
        `;
        return { userIds: rows.map(r => r.user_id) };
      }

      case 'welcome_onboarding': {
        const hours = numberConfig(config, 'hoursAfterRegister', 24);
        const rows = await prisma.$queryRaw<Array<{ id: number }>>`
          SELECT u.id FROM users u
          WHERE u.status = 'ACTIVE' AND u.is_active = true
            AND u.role IN ('PARENT', 'CAREGIVER')
            AND u.onboarding_completed_at IS NULL
            AND u.created_at <= NOW() - ${hours} * INTERVAL '1 hour'
            AND u.created_at >= NOW() - INTERVAL '7 days'
        `;
        return { userIds: rows.map(r => r.id) };
      }

      case 'patient_inactivity': {
        const days = numberConfig(config, 'daysInactive', 5);
        const rows = await prisma.$queryRaw<Array<{ user_id: number }>>`
          SELECT DISTINCT p.user_id FROM professionals p
          JOIN baby_professionals bp ON bp.professional_id = p.id
          WHERE p.user_id IS NOT NULL
            AND NOT EXISTS (
              SELECT 1 FROM routine_logs rl
              WHERE rl.baby_id = bp.baby_id
                AND rl.start_time > NOW() - ${days} * INTERVAL '1 day'
            )
        `;
        return { userIds: rows.map(r => r.user_id) };
      }

      case 'prof_weekly_summary': {
        const dayOfWeek = numberConfig(config, 'dayOfWeek', 1);
        if (currentDayOfWeekSaoPaulo() !== dayOfWeek) {
          return { skipped: true, reason: `Agendado para dia ${dayOfWeek} da semana` };
        }
        const rows = await prisma.$queryRaw<Array<{ user_id: number }>>`
          SELECT DISTINCT p.user_id FROM professionals p
          JOIN baby_professionals bp ON bp.professional_id = p.id
          WHERE p.user_id IS NOT NULL
        `;
        return { userIds: rows.map(r => r.user_id) };
      }

      default:
        return { skipped: true, reason: `Trigger sem regra de elegibilidade: ${triggerId}` };
    }
  }

  /**
   * Executa um trigger agendado: resolve elegibilidade, envia e registra.
   * Com dryRun=true apenas retorna a contagem de elegíveis (não envia nada).
   */
  static async executeTrigger(
    triggerId: string,
    payload: PushPayload,
    config: TriggerConfigValues = {},
    dryRun = false
  ): Promise<TriggerExecutionResult> {
    const base: TriggerExecutionResult = {
      triggerId,
      eligible: 0,
      sent: 0,
      failed: 0,
      noToken: 0,
      skipped: false,
      dryRun,
    };

    if (EVENT_DRIVEN_TRIGGERS.has(triggerId)) {
      return { ...base, skipped: true, reason: 'Trigger disparado por evento da aplicação, não por cron' };
    }
    if (MANUAL_TRIGGERS.has(triggerId)) {
      return { ...base, skipped: true, reason: 'Trigger de envio manual (use o broadcast do admin)' };
    }

    const audience = await PushTriggerService.resolveAudience(triggerId, config);
    if ('skipped' in audience) {
      return { ...base, skipped: true, reason: audience.reason };
    }

    const eligible = audience.userIds.length;
    if (eligible === 0 || dryRun) {
      logger.info(`[PushTrigger] ${triggerId}: ${eligible} elegíveis${dryRun ? ' (dry run)' : ', nada a enviar'}`);
      return { ...base, eligible };
    }

    const results = await PushNotificationService.sendToUsers(audience.userIds, payload);

    let sent = 0;
    let failed = 0;
    let noToken = 0;
    for (const [, pushResults] of results) {
      if (pushResults.length === 0) noToken++;
      else {
        sent += pushResults.filter(r => r.success).length;
        failed += pushResults.filter(r => !r.success).length;
      }
    }
    noToken += eligible - results.size;

    const triggerDef = PUSH_TRIGGERS.find(t => t.id === triggerId);
    await PushNotificationService.logPushCommunication(
      triggerId,
      triggerDef?.channel ?? 'INTERNAL',
      undefined,
      { eligible, sent, failed, noToken, title: payload.title }
    );

    logger.info(`[PushTrigger] ${triggerId}: ${eligible} elegíveis, ${sent} enviados, ${failed} falhas, ${noToken} sem token`);

    return { ...base, eligible, sent, failed, noToken };
  }
}

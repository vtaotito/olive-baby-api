// Olive Baby API - Email Service
// Supports MailerSend (primary) and SMTP via Nodemailer (fallback)
import nodemailer from 'nodemailer';
import { env } from '../config/env';
import { logger } from '../config/logger';
import { prisma } from '../config/database';

// ==========================================
// Types
// ==========================================

interface EmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
}

interface MailerSendResponse {
  success: boolean;
  messageId?: string;
  error?: string;
}

// ==========================================
// MailerSend API Client
// ==========================================

class MailerSendClient {
  private apiKey: string;
  private fromEmail: string;
  private fromName: string;
  private baseUrl = 'https://api.mailersend.com/v1';

  constructor() {
    this.apiKey = env.MAILERSEND_API_KEY || '';
    this.fromEmail = env.MAILERSEND_FROM_EMAIL;
    this.fromName = env.MAILERSEND_FROM_NAME;
  }

  isConfigured(): boolean {
    return !!this.apiKey;
  }

  async send(options: EmailOptions): Promise<MailerSendResponse> {
    const recipients = Array.isArray(options.to) ? options.to : [options.to];

    const payload = {
      from: {
        email: this.fromEmail,
        name: this.fromName,
      },
      to: recipients.map(email => ({ email })),
      subject: options.subject,
      html: options.html,
      text: options.text || this.stripHtml(options.html),
      ...(options.replyTo && { reply_to: [{ email: options.replyTo }] }),
    };

    try {
      const response = await fetch(`${this.baseUrl}/email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(payload),
      });

      if (response.ok || response.status === 202) {
        const messageId = response.headers.get('x-message-id') || 'sent';
        logger.info('Email sent via MailerSend', { 
          to: recipients.map(e => e.substring(0, 3) + '***').join(', '),
          subject: options.subject.substring(0, 30),
          messageId,
        });
        return { success: true, messageId };
      }

      const errorData = await response.json().catch(() => ({}));
      const errorMessage = (errorData as any)?.message || `HTTP ${response.status}`;
      
      logger.error('MailerSend API error', { 
        status: response.status, 
        error: errorMessage,
        details: errorData,
      });
      
      return { success: false, error: errorMessage };
    } catch (error: any) {
      logger.error('MailerSend request failed', { error: error.message });
      return { success: false, error: error.message };
    }
  }

  private stripHtml(html: string): string {
    return html
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }
}

// ==========================================
// SMTP Fallback (Nodemailer)
// ==========================================

function createSmtpTransporter() {
  if (!env.SMTP_HOST || !env.SMTP_USER) {
    return null;
  }

  return nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_PORT === 465,
    auth: {
      user: env.SMTP_USER,
      pass: env.SMTP_PASS,
    },
  });
}

async function sendViaSMTP(options: EmailOptions): Promise<boolean> {
  const transporter = createSmtpTransporter();
  if (!transporter) {
    logger.warn('SMTP not configured');
    return false;
  }

  try {
    await transporter.sendMail({
      from: `"${env.MAILERSEND_FROM_NAME}" <${env.SMTP_USER}>`,
      to: Array.isArray(options.to) ? options.to.join(', ') : options.to,
      subject: options.subject,
      html: options.html,
      text: options.text,
      replyTo: options.replyTo,
    });
    
    logger.info('Email sent via SMTP fallback', { 
      subject: options.subject.substring(0, 30),
    });
    return true;
  } catch (error: any) {
    logger.error('SMTP send failed', { error: error.message });
    return false;
  }
}

// ==========================================
// Main Email Service
// ==========================================

const mailerSend = new MailerSendClient();

/**
 * Sends an email using MailerSend (primary) or SMTP (fallback)
 */
async function sendEmail(options: EmailOptions): Promise<boolean> {
  // Try MailerSend first
  if (mailerSend.isConfigured()) {
    const result = await mailerSend.send(options);
    if (result.success) {
      return true;
    }
    logger.warn('MailerSend failed, trying SMTP fallback');
  }

  // Fallback to SMTP
  return sendViaSMTP(options);
}

/** Tipos de template para tracking (admin comunicações) */
export const EMAIL_TEMPLATE_TYPES = {
  PROFESSIONAL_INVITE: 'professional_invite',
  BABY_INVITE: 'baby_invite',
  PASSWORD_RESET: 'password_reset',
  WELCOME: 'welcome',
  ALERT: 'alert',
  PAYMENT_CONFIRMATION: 'payment_confirmation',
  SUBSCRIPTION_CANCELLED: 'subscription_cancelled',
  PATIENT_INVITE: 'patient_invite',
} as const;

/** Canais: B2C (consumidor), B2B (profissional/clínica), INTERNAL (alertas) */
export type EmailChannel = 'B2C' | 'B2B' | 'INTERNAL';

/**
 * Registra envio no banco para volumetria e tracking (admin).
 * Não armazena e-mail completo; apenas domínio do destinatário para métricas.
 */
async function logEmailCommunication(
  templateType: string,
  channel: EmailChannel,
  toEmail?: string | string[],
  metadata?: Record<string, unknown>
): Promise<void> {
  try {
    const emails = toEmail ? (Array.isArray(toEmail) ? toEmail : [toEmail]) : [];
    const recipientDomain = emails.length > 0 ? (emails[0].split('@')[1] ?? null) : null;
    await prisma.emailCommunication.create({
      data: {
        templateType,
        channel,
        recipientDomain,
        metadata: (metadata ?? {}) as any,
      },
    });
  } catch (err) {
    logger.warn('Email communication log failed (table may not exist yet)', { templateType, error: (err as Error).message });
  }
}

// ==========================================
// Email Templates
// ==========================================

const baseStyles = `
  body { font-family: 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f4f4f4; }
  .container { max-width: 600px; margin: 0 auto; padding: 20px; }
  .header { background: linear-gradient(135deg, #4a7c59 0%, #6b9b7a 100%); color: white; padding: 30px 20px; border-radius: 8px 8px 0 0; text-align: center; }
  .header h2 { margin: 0; font-size: 24px; font-weight: 600; }
  .content { background: white; padding: 30px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 8px 8px; }
  .button { display: inline-block; padding: 14px 28px; background: linear-gradient(135deg, #4a7c59 0%, #6b9b7a 100%); color: white; text-decoration: none; border-radius: 6px; margin: 20px 0; font-weight: 600; }
  .button:hover { opacity: 0.9; }
  .footer { text-align: center; margin-top: 20px; color: #888; font-size: 12px; padding: 20px; }
  .logo { font-size: 28px; margin-bottom: 10px; }
  .warning { background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 15px 0; border-radius: 4px; }
  .info-box { background: #e8f5e9; border-left: 4px solid #4a7c59; padding: 15px; margin: 15px 0; border-radius: 4px; }
  .message-box { background: #f5f5f5; padding: 15px; margin: 15px 0; border-radius: 4px; }
`;

function wrapTemplate(content: string, title: string): string {
  return `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${title}</title>
      <style>${baseStyles}</style>
    </head>
    <body>
      <div class="container">
        ${content}
        <div class="footer">
          <p>🌿 <strong>Olive Baby</strong></p>
          <p>Acompanhamento do desenvolvimento do seu bebê</p>
          <p style="margin-top: 10px; font-size: 11px; color: #aaa;">
            Este é um email automático. Por favor, não responda diretamente.
          </p>
        </div>
      </div>
    </body>
    </html>
  `;
}

// ==========================================
// Public Email Functions
// ==========================================

/**
 * Mapeamento de roles de profissionais para português brasileiro (email de ativação)
 */
const professionalRoleLabelsMap: Record<string, string> = {
  PEDIATRICIAN: 'Pediatra',
  OBGYN: 'Obstetra/Ginecologista',
  LACTATION_CONSULTANT: 'Consultora de Amamentação',
  NUTRITIONIST: 'Nutricionista',
  PSYCHOLOGIST: 'Psicólogo(a)',
  SPEECH_THERAPIST: 'Fonoaudiólogo(a)',
  PHYSIOTHERAPIST: 'Fisioterapeuta',
  OCCUPATIONAL_THERAPIST: 'Terapeuta Ocupacional',
  NANNY: 'Babá',
  CAREGIVER: 'Cuidador(a)',
  OTHER: 'Outro Profissional',
};

/**
 * Envia convite para profissional
 */
export async function sendProfessionalInvite(data: {
  professionalEmail: string;
  professionalName: string;
  caregiverName: string;
  babyName: string;
  inviteToken: string;
  role: string;
}) {
  const activationUrl = `${env.FRONTEND_URL}/activate-professional?token=${data.inviteToken}`;
  const roleLabel = professionalRoleLabelsMap[data.role] || data.role;

  const content = `
    <div class="header">
      <div class="logo">🌿</div>
      <h2>Convite para Acompanhar ${data.babyName}</h2>
    </div>
    <div class="content">
      <p>Olá <strong>${data.professionalName}</strong>,</p>
      <p><strong>${data.caregiverName}</strong> convidou você para acompanhar o desenvolvimento de <strong>${data.babyName}</strong> na plataforma Olive Baby.</p>
      <div class="info-box">
        <p><strong>Papel:</strong> ${roleLabel}</p>
      </div>
      <p>Clique no botão abaixo para ativar sua conta:</p>
      <div style="text-align: center;">
        <a href="${activationUrl}" class="button">Ativar Conta</a>
      </div>
      <p style="font-size: 12px; color: #666;">Ou copie este link: ${activationUrl}</p>
      <div class="warning">
        <strong>⚠️ Importante:</strong> Este link expira em 7 dias.
      </div>
    </div>
  `;

  const success = await sendEmail({
    to: data.professionalEmail,
    subject: `Convite para acompanhar ${data.babyName} - Olive Baby`,
    html: wrapTemplate(content, 'Convite Profissional'),
  });

  if (!success) {
    throw new Error('Failed to send professional invite email');
  }
  await logEmailCommunication(EMAIL_TEMPLATE_TYPES.PROFESSIONAL_INVITE, 'B2B', data.professionalEmail);
}

/**
 * Mapeamento de roles para português brasileiro
 */
const roleLabelsMap: Record<string, string> = {
  // Parents
  OWNER_PARENT_1: 'Responsável Principal',
  OWNER_PARENT_2: 'Responsável Principal',
  // Family
  FAMILY_VIEWER: 'Familiar (Somente visualização)',
  FAMILY_EDITOR: 'Familiar (Pode editar)',
  // Professionals
  PEDIATRICIAN: 'Pediatra',
  OBGYN: 'Obstetra/Ginecologista',
  LACTATION_CONSULTANT: 'Consultora de Amamentação',
  NUTRITIONIST: 'Nutricionista',
  PSYCHOLOGIST: 'Psicólogo(a)',
  SPEECH_THERAPIST: 'Fonoaudiólogo(a)',
  PHYSIOTHERAPIST: 'Fisioterapeuta',
  OCCUPATIONAL_THERAPIST: 'Terapeuta Ocupacional',
  NANNY: 'Babá',
  CAREGIVER: 'Cuidador(a)',
  OTHER: 'Outro Profissional',
};

/**
 * Envia convite para pais/familiares/profissionais acessarem um bebê
 */
export async function sendBabyInvite(data: {
  emailInvited: string;
  invitedName: string;
  babyName: string;
  inviteToken: string;
  memberType: 'PARENT' | 'FAMILY' | 'PROFESSIONAL';
  role: string;
  message?: string;
}) {
  const activationUrl = `${env.FRONTEND_URL}/invite/accept?token=${data.inviteToken}`;

  let inviteTypeLabel = '';
  let roleLabel = '';
  
  switch (data.memberType) {
    case 'PARENT':
      inviteTypeLabel = 'Responsável';
      roleLabel = roleLabelsMap[data.role] || 'Responsável';
      break;
    case 'FAMILY':
      inviteTypeLabel = 'Familiar';
      roleLabel = roleLabelsMap[data.role] || 'Familiar';
      break;
    case 'PROFESSIONAL':
      inviteTypeLabel = 'Profissional';
      roleLabel = roleLabelsMap[data.role] || data.role;
      break;
  }

  const content = `
    <div class="header">
      <div class="logo">🌿</div>
      <h2>Convite para Acompanhar ${data.babyName}</h2>
    </div>
    <div class="content">
      <p>Olá <strong>${data.invitedName}</strong>,</p>
      <p>Você foi convidado para acompanhar o desenvolvimento de <strong>${data.babyName}</strong> na plataforma Olive Baby.</p>
      <div class="info-box">
        <p><strong>Tipo:</strong> ${inviteTypeLabel}</p>
        <p><strong>Papel:</strong> ${roleLabel}</p>
      </div>
      ${data.message ? `
        <div class="message-box">
          <p><strong>Mensagem:</strong></p>
          <p>${data.message}</p>
        </div>
      ` : ''}
      <p>Clique no botão abaixo para aceitar o convite:</p>
      <div style="text-align: center;">
        <a href="${activationUrl}" class="button">Aceitar Convite</a>
      </div>
      <p style="font-size: 12px; color: #666;">Ou copie este link: ${activationUrl}</p>
      <div class="warning">
        <strong>⚠️ Importante:</strong>
        <ul style="margin: 10px 0; padding-left: 20px;">
          <li>Este link expira em 72 horas</li>
          <li>Se você não tem conta, será necessário criar uma</li>
        </ul>
      </div>
    </div>
  `;

  const success = await sendEmail({
    to: data.emailInvited,
    subject: `Convite para acompanhar ${data.babyName} - Olive Baby`,
    html: wrapTemplate(content, 'Convite'),
  });

  if (!success) {
    throw new Error('Failed to send baby invite email');
  }
  await logEmailCommunication(EMAIL_TEMPLATE_TYPES.BABY_INVITE, 'B2C', data.emailInvited);
}

/**
 * Envia email de recuperação de senha
 */
export async function sendPasswordResetEmail(data: {
  email: string;
  resetToken: string;
  userName?: string;
}) {
  const resetUrl = `${env.FRONTEND_URL}/reset-password?token=${data.resetToken}`;

  const content = `
    <div class="header">
      <div class="logo">🔐</div>
      <h2>Recuperação de Senha</h2>
    </div>
    <div class="content">
      <p>Olá${data.userName ? ` <strong>${data.userName}</strong>` : ''},</p>
      <p>Recebemos uma solicitação para redefinir a senha da sua conta na plataforma Olive Baby.</p>
      <p>Clique no botão abaixo para criar uma nova senha:</p>
      <div style="text-align: center;">
        <a href="${resetUrl}" class="button">Redefinir Senha</a>
      </div>
      <p style="font-size: 12px; color: #666; word-break: break-all;">Ou copie este link: ${resetUrl}</p>
      <div class="warning">
        <strong>⚠️ Importante:</strong>
        <ul style="margin: 10px 0; padding-left: 20px;">
          <li>Este link expira em <strong>30 minutos</strong></li>
          <li>Se você não solicitou esta recuperação, ignore este email</li>
          <li>Nunca compartilhe este link com outras pessoas</li>
        </ul>
      </div>
      <p style="margin-top: 20px; font-size: 12px; color: #666;">
        Por segurança, este link só pode ser usado uma vez. Após redefinir sua senha, você precisará fazer login novamente em todos os seus dispositivos.
      </p>
    </div>
  `;

  const success = await sendEmail({
    to: data.email,
    subject: 'Recuperação de Senha - Olive Baby',
    html: wrapTemplate(content, 'Recuperação de Senha'),
  });

  if (!success) {
    throw new Error('Failed to send password reset email');
  }

  logger.info('Password reset email sent', { 
    email: data.email.substring(0, 3) + '***',
  });
  await logEmailCommunication(EMAIL_TEMPLATE_TYPES.PASSWORD_RESET, 'B2C', data.email);
}

/**
 * Envia email de boas-vindas
 */
export async function sendWelcomeEmail(data: {
  email: string;
  userName: string;
}) {
  const dashboardUrl = `${env.FRONTEND_URL}/dashboard`;

  const content = `
    <div class="header">
      <div class="logo">🌿</div>
      <h2>Bem-vindo ao Olive Baby!</h2>
    </div>
    <div class="content">
      <p>Olá <strong>${data.userName}</strong>,</p>
      <p>Sua conta foi criada com sucesso! Estamos muito felizes em ter você conosco.</p>
      <div class="info-box">
        <p><strong>O que você pode fazer:</strong></p>
        <ul style="margin: 10px 0; padding-left: 20px;">
          <li>📊 Acompanhar o desenvolvimento do seu bebê</li>
          <li>📝 Registrar rotinas (alimentação, sono, fraldas)</li>
          <li>📈 Visualizar estatísticas e tendências</li>
          <li>👨‍👩‍👧 Convidar familiares e profissionais</li>
          <li>🤖 Usar o assistente de IA para dicas personalizadas</li>
        </ul>
      </div>
      <div style="text-align: center;">
        <a href="${dashboardUrl}" class="button">Acessar Dashboard</a>
      </div>
      <p>Se tiver dúvidas, não hesite em nos contatar!</p>
    </div>
  `;

  await sendEmail({
    to: data.email,
    subject: 'Bem-vindo ao Olive Baby! 🌿',
    html: wrapTemplate(content, 'Bem-vindo'),
  });
  await logEmailCommunication(EMAIL_TEMPLATE_TYPES.WELCOME, 'B2C', data.email);
}

/**
 * Envia alerta por email (para admins/monitoramento)
 */
export async function sendAlert(data: {
  level: 'info' | 'warning' | 'error' | 'critical';
  title: string;
  message: string;
  component: string;
  metadata?: Record<string, any>;
}) {
  const levelConfig = {
    info: { emoji: 'ℹ️', color: '#2196F3' },
    warning: { emoji: '⚠️', color: '#FF9800' },
    error: { emoji: '❌', color: '#F44336' },
    critical: { emoji: '🚨', color: '#D32F2F' },
  };

  const config = levelConfig[data.level];

  const content = `
    <div class="header" style="background: ${config.color};">
      <h2>${config.emoji} ${data.title}</h2>
    </div>
    <div class="content">
      <p><strong>Componente:</strong> ${data.component}</p>
      <p><strong>Nível:</strong> ${data.level.toUpperCase()}</p>
      <p><strong>Mensagem:</strong> ${data.message}</p>
      ${data.metadata ? `
        <div class="message-box">
          <strong>Detalhes:</strong>
          <pre style="margin: 10px 0; font-size: 12px; overflow-x: auto;">${JSON.stringify(data.metadata, null, 2)}</pre>
        </div>
      ` : ''}
      <p style="font-size: 12px; color: #666;">
        <strong>Timestamp:</strong> ${new Date().toISOString()}
      </p>
    </div>
  `;

  const alertEmail = env.ALERT_EMAIL || env.SMTP_USER || env.MAILERSEND_FROM_EMAIL;
  
  await sendEmail({
    to: alertEmail,
    subject: `[${data.level.toUpperCase()}] ${data.title} - Olive Baby`,
    html: wrapTemplate(content, 'Alerta do Sistema'),
  });
  await logEmailCommunication(EMAIL_TEMPLATE_TYPES.ALERT, 'INTERNAL', alertEmail, { component: data.component, level: data.level });
  logger.info('Alert email sent', { level: data.level, component: data.component });
}

/**
 * Envia notificação de pagamento
 */
export async function sendPaymentConfirmation(data: {
  email: string;
  userName: string;
  planName: string;
  amount: number;
  currency: string;
  nextBillingDate?: Date;
}) {
  const dashboardUrl = `${env.FRONTEND_URL}/dashboard`;

  const content = `
    <div class="header">
      <div class="logo">✅</div>
      <h2>Pagamento Confirmado!</h2>
    </div>
    <div class="content">
      <p>Olá <strong>${data.userName}</strong>,</p>
      <p>Seu pagamento foi processado com sucesso!</p>
      <div class="info-box">
        <p><strong>Detalhes:</strong></p>
        <ul style="margin: 10px 0; padding-left: 20px; list-style: none;">
          <li>📦 <strong>Plano:</strong> ${data.planName}</li>
          <li>💰 <strong>Valor:</strong> ${data.currency} ${(data.amount / 100).toFixed(2)}</li>
          ${data.nextBillingDate ? `<li>📅 <strong>Próxima cobrança:</strong> ${data.nextBillingDate.toLocaleDateString('pt-BR')}</li>` : ''}
        </ul>
      </div>
      <p>Obrigado por assinar o Olive Baby Premium! Agora você tem acesso a todos os recursos exclusivos.</p>
      <div style="text-align: center;">
        <a href="${dashboardUrl}" class="button">Ir para o Dashboard</a>
      </div>
    </div>
  `;

  await sendEmail({
    to: data.email,
    subject: 'Pagamento Confirmado - Olive Baby Premium ✅',
    html: wrapTemplate(content, 'Pagamento Confirmado'),
  });
  await logEmailCommunication(EMAIL_TEMPLATE_TYPES.PAYMENT_CONFIRMATION, 'B2C', data.email);
}

/**
 * Envia notificação de cancelamento de assinatura
 */
export async function sendSubscriptionCancelled(data: {
  email: string;
  userName: string;
  planName: string;
  endDate: Date;
}) {
  const content = `
    <div class="header" style="background: #FF9800;">
      <div class="logo">📝</div>
      <h2>Assinatura Cancelada</h2>
    </div>
    <div class="content">
      <p>Olá <strong>${data.userName}</strong>,</p>
      <p>Confirmamos o cancelamento da sua assinatura do plano <strong>${data.planName}</strong>.</p>
      <div class="info-box">
        <p>Você continuará tendo acesso aos recursos premium até <strong>${data.endDate.toLocaleDateString('pt-BR')}</strong>.</p>
      </div>
      <p>Após esta data, sua conta será automaticamente convertida para o plano gratuito.</p>
      <p>Sentiremos sua falta! Se mudar de ideia, você pode reativar sua assinatura a qualquer momento.</p>
    </div>
  `;

  await sendEmail({
    to: data.email,
    subject: 'Assinatura Cancelada - Olive Baby',
    html: wrapTemplate(content, 'Cancelamento'),
  });
  await logEmailCommunication(EMAIL_TEMPLATE_TYPES.SUBSCRIPTION_CANCELLED, 'B2C', data.email);
}

/**
 * Envia convite de paciente (profissional → paciente/cuidador)
 * Email informativo sobre o OlieCare com link para cadastro
 */
export async function sendPatientInviteEmail(data: {
  patientEmail: string;
  patientName: string;
  professionalName: string;
  professionalSpecialty: string;
  professionalCRM?: string;
  babyName?: string;
  message?: string;
  inviteToken: string;
  userExists?: boolean;
}) {
  const specialtyLabel = professionalRoleLabelsMap[data.professionalSpecialty] || data.professionalSpecialty;

  const actionUrl = data.userExists
    ? `${env.FRONTEND_URL}/login?ref=invite&token=${data.inviteToken}`
    : `${env.FRONTEND_URL}/register?ref=invite&token=${data.inviteToken}`;
  const actionLabel = data.userExists ? 'Acessar minha conta' : 'Criar minha conta grátis';
  const actionDescription = data.userExists
    ? `Acesse sua conta no OlieCare para ver e aceitar o convite do profissional:`
    : `Crie sua conta gratuitamente e comece a acompanhar o desenvolvimento do seu bebê:`;

  const content = `
    <div class="header">
      <div class="logo">🌿</div>
      <h2>Convite para o OlieCare</h2>
      <p style="margin: 5px 0 0; font-size: 14px; opacity: 0.9;">Acompanhamento inteligente do desenvolvimento do seu bebê</p>
    </div>
    <div class="content">
      <p>Olá <strong>${data.patientName}</strong>,</p>
      <p>O(a) <strong>${specialtyLabel}</strong> <strong>${data.professionalName}</strong>${data.professionalCRM ? ` (${data.professionalCRM})` : ''} convidou você para utilizar o <strong>OlieCare</strong>${data.babyName ? ` para acompanhar o desenvolvimento de <strong>${data.babyName}</strong>` : ''}.</p>

      ${data.message ? `
        <div class="message-box">
          <p style="margin: 0; font-style: italic;">"${data.message}"</p>
          <p style="margin: 8px 0 0; font-size: 12px; color: #666;">— ${data.professionalName}</p>
        </div>
      ` : ''}

      ${data.userExists ? `
        <div class="info-box">
          <p style="margin: 0 0 10px; font-weight: 600; font-size: 15px;">✅ Você já tem uma conta no OlieCare!</p>
          <p style="margin: 0; font-size: 14px;">Faça login para visualizar o convite recebido na sua área de Equipe. Você poderá escolher quais bebês deseja compartilhar com o(a) profissional.</p>
        </div>
      ` : `
        <div class="info-box">
          <p style="margin: 0 0 10px; font-weight: 600; font-size: 15px;">📱 O que é o OlieCare?</p>
          <p style="margin: 0 0 12px; font-size: 14px;">O OlieCare é uma plataforma completa para acompanhar o desenvolvimento do seu bebê, criando uma conexão direta entre você e os profissionais de saúde.</p>
          <ul style="margin: 0; padding-left: 20px; font-size: 14px; line-height: 2;">
            <li>📊 <strong>Registro de rotinas</strong> — alimentação, sono, fraldas e banho</li>
            <li>📈 <strong>Curvas de crescimento</strong> — peso, comprimento e perímetro cefálico com referências da OMS</li>
            <li>🏆 <strong>Marcos de desenvolvimento</strong> — acompanhe cada conquista do seu bebê</li>
            <li>💉 <strong>Carteira de vacinação</strong> — controle completo com alertas</li>
            <li>👨‍⚕️ <strong>Portal do profissional</strong> — seu médico acompanha tudo em tempo real</li>
            <li>🤖 <strong>Assistente com IA</strong> — tire dúvidas sobre o dia a dia do bebê</li>
            <li>📋 <strong>Consultas e receitas</strong> — histórico médico completo e organizado</li>
          </ul>
        </div>
      `}

      <p style="font-size: 15px;">${actionDescription}</p>

      <div style="text-align: center; margin: 25px 0;">
        <a href="${actionUrl}" class="button" style="font-size: 16px; padding: 16px 36px;">${actionLabel}</a>
      </div>

      <p style="font-size: 12px; color: #666; word-break: break-all;">Ou copie este link: ${actionUrl}</p>

      <div style="background: #f0f9f3; border-radius: 8px; padding: 15px; margin: 20px 0; text-align: center;">
        <p style="margin: 0; font-size: 13px; color: #4a7c59;">
          🔒 Seus dados são protegidos e só são compartilhados com os profissionais que você autorizar.
        </p>
      </div>

      <div class="warning">
        <strong>⚠️ Importante:</strong> Este convite expira em 30 dias.
      </div>
    </div>
  `;

  const success = await sendEmail({
    to: data.patientEmail,
    subject: `${data.professionalName} convidou você para o OlieCare 🌿`,
    html: wrapTemplate(content, 'Convite OlieCare'),
  });

  if (!success) {
    throw new Error('Failed to send patient invite email');
  }
  await logEmailCommunication(EMAIL_TEMPLATE_TYPES.PATIENT_INVITE, 'B2B', data.patientEmail);
  logger.info('Patient invite email sent', {
    email: data.patientEmail.substring(0, 3) + '***',
    professional: data.professionalName,
  });
}

// Export for testing
export { sendEmail, mailerSend };

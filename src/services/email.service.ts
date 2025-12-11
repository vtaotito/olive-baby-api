// Olive Baby API - Email Service
import nodemailer from 'nodemailer';
import { env } from '../config/env';
import { logger } from '../config/logger';

// Criar transporter reutilizável
function createTransporter() {
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
  const transporter = createTransporter();
  if (!transporter) {
    logger.warn('SMTP not configured, skipping professional invite email');
    return;
  }

  const activationUrl = `${env.FRONTEND_URL}/activate-professional?token=${data.inviteToken}`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #4CAF50; color: white; padding: 20px; border-radius: 5px 5px 0 0; }
        .content { background: #f9f9f9; padding: 20px; border: 1px solid #ddd; border-top: none; }
        .button { display: inline-block; padding: 12px 24px; background: #4CAF50; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
        .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h2>Convite para Acompanhar ${data.babyName}</h2>
        </div>
        <div class="content">
          <p>Olá <strong>${data.professionalName}</strong>,</p>
          <p><strong>${data.caregiverName}</strong> convidou você para acompanhar o desenvolvimento de <strong>${data.babyName}</strong> na plataforma Olive Baby.</p>
          <p>Clique no botão abaixo para ativar sua conta e começar a acompanhar:</p>
          <div style="text-align: center;">
            <a href="${activationUrl}" class="button">Ativar Conta</a>
          </div>
          <p>Ou copie e cole este link no seu navegador:</p>
          <p style="word-break: break-all; color: #666;">${activationUrl}</p>
          <p><strong>Importante:</strong> Este link expira em 7 dias.</p>
        </div>
        <div class="footer">
          <p>Olive Baby - Acompanhamento do desenvolvimento do seu bebê</p>
        </div>
      </div>
    </body>
    </html>
  `;

  try {
    await transporter.sendMail({
      from: `"Olive Baby" <${env.SMTP_USER}>`,
      to: data.professionalEmail,
      subject: `Convite para acompanhar ${data.babyName}`,
      html,
    });

    logger.info('Professional invite email sent', { email: data.professionalEmail });
  } catch (error: any) {
    logger.error('Failed to send professional invite email', { error: error.message });
    throw error;
  }
}

/**
 * Envia alerta por email
 */
export async function sendAlert(data: {
  level: 'info' | 'warning' | 'error' | 'critical';
  title: string;
  message: string;
  component: string;
  metadata?: Record<string, any>;
}) {
  if (!env.SMTP_HOST || !env.SMTP_USER) {
    logger.warn('SMTP not configured, skipping alert email');
    return;
  }

  const transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_PORT === 465,
    auth: {
      user: env.SMTP_USER,
      pass: env.SMTP_PASS,
    },
  });

  const levelEmojis = {
    info: 'ℹ️',
    warning: '⚠️',
    error: '❌',
    critical: '🚨',
  };

  const levelColors = {
    info: '#2196F3',
    warning: '#FF9800',
    error: '#F44336',
    critical: '#D32F2F',
  };

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: ${levelColors[data.level]}; color: white; padding: 20px; border-radius: 5px 5px 0 0; }
        .content { background: #f9f9f9; padding: 20px; border: 1px solid #ddd; border-top: none; }
        .metadata { background: white; padding: 15px; margin-top: 15px; border-radius: 5px; }
        .metadata pre { margin: 0; font-size: 12px; }
        .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h2>${levelEmojis[data.level]} ${data.title}</h2>
        </div>
        <div class="content">
          <p><strong>Componente:</strong> ${data.component}</p>
          <p><strong>Mensagem:</strong> ${data.message}</p>
          ${data.metadata ? `
            <div class="metadata">
              <strong>Detalhes:</strong>
              <pre>${JSON.stringify(data.metadata, null, 2)}</pre>
            </div>
          ` : ''}
        </div>
        <div class="footer">
          <p>Olive Baby API - Sistema de Monitoramento</p>
          <p>${new Date().toLocaleString('pt-BR')}</p>
        </div>
      </div>
    </body>
    </html>
  `;

  try {
    await transporter.sendMail({
      from: `"Olive Baby Monitor" <${env.SMTP_USER}>`,
      to: env.ALERT_EMAIL || env.SMTP_USER,
      subject: `[${data.level.toUpperCase()}] ${data.title}`,
      html,
    });

    logger.info('Alert email sent', { level: data.level, component: data.component });
  } catch (error: any) {
    logger.error('Failed to send alert email', { error: error.message });
    throw error;
  }
}

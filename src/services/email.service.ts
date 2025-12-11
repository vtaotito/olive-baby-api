// Olive Baby API - Email Service
import nodemailer from 'nodemailer';
import { config } from '../config';

const transporter = nodemailer.createTransport({
  host: config.smtp.host,
  port: config.smtp.port,
  secure: config.smtp.port === 465,
  auth: {
    user: config.smtp.user,
    pass: config.smtp.pass
  }
});

interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export async function sendEmail(options: SendEmailOptions): Promise<void> {
  try {
    await transporter.sendMail({
      from: `"Olive Baby" <${config.smtp.from || config.smtp.user}>`,
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text || options.html.replace(/<[^>]*>/g, '')
    });
    console.log(`Email sent to ${options.to}`);
  } catch (error) {
    console.error('Error sending email:', error);
    throw error;
  }
}

export async function sendProfessionalInvite(data: {
  professionalEmail: string;
  professionalName: string;
  caregiverName: string;
  babyName: string;
  inviteToken: string;
  role: string;
}): Promise<void> {
  const activationUrl = `${config.frontendUrl}/activate-professional?token=${data.inviteToken}`;
  
  const roleLabels: Record<string, string> = {
    PEDIATRICIAN: 'Pediatra',
    OBGYN: 'Obstetra/Ginecologista',
    LACTATION_CONSULTANT: 'Consultora de Amamentação',
    OTHER: 'Especialista'
  };

  const roleLabel = roleLabels[data.role] || data.role;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Convite Olive Baby</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f5f5f5; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .card { background: white; border-radius: 16px; padding: 40px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); }
        .logo { text-align: center; margin-bottom: 30px; }
        .logo h1 { color: #65a30d; margin: 0; font-size: 28px; }
        .logo span { color: #84cc16; }
        h2 { color: #333; margin-top: 0; }
        .highlight { background: #f0fdf4; padding: 20px; border-radius: 12px; margin: 20px 0; border-left: 4px solid #65a30d; }
        .button { display: inline-block; background: linear-gradient(135deg, #65a30d 0%, #84cc16 100%); color: white; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 600; margin: 20px 0; }
        .button:hover { opacity: 0.9; }
        .info { background: #fafafa; padding: 15px; border-radius: 8px; margin: 15px 0; }
        .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
        .expire { color: #dc2626; font-size: 14px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="card">
          <div class="logo">
            <h1>🌿 Olive <span>Baby</span></h1>
          </div>
          
          <h2>Olá, ${data.professionalName}!</h2>
          
          <p>Você foi convidado(a) por <strong>${data.caregiverName}</strong> para acompanhar o desenvolvimento de <strong>${data.babyName}</strong> na plataforma Olive Baby.</p>
          
          <div class="highlight">
            <p><strong>📋 Função:</strong> ${roleLabel}</p>
            <p style="margin-bottom: 0;"><strong>👶 Bebê:</strong> ${data.babyName}</p>
          </div>
          
          <p>Com o Olive Baby, você terá acesso a:</p>
          <ul>
            <li>📊 Estatísticas de alimentação, sono e rotinas</li>
            <li>📈 Gráficos de crescimento</li>
            <li>🎯 Marcos do desenvolvimento</li>
            <li>📝 Histórico completo de registros</li>
          </ul>
          
          <div style="text-align: center;">
            <a href="${activationUrl}" class="button">Ativar Minha Conta</a>
          </div>
          
          <p class="expire">⏰ Este convite expira em 7 dias.</p>
          
          <div class="info">
            <p style="margin: 0; font-size: 14px;">Se você não esperava este convite, pode ignorar este email com segurança.</p>
          </div>
        </div>
        
        <div class="footer">
          <p>© ${new Date().getFullYear()} Olive Baby - Acompanhe o desenvolvimento do seu bebê</p>
          <p>Este é um email automático, por favor não responda.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  await sendEmail({
    to: data.professionalEmail,
    subject: `🌿 ${data.caregiverName} convidou você para acompanhar ${data.babyName} no Olive Baby`,
    html
  });
}

export async function sendPasswordResetEmail(data: {
  email: string;
  name: string;
  resetToken: string;
}): Promise<void> {
  const resetUrl = `${config.frontendUrl}/reset-password?token=${data.resetToken}`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Redefinir Senha - Olive Baby</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f5f5f5; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .card { background: white; border-radius: 16px; padding: 40px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); }
        .logo { text-align: center; margin-bottom: 30px; }
        .logo h1 { color: #65a30d; margin: 0; font-size: 28px; }
        .button { display: inline-block; background: linear-gradient(135deg, #65a30d 0%, #84cc16 100%); color: white; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 600; margin: 20px 0; }
        .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="card">
          <div class="logo">
            <h1>🌿 Olive Baby</h1>
          </div>
          
          <h2>Olá, ${data.name}!</h2>
          
          <p>Recebemos uma solicitação para redefinir sua senha. Clique no botão abaixo para criar uma nova senha:</p>
          
          <div style="text-align: center;">
            <a href="${resetUrl}" class="button">Redefinir Senha</a>
          </div>
          
          <p style="color: #dc2626; font-size: 14px;">⏰ Este link expira em 1 hora.</p>
          
          <p style="font-size: 14px; color: #666;">Se você não solicitou a redefinição de senha, ignore este email.</p>
        </div>
        
        <div class="footer">
          <p>© ${new Date().getFullYear()} Olive Baby</p>
        </div>
      </div>
    </body>
    </html>
  `;

  await sendEmail({
    to: data.email,
    subject: '🔐 Redefinir sua senha - Olive Baby',
    html
  });
}

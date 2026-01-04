# Configuração do MailerSend - Olive Baby

## Visão Geral

O Olive Baby utiliza o MailerSend como provedor principal de email, com SMTP como fallback.

## Variáveis de Ambiente

Adicione as seguintes variáveis ao seu arquivo `.env`:

```env
# MailerSend (provedor principal de email)
MAILERSEND_API_KEY=mlsn.4205ec113417b44026d2f1a349c2abc008a1b71543fc59f5e4bbaf1638d33196
MAILERSEND_FROM_EMAIL=noreply@oliecare.cloud
MAILERSEND_FROM_NAME=Olive Baby
```

## Configuração no MailerSend Dashboard

### 1. Verificar Domínio

Para enviar emails do domínio `oliecare.cloud`, você precisa:

1. Acesse [MailerSend Dashboard](https://app.mailersend.com/domains)
2. Adicione o domínio `oliecare.cloud`
3. Configure os registros DNS:
   - **SPF**: `v=spf1 include:_spf.mailersend.net ~all`
   - **DKIM**: Será fornecido pelo MailerSend
   - **DMARC** (recomendado): `v=DMARC1; p=quarantine; rua=mailto:dmarc@oliecare.cloud`

### 2. Aguardar Verificação

A verificação do domínio pode levar até 24 horas. Enquanto isso:
- Você pode usar domínios compartilhados do MailerSend (limitado)
- O SMTP funcionará como fallback se configurado

## Tipos de Email Suportados

| Tipo | Descrição |
|------|-----------|
| Recuperação de Senha | `sendPasswordResetEmail` |
| Convite Profissional | `sendProfessionalInvite` |
| Convite para Bebê | `sendBabyInvite` |
| Boas-vindas | `sendWelcomeEmail` |
| Confirmação de Pagamento | `sendPaymentConfirmation` |
| Cancelamento de Assinatura | `sendSubscriptionCancelled` |
| Alertas do Sistema | `sendAlert` |

## Testando o Envio

### Via API (local)

```bash
# POST para endpoint de teste (crie se necessário)
curl -X POST http://localhost:4000/api/v1/test/email \
  -H "Content-Type: application/json" \
  -d '{"email": "seu-email@teste.com", "type": "welcome"}'
```

### Via Console do Node

```javascript
const { sendWelcomeEmail } = require('./dist/services/email.service');

sendWelcomeEmail({
  email: 'teste@exemplo.com',
  userName: 'Usuário Teste'
}).then(() => console.log('Email enviado!'));
```

## Fallback SMTP

Se o MailerSend falhar, o sistema tenta enviar via SMTP. Configure:

```env
SMTP_HOST=smtp.seuservidor.com
SMTP_PORT=587
SMTP_USER=seu-usuario
SMTP_PASS=sua-senha
```

## Monitoramento

Os logs de email são registrados automaticamente:

```
info: Email sent via MailerSend {"to": "xxx***", "subject": "...", "messageId": "..."}
warn: MailerSend failed, trying SMTP fallback
error: Failed to send email {"error": "..."}
```

## Limites do MailerSend

| Plano | Emails/Mês | Taxa |
|-------|------------|------|
| Free | 3.000 | 1/segundo |
| Starter | 50.000 | 10/segundo |
| Pro | Ilimitado | 50/segundo |

## Suporte

- [Documentação MailerSend](https://developers.mailersend.com/)
- [Dashboard MailerSend](https://app.mailersend.com/)

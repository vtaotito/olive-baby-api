# 📊 Sistema de Monitoramento e Logs - Olive Baby API

Sistema completo de monitoramento, logs estruturados e alertas para a API Olive Baby.

## 🎯 Funcionalidades

### ✅ Logs Estruturados
- **Winston** para logging profissional
- Rotação diária de arquivos de log
- Separação de logs por nível (error, combined)
- Logs de exceções e rejeições de promises
- Formato JSON para produção, colorido para desenvolvimento

### ✅ Health Checks
- **Database**: Verifica conectividade e tempo de resposta
- **Redis**: Verifica disponibilidade
- **Disk**: Monitora uso de espaço em disco
- **Memory**: Monitora uso de memória heap
- Status geral: `healthy`, `degraded`, `unhealthy`

### ✅ Métricas
- Uptime do servidor
- Requisições por minuto
- Taxa de erros
- Tempo de resposta médio
- Conexões ativas

### ✅ Alertas
- **Email**: Alertas críticos e de erro
- **Webhook**: Integração com sistemas externos (Slack, Discord, etc.)
- **Cooldown**: Evita spam de alertas (5 minutos)
- Níveis: `info`, `warning`, `error`, `critical`

## 📁 Estrutura

```
src/
├── config/
│   └── logger.ts              # Configuração Winston
├── services/
│   ├── monitoring.service.ts  # Serviço de monitoramento
│   └── email.service.ts       # Envio de alertas por email
├── routes/
│   └── monitoring.routes.ts   # Rotas de monitoramento
├── middlewares/
│   └── monitoring.middleware.ts # Middleware de tracking
└── utils/
    └── monitoring.ts           # Utilitários de monitoramento
```

## 🚀 Uso

### Endpoints de Monitoramento

#### Health Check Completo
```bash
GET /api/v1/monitoring/health
```

Resposta:
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "timestamp": "2025-12-11T19:30:00.000Z",
    "checks": {
      "database": { "status": "up", "responseTime": 15 },
      "redis": { "status": "up", "responseTime": 2 },
      "disk": { "status": "ok", "usage": 45.2 },
      "memory": { "status": "ok", "usage": 65.8 }
    },
    "metrics": {
      "uptime": 3600,
      "requestsPerMinute": 42,
      "errorRate": 0.5,
      "activeConnections": 0
    }
  }
}
```

#### Métricas
```bash
GET /api/v1/monitoring/metrics
```

#### Status Simplificado (para load balancers)
```bash
GET /api/v1/monitoring/status
```

### Logs

Os logs são salvos em `logs/`:

- `combined-YYYY-MM-DD.log` - Todos os logs
- `error-YYYY-MM-DD.log` - Apenas erros
- `exceptions-YYYY-MM-DD.log` - Exceções não tratadas
- `rejections-YYYY-MM-DD.log` - Promises rejeitadas

**Rotação**: Diária, mantém 30 dias, compacta arquivos antigos

### Alertas

#### Configuração

Adicione no `.env`:

```env
# Email para alertas
ALERT_EMAIL=admin@example.com

# Webhook para alertas (opcional)
ALERT_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL

# Nível de log
LOG_LEVEL=info
```

#### Envio Manual de Alerta

```typescript
import { monitoringService } from './services/monitoring.service';

await monitoringService.sendAlert({
  level: 'warning',
  title: 'Atenção Necessária',
  message: 'Algo precisa de atenção',
  component: 'payment',
  metadata: { orderId: 123 },
});
```

## 📊 Integração com Serviços Externos

### Slack

```env
ALERT_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL
```

### Discord

```env
ALERT_WEBHOOK_URL=https://discord.com/api/webhooks/YOUR/WEBHOOK/URL
```

### PagerDuty

```env
ALERT_WEBHOOK_URL=https://events.pagerduty.com/v2/enqueue
```

## 🔧 Configuração Avançada

### Níveis de Log

- `error`: Apenas erros
- `warn`: Avisos e erros
- `info`: Informações, avisos e erros (padrão)
- `debug`: Todos os logs (desenvolvimento)

### Thresholds de Alertas

No `monitoring.service.ts`:

- **Database**: > 1000ms = warning
- **Disk**: > 80% = warning, > 90% = critical
- **Memory**: > 80% = warning, > 90% = critical

### Cooldown de Alertas

5 minutos por padrão. Modifique em `monitoring.service.ts`:

```typescript
const ALERT_COOLDOWN = 10 * 60 * 1000; // 10 minutos
```

## 📈 Monitoramento Contínuo

O sistema executa health checks a cada 1 minuto automaticamente.

Para monitoramento externo, configure:

```bash
# Cron job para verificar saúde
*/5 * * * * curl -f https://oliecare.cloud/api/v1/monitoring/status || alert
```

## 🐛 Troubleshooting

### Logs não aparecem

1. Verifique permissões da pasta `logs/`
2. Verifique `LOG_LEVEL` no `.env`
3. Verifique se Winston está instalado: `npm list winston`

### Alertas não são enviados

1. Verifique configuração SMTP no `.env`
2. Verifique `ALERT_EMAIL`
3. Verifique logs para erros de envio
4. Verifique cooldown (5 minutos entre alertas similares)

### Health check falha

1. Verifique conectividade com database
2. Verifique conectividade com Redis
3. Verifique permissões de sistema (disk/memory checks)

## 📚 Recursos

- [Winston Documentation](https://github.com/winstonjs/winston)
- [Winston Daily Rotate File](https://github.com/winstonjs/winston-daily-rotate-file)

## 🔐 Segurança

- Logs não contêm informações sensíveis (senhas, tokens)
- Webhooks devem usar HTTPS
- Email de alertas deve ser configurado com credenciais seguras

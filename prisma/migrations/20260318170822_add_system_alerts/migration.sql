-- CreateEnum
CREATE TYPE "AlertSeverity" AS ENUM ('INFO', 'WARNING', 'ERROR', 'CRITICAL');
CREATE TYPE "AlertStatus" AS ENUM ('NEW', 'SEEN', 'RESOLVED', 'MUTED');

-- CreateTable
CREATE TABLE "system_alerts" (
    "id" SERIAL NOT NULL,
    "type" VARCHAR(50) NOT NULL,
    "severity" "AlertSeverity" NOT NULL DEFAULT 'WARNING',
    "status" "AlertStatus" NOT NULL DEFAULT 'NEW',
    "title" VARCHAR(200) NOT NULL,
    "message" VARCHAR(1000) NOT NULL,
    "component" VARCHAR(50) NOT NULL,
    "metadata" JSONB DEFAULT '{}',
    "resolved_at" TIMESTAMP(3),
    "resolved_by" VARCHAR(100),
    "notified" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "system_alerts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alert_configs" (
    "id" VARCHAR(50) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" VARCHAR(300),
    "category" VARCHAR(30) NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "threshold" JSONB DEFAULT '{}',
    "channels" JSONB NOT NULL DEFAULT '["email"]',
    "cooldown_min" INTEGER NOT NULL DEFAULT 5,
    "recipients" JSONB DEFAULT '[]',
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "alert_configs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "system_alerts_status_idx" ON "system_alerts"("status");
CREATE INDEX "system_alerts_severity_idx" ON "system_alerts"("severity");
CREATE INDEX "system_alerts_type_idx" ON "system_alerts"("type");
CREATE INDEX "system_alerts_created_at_idx" ON "system_alerts"("created_at");
CREATE INDEX "system_alerts_status_severity_idx" ON "system_alerts"("status", "severity");
CREATE INDEX "alert_configs_category_idx" ON "alert_configs"("category");

-- Seed default alert configs
INSERT INTO "alert_configs" ("id", "name", "description", "category", "enabled", "threshold", "channels", "cooldown_min", "recipients", "updated_at")
VALUES
  ('memory_critical', 'Memória Crítica', 'Uso de memória acima do limite crítico', 'system', true, '{"value": 90, "unit": "%"}', '["email"]', 5, '[]', NOW()),
  ('memory_warning', 'Memória Elevada', 'Uso de memória acima do limite de atenção', 'system', true, '{"value": 80, "unit": "%"}', '["email"]', 15, '[]', NOW()),
  ('db_slow', 'Database Lento', 'Tempo de resposta do banco acima do normal', 'system', true, '{"value": 1000, "unit": "ms"}', '["email"]', 10, '[]', NOW()),
  ('db_down', 'Database Indisponível', 'Banco de dados não está respondendo', 'system', true, '{}', '["email", "slack"]', 5, '[]', NOW()),
  ('redis_down', 'Redis Indisponível', 'Cache Redis não está respondendo', 'system', true, '{}', '["email"]', 5, '[]', NOW()),
  ('email_quota', 'Cota de Email', 'Limite de envio de emails atingido', 'email', true, '{"value": 90, "unit": "%"}', '["email", "push"]', 60, '[]', NOW()),
  ('email_failure', 'Falha de Email', 'Emails falhando ao enviar', 'email', true, '{"value": 5, "unit": "consecutive"}', '["email"]', 30, '[]', NOW()),
  ('push_failure', 'Falha de Push', 'Push notifications falhando', 'push', true, '{"value": 10, "unit": "consecutive"}', '["email"]', 30, '[]', NOW()),
  ('api_error_rate', 'Taxa de Erros API', 'Taxa de erros 5xx acima do limite', 'system', true, '{"value": 5, "unit": "%"}', '["email", "slack"]', 15, '[]', NOW()),
  ('churn_risk', 'Risco de Churn', 'Usuários com alto risco de cancelamento', 'business', true, '{"value": 10, "unit": "users"}', '["email"]', 1440, '[]', NOW()),
  ('retention_drop', 'Queda de Retenção', 'Retenção caiu abaixo do limite', 'business', true, '{"value": 50, "unit": "%"}', '["email"]', 1440, '[]', NOW()),
  ('inactive_users', 'Usuários Inativos', 'Número alto de usuários inativos', 'business', true, '{"value": 20, "unit": "users"}', '["email"]', 1440, '[]', NOW());

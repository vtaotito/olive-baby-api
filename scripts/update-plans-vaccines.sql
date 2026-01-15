-- Script para atualizar os planos com a feature vaccines
-- Execute após aplicar a migration de vacinas

-- Atualizar plano FREE para incluir vaccines: false
UPDATE plans
SET features = jsonb_set(features::jsonb, '{vaccines}', 'false'::jsonb)
WHERE type = 'FREE' AND NOT (features::jsonb ? 'vaccines');

-- Atualizar plano PREMIUM para incluir vaccines: true
UPDATE plans
SET features = jsonb_set(features::jsonb, '{vaccines}', 'true'::jsonb)
WHERE type = 'PREMIUM' AND NOT (features::jsonb ? 'vaccines');

-- Verificar resultado
SELECT name, type, features FROM plans;

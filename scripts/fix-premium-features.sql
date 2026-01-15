-- Script para garantir que todos os planos Premium tenham todas as features habilitadas
-- Execute este script para corrigir planos que podem estar com features faltando

-- Atualizar plano FREE para garantir todas as features estão definidas
UPDATE plans
SET features = jsonb_set(
  jsonb_set(
    jsonb_set(
      jsonb_set(
        jsonb_set(
          jsonb_set(
            jsonb_set(
              features::jsonb,
              '{exportPdf}', 'false'::jsonb
            ),
            '{exportCsv}', 'false'::jsonb
          ),
          '{advancedInsights}', 'false'::jsonb
        ),
        '{aiChat}', 'false'::jsonb
      ),
      '{multiCaregivers}', 'false'::jsonb
    ),
    '{prioritySupport}', 'false'::jsonb
  ),
  '{vaccines}', 'false'::jsonb
)
WHERE type = 'FREE';

-- Atualizar plano PREMIUM para garantir todas as features estão habilitadas
UPDATE plans
SET features = jsonb_set(
  jsonb_set(
    jsonb_set(
      jsonb_set(
        jsonb_set(
          jsonb_set(
            jsonb_set(
              features::jsonb,
              '{exportPdf}', 'true'::jsonb
            ),
            '{exportCsv}', 'true'::jsonb
          ),
          '{advancedInsights}', 'true'::jsonb
        ),
        '{aiChat}', 'true'::jsonb
      ),
      '{multiCaregivers}', 'true'::jsonb
    ),
    '{prioritySupport}', 'true'::jsonb
  ),
  '{vaccines}', 'true'::jsonb
)
WHERE type = 'PREMIUM';

-- Verificar resultado
SELECT 
  id,
  code,
  name,
  type,
  features,
  is_active
FROM plans
ORDER BY type;

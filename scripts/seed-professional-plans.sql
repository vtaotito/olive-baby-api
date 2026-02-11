-- Seed planos para profissionais e clínicas
-- Execute após a migration add_clinic_prontuario_agenda_pricing

INSERT INTO plans (code, name, type, description, price, price_yearly, currency, limits, features, is_active, created_at, updated_at)
VALUES
  ('PROFESSIONAL_BASIC', 'Profissional Básico', 'PROFESSIONAL_BASIC', 'Prontuário, consultas, curvas WHO, vacinas. Até 50 pacientes.', 79.00, 799.00, 'BRL',
   '{"maxBabies":50,"maxProfessionals":0,"maxExportsPerMonth":10,"historyDays":-1,"maxPatients":50}'::jsonb,
   '{"exportPdf":false,"exportCsv":true,"advancedInsights":true,"aiChat":false,"clinicalVisits":true,"prescriptions":false,"whoCharts":true}'::jsonb,
   true, now(), now()),

  ('PROFESSIONAL_ADVANCED', 'Profissional Avançado', 'PROFESSIONAL_ADVANCED', 'Tudo do Básico + Receitas, atestados, export PDF, pacientes ilimitados.', 149.00, 1499.00, 'BRL',
   '{"maxBabies":-1,"maxProfessionals":0,"maxExportsPerMonth":-1,"historyDays":-1,"maxPatients":-1}'::jsonb,
   '{"exportPdf":true,"exportCsv":true,"advancedInsights":true,"aiChat":true,"clinicalVisits":true,"prescriptions":true,"whoCharts":true}'::jsonb,
   true, now(), now()),

  ('PROFESSIONAL_PRO', 'Profissional Pro', 'PROFESSIONAL_PRO', 'Tudo do Avançado + API, suporte prioritário, integrações.', 249.00, 2499.00, 'BRL',
   '{"maxBabies":-1,"maxProfessionals":0,"maxExportsPerMonth":-1,"historyDays":-1,"maxPatients":-1}'::jsonb,
   '{"exportPdf":true,"exportCsv":true,"advancedInsights":true,"aiChat":true,"clinicalVisits":true,"prescriptions":true,"whoCharts":true,"apiAccess":true}'::jsonb,
   true, now(), now()),

  ('CLINIC_STARTER', 'Clínica Starter', 'CLINIC_STARTER', 'Gestão básica, até 5 profissionais. Base + R$ 49/usuário.', 149.00, 1499.00, 'BRL',
   '{"maxBabies":-1,"maxProfessionals":5,"maxExportsPerMonth":-1,"historyDays":-1}'::jsonb,
   '{"exportPdf":false,"exportCsv":true,"advancedInsights":true,"clinicalVisits":true,"prescriptions":false,"clinicManagement":true}'::jsonb,
   true, now(), now()),

  ('CLINIC_GROWTH', 'Clínica Growth', 'CLINIC_GROWTH', 'Até 20 profissionais. Base + R$ 39/usuário.', 299.00, 2999.00, 'BRL',
   '{"maxBabies":-1,"maxProfessionals":20,"maxExportsPerMonth":-1,"historyDays":-1}'::jsonb,
   '{"exportPdf":true,"exportCsv":true,"advancedInsights":true,"clinicalVisits":true,"prescriptions":true,"clinicManagement":true}'::jsonb,
   true, now(), now()),

  ('CLINIC_ENTERPRISE', 'Clínica Enterprise', 'CLINIC_ENTERPRISE', 'Sob consulta. Profissionais ilimitados.', 0, 0, 'BRL',
   '{"maxBabies":-1,"maxProfessionals":-1,"maxExportsPerMonth":-1,"historyDays":-1}'::jsonb,
   '{"exportPdf":true,"exportCsv":true,"advancedInsights":true,"clinicalVisits":true,"prescriptions":true,"clinicManagement":true,"apiAccess":true}'::jsonb,
   true, now(), now())
ON CONFLICT (code) DO NOTHING;

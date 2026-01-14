-- Script para atualizar os planos com os IDs do Stripe
-- Data: 2026-01-14
-- 
-- IDs de preço fornecidos:
-- price_1SkCXbFDSVUPsXyEdQmKlkCo (mensal - R$29,99)
-- price_1SpU19FDSVUPsXyEywgRbw0u (anual - R$287,90 = 20% de desconto)
--
-- Cálculo do desconto:
-- Mensal: R$29,99 x 12 = R$359,88/ano
-- Com 20% desconto: R$359,88 x 0.80 = R$287,90/ano
-- Economia: R$71,98/ano

-- Primeiro, verificar os planos existentes
SELECT id, code, name, type, price, price_yearly, stripe_product_id, stripe_price_id_monthly, stripe_price_id_yearly 
FROM plans;

-- Atualizar o plano PREMIUM com os IDs de preço do Stripe e desconto de 20%
UPDATE plans 
SET 
  stripe_price_id_monthly = 'price_1SkCXbFDSVUPsXyEdQmKlkCo',
  stripe_price_id_yearly = 'price_1SpU19FDSVUPsXyEywgRbw0u',
  price = 29.99,
  price_yearly = 287.90,
  updated_at = NOW()
WHERE code = 'PREMIUM' OR type = 'PREMIUM';

-- Verificar a atualização
SELECT id, code, name, type, price, price_yearly, stripe_product_id, stripe_price_id_monthly, stripe_price_id_yearly 
FROM plans;

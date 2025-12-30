// Olive Baby API - Routine Meta Utilities
// Sanitização e validação dos campos meta por tipo de rotina

import { RoutineType } from '@prisma/client';
import { RoutineMeta } from '../types';

/**
 * Whitelist de campos meta permitidos por tipo de rotina
 */
export const ALLOWED_META_FIELDS: Record<RoutineType, string[]> = {
  FEEDING: [
    'feedingType',      // 'breast' | 'bottle' | 'solid'
    'breastSide',       // 'left' | 'right' | 'both'
    'complement',       // 'yes' | 'no'
    'complementType',   // 'formula' | 'breast_milk' | 'other'
    'complementMl',     // number
    'bottleMl',         // number
    'bottleMilkType',   // 'breast_milk' | 'formula' | 'mixed'
    'bottleContent',    // alias para bottleMilkType
    'solidFoods',       // string[] ou string (descrição)
    'solidDescription', // string
  ],
  SLEEP: [
    'location',         // string
    'environment',      // string
    'quality',          // 'good' | 'regular' | 'bad'
    'sleepQuality',     // alias para quality
    'wokeUpTimes',      // number
  ],
  DIAPER: [
    'diaperType',       // 'pee' | 'poop' | 'both'
    'consistency',      // 'liquid' | 'pasty' | 'solid'
    'color',            // string
  ],
  BATH: [
    'waterTemperature', // number
    'bathTemperature',  // alias
    'hairWashed',       // boolean
    'productsUsed',     // string[]
    'products',         // alias para productsUsed
  ],
  MILK_EXTRACTION: [
    'extractionType',   // 'manual' | 'electric'
    'extractionMethod', // alias para extractionType
    'breastSide',       // 'left' | 'right' | 'both'
    'quantityMl',       // number
    'extractionMl',     // alias para quantityMl
  ],
};

/**
 * Sanitiza o objeto meta removendo campos não permitidos para o tipo de rotina
 * @param routineType Tipo da rotina
 * @param meta Objeto meta a ser sanitizado
 * @returns Meta sanitizado apenas com campos permitidos
 */
export function sanitizeRoutineMeta(
  routineType: RoutineType,
  meta: RoutineMeta | Record<string, unknown> | null | undefined
): Record<string, unknown> {
  if (!meta || typeof meta !== 'object') {
    return {};
  }

  const allowedFields = ALLOWED_META_FIELDS[routineType] || [];
  const sanitized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(meta)) {
    if (allowedFields.includes(key) && value !== undefined && value !== null && value !== '') {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

/**
 * Aplica regras de negócio específicas para normalização do meta de FEEDING
 * Remove campos inválidos baseado no feedingType e complement
 */
export function normalizeFeedingMeta(meta: Record<string, unknown>): Record<string, unknown> {
  const result = { ...meta };
  const feedingType = result.feedingType as string | undefined;
  const complement = result.complement as string | undefined;

  // Se não for amamentação, remover breastSide
  if (feedingType !== 'breast') {
    delete result.breastSide;
  }

  // Se não for mamadeira, remover campos de mamadeira
  if (feedingType !== 'bottle') {
    delete result.bottleMl;
    delete result.bottleMilkType;
    delete result.bottleContent;
  }

  // Se não for sólidos, remover campos de sólidos
  if (feedingType !== 'solid') {
    delete result.solidFoods;
    delete result.solidDescription;
  }

  // Se complement não for 'yes', remover campos de complemento
  if (complement !== 'yes') {
    delete result.complementType;
    delete result.complementMl;
  }

  return result;
}

/**
 * Aplica regras de negócio específicas para normalização do meta de DIAPER
 * Remove campos de cocô se não tiver cocô
 */
export function normalizeDiaperMeta(meta: Record<string, unknown>): Record<string, unknown> {
  const result = { ...meta };
  const diaperType = result.diaperType as string | undefined;

  // Se for apenas xixi, remover campos de consistência e cor
  if (diaperType === 'pee') {
    delete result.consistency;
    delete result.color;
  }

  return result;
}

/**
 * Normaliza e sanitiza o meta completo baseado no tipo de rotina
 * Aplica whitelist + regras de negócio específicas
 */
export function normalizeAndSanitizeMeta(
  routineType: RoutineType,
  meta: RoutineMeta | Record<string, unknown> | null | undefined
): Record<string, unknown> {
  // Primeiro sanitiza (remove campos não permitidos)
  let sanitized = sanitizeRoutineMeta(routineType, meta);

  // Depois aplica regras de negócio específicas
  switch (routineType) {
    case 'FEEDING':
      sanitized = normalizeFeedingMeta(sanitized);
      break;
    case 'DIAPER':
      sanitized = normalizeDiaperMeta(sanitized);
      break;
    // Outros tipos não precisam de normalização adicional por enquanto
  }

  return sanitized;
}

/**
 * Valida o meta e retorna erros de validação se houver
 * @returns Array de erros de validação ou array vazio se válido
 */
export function validateRoutineMeta(
  routineType: RoutineType,
  meta: Record<string, unknown>
): string[] {
  const errors: string[] = [];

  switch (routineType) {
    case 'FEEDING': {
      if (!meta.feedingType) {
        errors.push('Tipo de alimentação é obrigatório');
      }
      
      if (meta.feedingType === 'breast' && !meta.breastSide) {
        errors.push('Lado do peito é obrigatório para amamentação');
      }
      
      if (meta.complement === 'yes') {
        if (!meta.complementMl && meta.complementMl !== 0) {
          errors.push('Quantidade do complemento é obrigatória quando há complemento');
        }
      }
      break;
    }
    
    case 'DIAPER': {
      if (!meta.diaperType) {
        errors.push('Tipo de fralda é obrigatório');
      }
      break;
    }
    
    case 'MILK_EXTRACTION': {
      const method = meta.extractionMethod || meta.extractionType;
      if (!method) {
        errors.push('Método de extração é obrigatório');
      }
      break;
    }
    
    // SLEEP e BATH não têm campos obrigatórios no meta
  }

  return errors;
}

/**
 * Merge do meta existente com novos valores
 * Usado para atualização parcial do meta
 */
export function mergeRoutineMeta(
  routineType: RoutineType,
  existingMeta: Record<string, unknown> | null | undefined,
  newMeta: Record<string, unknown> | null | undefined
): Record<string, unknown> {
  const merged = {
    ...(existingMeta || {}),
    ...(newMeta || {}),
  };

  return normalizeAndSanitizeMeta(routineType, merged);
}


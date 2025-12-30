// Olive Baby API - CPF Hash Helper
import crypto from 'crypto';
import { env } from '../../config/env';

const CPF_SALT = env.CPF_SALT || 'olive-baby-cpf-salt-default-change-in-production';

/**
 * Gera hash do CPF usando SHA-256 com salt
 * @param cpf CPF limpo (apenas números)
 * @returns Hash hexadecimal de 64 caracteres
 */
export function hashCpf(cpf: string): string {
  // Remove caracteres não numéricos
  const cleanCpf = cpf.replace(/\D/g, '');
  
  if (cleanCpf.length !== 11) {
    throw new Error('CPF deve conter 11 dígitos');
  }
  
  // Gera hash SHA-256 com salt
  const hash = crypto
    .createHash('sha256')
    .update(cleanCpf + CPF_SALT)
    .digest('hex');
  
  return hash;
}

/**
 * Valida formato do CPF (apenas formato, não dígitos verificadores)
 * @param cpf CPF a validar
 * @returns true se o formato é válido
 */
export function validateCpfFormat(cpf: string): boolean {
  const cleanCpf = cpf.replace(/\D/g, '');
  return cleanCpf.length === 11 && /^\d{11}$/.test(cleanCpf);
}

/**
 * Limpa CPF removendo caracteres não numéricos
 * @param cpf CPF com ou sem formatação
 * @returns CPF apenas com números
 */
export function cleanCpf(cpf: string): string {
  return cpf.replace(/\D/g, '');
}

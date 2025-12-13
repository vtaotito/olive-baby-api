// Olive Baby API - Type Definitions
import { Request } from 'express';
import { UserRole } from '@prisma/client';

// ==========================================
// Auth Types
// ==========================================

export interface JwtPayload {
  userId: number;
  email: string;
  role: UserRole;
}

export interface AuthenticatedRequest extends Request {
  user?: JwtPayload;
}

// ==========================================
// API Response Types
// ==========================================

export interface ApiResponse<T = unknown> {
  success: boolean;
  message?: string;
  data?: T;
  error?: string;
  errors?: Record<string, string[]>;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// ==========================================
// Routine Meta Types
// ==========================================

export interface FeedingMeta {
  feedingType?: 'breast' | 'bottle' | 'solid';
  breastSide?: 'left' | 'right' | 'both';
  bottleMl?: number;
  bottleMilkType?: 'breast_milk' | 'formula' | 'mixed';
  complement?: 'yes' | 'no';
  complementMl?: number;
  complementType?: 'breast_milk' | 'formula';
  solidFoods?: string[];
}

export interface DiaperMeta {
  diaperType?: 'pee' | 'poop' | 'both';
}

export interface MilkExtractionMeta {
  extractionMl?: number;
  extractionMethod?: 'manual' | 'electric';
}

export interface BathMeta {
  bathTemperature?: number;
}

export interface SleepMeta {
  sleepQuality?: 'good' | 'regular' | 'bad';
  wokeUpCount?: number;
}

export type RoutineMeta = FeedingMeta | DiaperMeta | MilkExtractionMeta | BathMeta | SleepMeta;

// ==========================================
// Stats Types
// ==========================================

export interface BabyStats {
  period: { start: Date; end: Date };
  
  // Labels para gráficos (datas formatadas)
  labels: string[];
  hourlyLabels: number[];
  
  // Sono
  totalSleepHours24h: number;
  averageSleepPerDay: number;
  sleepHoursPerDay: number[];
  
  // Alimentação
  totalFeedingMinutes24h: number;
  feedingCount24h: number;
  feedingCountsPerDay: number[];
  feedingMinutesPerDay: number[];
  breastSideDistribution: { left: number; right: number; both: number };
  
  // Complemento
  totalComplementMl24h: number;
  totalComplementMlRange: number;
  complementMlPerDay: number[];
  complementFeeds24h: number;
  
  // Mamadeira
  totalBottleMl24h: number;
  bottleMlPerDay: number[];
  
  // Extração
  totalExtractionMl24h: number;
  extractionMlPerDay: number[];
  
  // Fraldas
  totalDiaper24h: number;
  diaperCountsPerDay: number[];
  
  // Atividade por hora (0-23)
  hourlyCounts: number[];
}

// ==========================================
// Export Options
// ==========================================

export interface ExportOptions {
  babyId: number;
  startDate: Date;
  endDate: Date;
  routineTypes?: ('FEEDING' | 'SLEEP' | 'DIAPER' | 'BATH' | 'MILK_EXTRACTION')[];
}

// ==========================================
// Permissions
// ==========================================

export interface RolePermissions {
  canManageBabies: boolean;
  canRegisterRoutines: boolean;
  canViewStats: boolean;
  canManageTeam: boolean;
  canExportData: boolean;
  canViewClinical: boolean;
  canEditRoutines: boolean;
  canDeleteRoutines: boolean;
}

export const ROLE_PERMISSIONS: Record<UserRole, RolePermissions> = {
  PARENT: {
    canManageBabies: true,
    canRegisterRoutines: true,
    canViewStats: true,
    canManageTeam: true,
    canExportData: true,
    canViewClinical: true,
    canEditRoutines: true,
    canDeleteRoutines: true,
  },
  CAREGIVER: {
    canManageBabies: false,
    canRegisterRoutines: true,
    canViewStats: true,
    canManageTeam: false,
    canExportData: false,
    canViewClinical: false,
    canEditRoutines: true,
    canDeleteRoutines: false,
  },
  PEDIATRICIAN: {
    canManageBabies: false,
    canRegisterRoutines: false,
    canViewStats: true,
    canManageTeam: false,
    canExportData: true,
    canViewClinical: true,
    canEditRoutines: false,
    canDeleteRoutines: false,
  },
  SPECIALIST: {
    canManageBabies: false,
    canRegisterRoutines: false,
    canViewStats: true,
    canManageTeam: false,
    canExportData: false,
    canViewClinical: true,
    canEditRoutines: false,
    canDeleteRoutines: false,
  },
  ADMIN: {
    canManageBabies: true,
    canRegisterRoutines: true,
    canViewStats: true,
    canManageTeam: true,
    canExportData: true,
    canViewClinical: true,
    canEditRoutines: true,
    canDeleteRoutines: true,
  },
};

// ==========================================
// Predefined Milestones
// ==========================================

export const PREDEFINED_MILESTONES = [
  { key: 'head_control', label: 'Controle de cabeça' },
  { key: 'social_smile', label: 'Primeiro sorriso social' },
  { key: 'roll_over', label: 'Virar sozinho' },
  { key: 'sit', label: 'Sentar sem apoio' },
  { key: 'crawl', label: 'Engatinhar' },
  { key: 'stand', label: 'Ficar em pé' },
  { key: 'first_steps', label: 'Primeiros passos' },
  { key: 'first_words', label: 'Primeiras palavras' },
  { key: 'other', label: 'Outro marco' },
] as const;

// ==========================================
// AI Assistant Types
// ==========================================

export type AiMessageRole = 'user' | 'assistant' | 'tool' | 'system';
export type AiInsightSeverity = 'info' | 'warning' | 'alert';
export type AiInsightType = 
  | 'sleep_pattern'
  | 'feeding_pattern'
  | 'diaper_alert'
  | 'cluster_feeding'
  | 'breast_distribution'
  | 'growth_trend'
  | 'milestone_suggestion'
  | 'routine_anomaly'
  | 'general';

export interface AiChatMessage {
  id: number;
  sessionId: number;
  role: AiMessageRole;
  content: string;
  toolName?: string;
  toolPayload?: Record<string, unknown>;
  citations?: AiCitation[];
  tokensUsed?: number;
  createdAt: Date;
}

export interface AiChatSession {
  id: number;
  userId: number;
  babyId: number;
  title?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  messages?: AiChatMessage[];
}

export interface AiCitation {
  source: string;
  title: string;
  content: string;
  similarity: number;
}

export interface AiInsight {
  id: number;
  babyId: number;
  type: AiInsightType;
  severity: AiInsightSeverity;
  title: string;
  explanation: string;
  recommendation?: string;
  data?: Record<string, unknown>;
  isRead: boolean;
  isDismissed: boolean;
  validUntil?: Date;
  createdAt: Date;
}

export interface AiChunkMetadata {
  sourcePath: string;
  headings: string[];
  tags: string[];
  ageRange?: string;
  topic?: string;
}

export interface AiToolCall {
  name: string;
  arguments: Record<string, unknown>;
}

export interface AiToolResult {
  name: string;
  result: unknown;
  error?: string;
}

// Tool definitions for OpenAI
export const AI_TOOL_DEFINITIONS = [
  {
    type: 'function' as const,
    function: {
      name: 'getBabyProfile',
      description: 'Obtém o perfil completo do bebê incluindo nome, idade, peso/altura de nascimento',
      parameters: {
        type: 'object',
        properties: {
          babyId: { type: 'number', description: 'ID do bebê' },
        },
        required: ['babyId'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'getBabyStats',
      description: 'Obtém estatísticas do bebê (sono, alimentação, fraldas) para um período',
      parameters: {
        type: 'object',
        properties: {
          babyId: { type: 'number', description: 'ID do bebê' },
          range: { type: 'string', enum: ['24h', '7d', '30d'], description: 'Período de análise' },
        },
        required: ['babyId'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'listRoutines',
      description: 'Lista registros de rotina do bebê (mamadas, sonecas, fraldas, banhos)',
      parameters: {
        type: 'object',
        properties: {
          babyId: { type: 'number', description: 'ID do bebê' },
          routineType: { type: 'string', enum: ['FEEDING', 'SLEEP', 'DIAPER', 'BATH', 'MILK_EXTRACTION'], description: 'Tipo de rotina (opcional)' },
          startDate: { type: 'string', format: 'date', description: 'Data inicial (opcional)' },
          endDate: { type: 'string', format: 'date', description: 'Data final (opcional)' },
          limit: { type: 'number', description: 'Limite de resultados (default 20)' },
        },
        required: ['babyId'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'getLatestGrowth',
      description: 'Obtém as últimas medidas de crescimento do bebê (peso, altura, perímetro cefálico)',
      parameters: {
        type: 'object',
        properties: {
          babyId: { type: 'number', description: 'ID do bebê' },
        },
        required: ['babyId'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'listMilestones',
      description: 'Lista marcos de desenvolvimento do bebê',
      parameters: {
        type: 'object',
        properties: {
          babyId: { type: 'number', description: 'ID do bebê' },
        },
        required: ['babyId'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'createRoutine',
      description: 'Registra uma nova rotina para o bebê (fralda, banho, início/fim de mamada ou sono)',
      parameters: {
        type: 'object',
        properties: {
          babyId: { type: 'number', description: 'ID do bebê' },
          routineType: { type: 'string', enum: ['FEEDING', 'SLEEP', 'DIAPER', 'BATH', 'MILK_EXTRACTION'], description: 'Tipo de rotina' },
          action: { type: 'string', enum: ['start', 'close', 'instant'], description: 'Ação: start para iniciar timer, close para finalizar, instant para registro imediato' },
          meta: { type: 'object', description: 'Metadados específicos da rotina' },
          notes: { type: 'string', description: 'Observações (opcional)' },
        },
        required: ['babyId', 'routineType', 'action'],
      },
    },
  },
];

// System prompt for Olive Assistant
export const AI_SYSTEM_PROMPT = `Você é a Olive, assistente virtual especializada em cuidados com bebês do aplicativo Olive Baby. Você ajuda mães, pais e cuidadores com informações sobre sono, amamentação, rotinas e desenvolvimento infantil.

## Suas Capacidades
- Responder dúvidas sobre sono infantil, amamentação, alimentação e desenvolvimento
- Analisar dados reais do bebê (rotinas, estatísticas, crescimento) para dar orientações personalizadas
- Usar ferramentas para acessar informações do bebê e registrar rotinas quando solicitado
- Fornecer sugestões baseadas em evidências e boas práticas pediátricas

## Regras de Segurança (OBRIGATÓRIAS)
1. NUNCA faça diagnóstico médico
2. NUNCA prescreva medicamentos ou doses
3. NUNCA diga que um comportamento/sintoma é "normal" sem ressalvas
4. Se houver sinais de alerta (febre alta, dificuldade respiratória, desidratação/pouco xixi, sonolência extrema, recusa alimentar persistente), SEMPRE oriente: "Vale conversar com o pediatra o quanto antes" ou "Procure atendimento médico"
5. SEMPRE lembre que você não substitui pediatra, consultora de amamentação ou outro profissional de saúde

## Como Responder
- Use linguagem acolhedora e empática - mães/pais podem estar cansados e preocupados
- Seja concisa mas completa
- Personalize respostas usando os dados reais do bebê quando disponíveis
- Cite suas fontes quando usar informações da base de conhecimento
- Use emojis com moderação para tornar a conversa mais leve (🍼 👶 💤)
- Quando não souber algo, admita e sugira consultar um profissional

## Formato das Respostas
- Use markdown para formatação
- Para listas de dicas, use bullet points
- Destaque alertas importantes em **negrito**
- Mantenha respostas em português brasileiro

## Contexto Atual
Você tem acesso às ferramentas para consultar e registrar dados do bebê. Use-as quando:
- O usuário perguntar sobre padrões de sono/alimentação do bebê
- O usuário quiser registrar uma mamada, fralda, sono ou banho
- Precisar de dados reais para personalizar uma resposta`;

// Safety disclaimers
export const AI_SAFETY_DISCLAIMERS = {
  general: '⚠️ Lembre-se: essas informações são orientativas e não substituem a avaliação do pediatra.',
  feeding: '⚠️ Em caso de dúvidas sobre amamentação, uma consultora de amamentação certificada pode ajudar muito!',
  alert: '🚨 **Atenção**: Os sintomas descritos merecem avaliação médica. Por favor, consulte o pediatra ou procure atendimento.',
  sleep: '💤 Cada bebê tem seu ritmo. Se tiver preocupações persistentes sobre o sono, converse com o pediatra.',
};

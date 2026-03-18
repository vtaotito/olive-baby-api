// OlieCare API - Journey Service
import { JourneyStatus, Prisma } from '@prisma/client';
import { prisma } from '../config/database';
import { logger } from '../config/logger';

export interface CreateJourneyInput {
  name: string;
  description?: string;
  category: string;
  audience: string;
  priority?: number;
  tags?: string[];
  steps?: CreateStepInput[];
}

export interface CreateStepInput {
  type: string;
  name: string;
  stepOrder: number;
  config: Record<string, unknown>;
  variables?: Record<string, unknown>[];
}

export interface UpdateJourneyInput {
  name?: string;
  description?: string;
  category?: string;
  audience?: string;
  priority?: number;
  tags?: string[];
  status?: JourneyStatus;
}

export class JourneyService {
  static async list(filters?: {
    category?: string;
    audience?: string;
    status?: JourneyStatus;
    page?: number;
    limit?: number;
  }) {
    const where: Prisma.JourneyWhereInput = {};
    if (filters?.category) where.category = filters.category;
    if (filters?.audience) where.audience = filters.audience;
    if (filters?.status) where.status = filters.status;

    const page = filters?.page ?? 1;
    const limit = filters?.limit ?? 50;

    const [items, total] = await Promise.all([
      prisma.journey.findMany({
        where,
        include: { steps: { orderBy: { stepOrder: 'asc' } } },
        orderBy: [{ priority: 'desc' }, { updatedAt: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.journey.count({ where }),
    ]);

    return { items, total, page, limit };
  }

  static async getById(id: number) {
    return prisma.journey.findUnique({
      where: { id },
      include: { steps: { orderBy: { stepOrder: 'asc' } } },
    });
  }

  static async create(input: CreateJourneyInput) {
    const { steps, ...journeyData } = input;

    return prisma.journey.create({
      data: {
        ...journeyData,
        tags: journeyData.tags ?? [],
        steps: steps
          ? {
              create: steps.map((s) => ({
                type: s.type,
                name: s.name,
                stepOrder: s.stepOrder,
                config: s.config as Prisma.InputJsonValue,
                variables: (s.variables ?? []) as Prisma.InputJsonValue,
              })),
            }
          : undefined,
      },
      include: { steps: { orderBy: { stepOrder: 'asc' } } },
    });
  }

  static async update(id: number, input: UpdateJourneyInput) {
    const data: Prisma.JourneyUpdateInput = {};
    if (input.name !== undefined) data.name = input.name;
    if (input.description !== undefined) data.description = input.description;
    if (input.category !== undefined) data.category = input.category;
    if (input.audience !== undefined) data.audience = input.audience;
    if (input.priority !== undefined) data.priority = input.priority;
    if (input.tags !== undefined) data.tags = input.tags;
    if (input.status !== undefined) {
      data.status = input.status;
      if (input.status === 'ACTIVE') data.activatedAt = new Date();
    }

    return prisma.journey.update({
      where: { id },
      data,
      include: { steps: { orderBy: { stepOrder: 'asc' } } },
    });
  }

  static async delete(id: number) {
    return prisma.journey.delete({ where: { id } });
  }

  static async activate(id: number, active: boolean) {
    return prisma.journey.update({
      where: { id },
      data: {
        status: active ? 'ACTIVE' : 'PAUSED',
        activatedAt: active ? new Date() : undefined,
      },
      include: { steps: { orderBy: { stepOrder: 'asc' } } },
    });
  }

  static async addStep(journeyId: number, input: CreateStepInput) {
    return prisma.journeyStep.create({
      data: {
        journeyId,
        type: input.type,
        name: input.name,
        stepOrder: input.stepOrder,
        config: input.config as Prisma.InputJsonValue,
        variables: (input.variables ?? []) as Prisma.InputJsonValue,
      },
    });
  }

  static async updateStep(
    stepId: number,
    input: Partial<CreateStepInput>
  ) {
    const data: Prisma.JourneyStepUpdateInput = {};
    if (input.type !== undefined) data.type = input.type;
    if (input.name !== undefined) data.name = input.name;
    if (input.stepOrder !== undefined) data.stepOrder = input.stepOrder;
    if (input.config !== undefined) data.config = input.config as Prisma.InputJsonValue;
    if (input.variables !== undefined) data.variables = input.variables as Prisma.InputJsonValue;

    return prisma.journeyStep.update({ where: { id: stepId }, data });
  }

  static async deleteStep(stepId: number) {
    return prisma.journeyStep.delete({ where: { id: stepId } });
  }

  static async replaceSteps(journeyId: number, steps: CreateStepInput[]) {
    await prisma.journeyStep.deleteMany({ where: { journeyId } });
    if (steps.length === 0) return [];

    await prisma.journeyStep.createMany({
      data: steps.map((s) => ({
        journeyId,
        type: s.type,
        name: s.name,
        stepOrder: s.stepOrder,
        config: s.config as Prisma.InputJsonValue,
        variables: (s.variables ?? []) as Prisma.InputJsonValue,
      })),
    });

    return prisma.journeyStep.findMany({
      where: { journeyId },
      orderBy: { stepOrder: 'asc' },
    });
  }

  static async getMetrics() {
    const [total, byStatus, byCategory, recentActive] = await Promise.all([
      prisma.journey.count(),
      prisma.journey.groupBy({ by: ['status'], _count: { id: true } }),
      prisma.journey.groupBy({ by: ['category'], _count: { id: true } }),
      prisma.journey.findMany({
        where: { status: 'ACTIVE' },
        include: { steps: { orderBy: { stepOrder: 'asc' } } },
        orderBy: { activatedAt: 'desc' },
        take: 5,
      }),
    ]);

    const statusMap: Record<string, number> = {};
    byStatus.forEach((s) => { statusMap[s.status] = s._count.id; });

    const categoryMap: Record<string, number> = {};
    byCategory.forEach((c) => { categoryMap[c.category] = c._count.id; });

    const totalSent = await prisma.journey.aggregate({ _sum: { totalSent: true } });
    const totalDelivered = await prisma.journey.aggregate({ _sum: { totalDelivered: true } });

    return {
      total,
      byStatus: statusMap,
      byCategory: categoryMap,
      totalSent: totalSent._sum.totalSent ?? 0,
      totalDelivered: totalDelivered._sum.totalDelivered ?? 0,
      recentActive,
    };
  }

  static async getTemplateJourneys() {
    return JOURNEY_TEMPLATES;
  }
}

// ==========================================
// Pre-built Journey Templates
// ==========================================

const JOURNEY_TEMPLATES = [
  {
    id: 'onboarding_b2c',
    name: 'Onboarding B2C - Novos Pais',
    description: 'Jornada de boas-vindas e ativação para novos pais/cuidadores',
    category: 'onboarding',
    audience: 'b2c',
    steps: [
      { type: 'email', name: 'E-mail de Boas-vindas', stepOrder: 0, config: { templateType: 'welcome', subject: 'Bem-vindo ao OlieCare! 🌿' }, variables: [{ key: 'userName', label: 'Nome do usuário' }] },
      { type: 'delay', name: 'Aguardar 24h', stepOrder: 1, config: { hours: 24 } },
      { type: 'push', name: 'Push: Complete o cadastro', stepOrder: 2, config: { title: 'Falta pouco para começar! 👶', body: 'Complete o cadastro do seu bebê para começar a acompanhar a rotina.', clickAction: '/onboarding' } },
      { type: 'delay', name: 'Aguardar 48h', stepOrder: 3, config: { hours: 48 } },
      { type: 'condition', name: 'Verificar: bebê cadastrado?', stepOrder: 4, config: { field: 'hasBaby', operator: 'equals', value: false } },
      { type: 'email', name: 'E-mail: Dicas de registro', stepOrder: 5, config: { templateType: 'custom', subject: 'Dicas para registrar a rotina do bebê 📝', customBody: 'Veja como aproveitar ao máximo o OlieCare...' } },
    ],
  },
  {
    id: 'onboarding_b2b',
    name: 'Onboarding B2B - Profissionais',
    description: 'Jornada de ativação para pediatras e especialistas',
    category: 'onboarding',
    audience: 'b2b',
    steps: [
      { type: 'email', name: 'E-mail: Convite aceito', stepOrder: 0, config: { templateType: 'professional_invite', subject: 'Bem-vindo ao OlieCare Profissional!' } },
      { type: 'delay', name: 'Aguardar 2 dias', stepOrder: 1, config: { hours: 48 } },
      { type: 'push', name: 'Push: Configure seu perfil', stepOrder: 2, config: { title: 'Configure seu perfil profissional 🏥', body: 'Adicione seu CRM e especialidade para começar a receber pacientes.', clickAction: '/prof/settings' } },
      { type: 'delay', name: 'Aguardar 3 dias', stepOrder: 3, config: { hours: 72 } },
      { type: 'push', name: 'Push: Convide pacientes', stepOrder: 4, config: { title: 'Convide seus pacientes! 📋', body: 'Envie convites para seus pacientes começarem a compartilhar rotinas.', clickAction: '/prof/dashboard' } },
    ],
  },
  {
    id: 'engagement_reactivation',
    name: 'Reativação de Usuários Inativos',
    description: 'Campanha para trazer de volta usuários que não acessam há dias',
    category: 'engagement',
    audience: 'all',
    steps: [
      { type: 'push', name: 'Push: Sentimos sua falta', stepOrder: 0, config: { title: 'Sentimos sua falta! 🌿', body: 'Faz alguns dias que você não registra a rotina do bebê.', clickAction: '/dashboard' } },
      { type: 'delay', name: 'Aguardar 2 dias', stepOrder: 1, config: { hours: 48 } },
      { type: 'condition', name: 'Usuário ainda inativo?', stepOrder: 2, config: { field: 'lastActivity', operator: 'olderThan', value: 5 } },
      { type: 'email', name: 'E-mail: Novidades da plataforma', stepOrder: 3, config: { templateType: 'custom', subject: 'Novidades do OlieCare que você perdeu! ✨', customBody: 'Confira os novos recursos que adicionamos...' } },
      { type: 'delay', name: 'Aguardar 5 dias', stepOrder: 4, config: { hours: 120 } },
      { type: 'push', name: 'Push: Oferta especial', stepOrder: 5, config: { title: 'Oferta especial para você! 🎁', body: 'Volte e ganhe funcionalidades Premium por 7 dias grátis.', clickAction: '/settings', priority: 'high' } },
    ],
  },
  {
    id: 'premium_activation',
    name: 'Conversão Free → Premium',
    description: 'Jornada para converter usuários Free em Premium',
    category: 'premium',
    audience: 'free',
    steps: [
      { type: 'condition', name: 'Usuário ativo há 7+ dias?', stepOrder: 0, config: { field: 'accountAge', operator: 'greaterThan', value: 7 } },
      { type: 'push', name: 'Push: Recurso Premium', stepOrder: 1, config: { title: 'Desbloqueie insights avançados 🧠', body: 'O plano Premium traz análises de IA sobre o desenvolvimento do seu bebê.', clickAction: '/settings' } },
      { type: 'delay', name: 'Aguardar 3 dias', stepOrder: 2, config: { hours: 72 } },
      { type: 'email', name: 'E-mail: Comparação de planos', stepOrder: 3, config: { templateType: 'custom', subject: 'Veja tudo que o Premium oferece 💎', customBody: 'Compare os planos e descubra como o Premium pode ajudar...' } },
      { type: 'delay', name: 'Aguardar 4 dias', stepOrder: 4, config: { hours: 96 } },
      { type: 'push', name: 'Push: Desconto especial', stepOrder: 5, config: { title: 'Desconto exclusivo! 💰', body: '20% OFF no primeiro mês Premium. Aproveite!', clickAction: '/settings', priority: 'high' } },
    ],
  },
  {
    id: 'invite_campaign',
    name: 'Campanha de Convites',
    description: 'Incentiva usuários a convidarem familiares e profissionais',
    category: 'invites',
    audience: 'b2c',
    steps: [
      { type: 'push', name: 'Push: Convide a família', stepOrder: 0, config: { title: 'Compartilhe com a família! 👨‍👩‍👧', body: 'Convide outros cuidadores para acompanhar a rotina do bebê juntos.', clickAction: '/babies' } },
      { type: 'delay', name: 'Aguardar 5 dias', stepOrder: 1, config: { hours: 120 } },
      { type: 'email', name: 'E-mail: Benefícios do compartilhamento', stepOrder: 2, config: { templateType: 'custom', subject: 'Por que compartilhar o cuidado é importante 🤝', customBody: 'Estudos mostram que bebês com múltiplos cuidadores...' } },
      { type: 'delay', name: 'Aguardar 7 dias', stepOrder: 3, config: { hours: 168 } },
      { type: 'push', name: 'Push: Conecte o pediatra', stepOrder: 4, config: { title: 'Conecte o pediatra do bebê! 👨‍⚕️', body: 'O pediatra pode acompanhar a rotina diretamente pelo OlieCare.', clickAction: '/babies' } },
    ],
  },
  {
    id: 'retention_premium',
    name: 'Retenção Premium',
    description: 'Jornada para reter assinantes Premium próximos do vencimento',
    category: 'retention',
    audience: 'premium',
    steps: [
      { type: 'push', name: 'Push: Resumo de uso', stepOrder: 0, config: { title: 'Veja quanto você usou este mês! 📊', body: 'Seu resumo mensal está pronto. Confira os insights do bebê.', clickAction: '/dashboard' } },
      { type: 'delay', name: 'Aguardar 3 dias', stepOrder: 1, config: { hours: 72 } },
      { type: 'email', name: 'E-mail: Renovação', stepOrder: 2, config: { templateType: 'subscription_cancelled', subject: 'Sua assinatura expira em breve ⏰' } },
      { type: 'delay', name: 'Aguardar 2 dias', stepOrder: 3, config: { hours: 48 } },
      { type: 'push', name: 'Push: Oferta de renovação', stepOrder: 4, config: { title: 'Renove com desconto! 💎', body: 'Renove agora e ganhe 15% de desconto no próximo período.', clickAction: '/settings', priority: 'high' } },
    ],
  },
];

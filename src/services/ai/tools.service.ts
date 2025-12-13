// Olive Baby API - AI Tools Service
// Implements the functions that the LLM can call

import { prisma } from '../../config/database';
import { logger } from '../../config/logger';
import { RoutineService } from '../routine.service';
import { StatsService } from '../stats.service';
import { AiToolResult } from '../../types';
import { differenceInDays, differenceInMonths, differenceInWeeks } from 'date-fns';

interface ToolContext {
  userId: number;
  caregiverId: number;
  babyId: number;
}

export class AIToolsService {
  /**
   * Executa uma ferramenta e retorna o resultado
   */
  async executeTool(
    toolName: string,
    args: Record<string, unknown>,
    context: ToolContext
  ): Promise<AiToolResult> {
    try {
      logger.info(`🔧 Executing tool: ${toolName}`, { args, context });

      switch (toolName) {
        case 'getBabyProfile':
          return await this.getBabyProfile(context);

        case 'getBabyStats':
          return await this.getBabyStats(
            context,
            (args.range as string) || '24h'
          );

        case 'listRoutines':
          return await this.listRoutines(context, {
            routineType: args.routineType as string,
            startDate: args.startDate as string,
            endDate: args.endDate as string,
            limit: (args.limit as number) || 20,
          });

        case 'getLatestGrowth':
          return await this.getLatestGrowth(context);

        case 'listMilestones':
          return await this.listMilestones(context);

        case 'createRoutine':
          return await this.createRoutine(context, {
            routineType: args.routineType as string,
            action: args.action as 'start' | 'close' | 'instant',
            meta: args.meta as Record<string, unknown>,
            notes: args.notes as string,
          });

        default:
          return {
            name: toolName,
            result: null,
            error: `Ferramenta desconhecida: ${toolName}`,
          };
      }
    } catch (error) {
      logger.error(`Tool execution error: ${toolName}`, error);
      return {
        name: toolName,
        result: null,
        error: error instanceof Error ? error.message : 'Erro ao executar ferramenta',
      };
    }
  }

  /**
   * Obtém o perfil do bebê
   */
  private async getBabyProfile(context: ToolContext): Promise<AiToolResult> {
    const baby = await prisma.baby.findUnique({
      where: { id: context.babyId },
      include: {
        caregivers: {
          include: {
            caregiver: {
              select: {
                fullName: true,
              },
            },
          },
        },
      },
    });

    if (!baby) {
      return {
        name: 'getBabyProfile',
        result: null,
        error: 'Bebê não encontrado',
      };
    }

    const birthDate = new Date(baby.birthDate);
    const now = new Date();
    const ageInDays = differenceInDays(now, birthDate);
    const ageInWeeks = differenceInWeeks(now, birthDate);
    const ageInMonths = differenceInMonths(now, birthDate);

    let ageDescription: string;
    if (ageInMonths >= 1) {
      const months = ageInMonths;
      const remainingWeeks = Math.floor((ageInDays - months * 30) / 7);
      ageDescription = `${months} ${months === 1 ? 'mês' : 'meses'}`;
      if (remainingWeeks > 0 && months < 6) {
        ageDescription += ` e ${remainingWeeks} ${remainingWeeks === 1 ? 'semana' : 'semanas'}`;
      }
    } else if (ageInWeeks >= 1) {
      ageDescription = `${ageInWeeks} ${ageInWeeks === 1 ? 'semana' : 'semanas'}`;
    } else {
      ageDescription = `${ageInDays} ${ageInDays === 1 ? 'dia' : 'dias'}`;
    }

    const profile = {
      nome: baby.name,
      dataNascimento: baby.birthDate,
      idade: ageDescription,
      idadeEmDias: ageInDays,
      idadeEmSemanas: ageInWeeks,
      idadeEmMeses: ageInMonths,
      pesoNascimento: baby.birthWeightGrams ? `${baby.birthWeightGrams}g` : null,
      alturaNascimento: baby.birthLengthCm ? `${baby.birthLengthCm}cm` : null,
      cidade: baby.city,
      estado: baby.state,
      cuidadores: baby.caregivers.map(cb => ({
        nome: cb.caregiver.fullName,
        relacao: cb.relationship,
        principal: cb.isPrimary,
      })),
    };

    return {
      name: 'getBabyProfile',
      result: profile,
    };
  }

  /**
   * Obtém estatísticas do bebê
   */
  private async getBabyStats(
    context: ToolContext,
    range: string
  ): Promise<AiToolResult> {
    const days = range === '30d' ? 30 : range === '7d' ? 7 : 1;

    const stats = await StatsService.getStats(context.caregiverId, context.babyId, days);

    // Format stats for LLM consumption
    const formattedStats = {
      periodo: range,
      sono: {
        totalHoje: `${stats.totalSleepHours24h}h`,
        mediaDiaria: `${stats.averageSleepPerDay}h`,
      },
      alimentacao: {
        mamadas24h: stats.feedingCount24h,
        tempoTotal24h: `${stats.totalFeedingMinutes24h} minutos`,
        distribuicaoSeio: stats.breastSideDistribution,
        complemento24h: stats.totalComplementMl24h > 0 ? `${stats.totalComplementMl24h}ml` : 'nenhum',
        mamadeira24h: stats.totalBottleMl24h > 0 ? `${stats.totalBottleMl24h}ml` : 'nenhuma',
      },
      fraldas: {
        total24h: stats.totalDiaper24h,
      },
      extracaoLeite: {
        total24h: stats.totalExtractionMl24h > 0 ? `${stats.totalExtractionMl24h}ml` : 'nenhuma',
      },
      atividadePorHora: this.formatHourlyActivity(stats.hourlyCounts),
    };

    return {
      name: 'getBabyStats',
      result: formattedStats,
    };
  }

  /**
   * Lista rotinas do bebê
   */
  private async listRoutines(
    context: ToolContext,
    options: {
      routineType?: string;
      startDate?: string;
      endDate?: string;
      limit: number;
    }
  ): Promise<AiToolResult> {
    const filter: any = {
      babyId: context.babyId,
    };

    if (options.routineType) {
      filter.routineType = options.routineType;
    }

    if (options.startDate) {
      filter.startDate = new Date(options.startDate);
    }

    if (options.endDate) {
      filter.endDate = new Date(options.endDate);
    }

    const result = await RoutineService.list(context.caregiverId, filter, 1, options.limit);

    const formattedRoutines = result.data.map(routine => ({
      tipo: this.translateRoutineType(routine.routineType),
      inicio: routine.startTime,
      fim: routine.endTime,
      duracao: routine.durationSeconds
        ? `${Math.round(routine.durationSeconds / 60)} minutos`
        : 'em andamento',
      detalhes: this.formatRoutineMeta(routine.routineType, routine.meta),
      observacoes: routine.notes,
    }));

    return {
      name: 'listRoutines',
      result: {
        total: result.pagination.total,
        rotinas: formattedRoutines,
      },
    };
  }

  /**
   * Obtém últimas medidas de crescimento
   */
  private async getLatestGrowth(context: ToolContext): Promise<AiToolResult> {
    const growth = await prisma.growth.findFirst({
      where: { babyId: context.babyId },
      orderBy: { measuredAt: 'desc' },
    });

    if (!growth) {
      return {
        name: 'getLatestGrowth',
        result: {
          mensagem: 'Nenhuma medida de crescimento registrada ainda.',
        },
      };
    }

    return {
      name: 'getLatestGrowth',
      result: {
        dataAfericao: growth.measuredAt,
        peso: growth.weightKg ? `${growth.weightKg}kg` : null,
        altura: growth.heightCm ? `${growth.heightCm}cm` : null,
        perimetroCefalico: growth.headCircumferenceCm
          ? `${growth.headCircumferenceCm}cm`
          : null,
        observacoes: growth.notes,
      },
    };
  }

  /**
   * Lista marcos de desenvolvimento
   */
  private async listMilestones(context: ToolContext): Promise<AiToolResult> {
    const milestones = await prisma.milestone.findMany({
      where: { babyId: context.babyId },
      orderBy: { occurredOn: 'desc' },
    });

    const formattedMilestones = milestones.map(m => ({
      marco: m.milestoneLabel,
      dataAlcancado: m.occurredOn,
      observacoes: m.notes,
    }));

    return {
      name: 'listMilestones',
      result: {
        total: milestones.length,
        marcos: formattedMilestones,
      },
    };
  }

  /**
   * Cria uma nova rotina
   */
  private async createRoutine(
    context: ToolContext,
    options: {
      routineType: string;
      action: 'start' | 'close' | 'instant';
      meta?: Record<string, unknown>;
      notes?: string;
    }
  ): Promise<AiToolResult> {
    const { routineType, action, meta, notes } = options;
    const type = routineType as any;

    try {
      let routine;

      if (action === 'instant') {
        // Instant routines (DIAPER)
        routine = await RoutineService.registerInstantRoutine(
          context.caregiverId,
          context.babyId,
          type,
          meta as any,
          notes
        );
      } else if (action === 'start') {
        // Start timer-based routine
        routine = await RoutineService.startRoutine(
          context.caregiverId,
          context.babyId,
          type,
          meta as any,
          notes
        );
      } else if (action === 'close') {
        // Close timer-based routine
        routine = await RoutineService.closeRoutine(
          context.caregiverId,
          context.babyId,
          type,
          meta as any,
          notes
        );
      }

      const actionText =
        action === 'instant'
          ? 'registrado'
          : action === 'start'
          ? 'iniciado'
          : 'finalizado';

      return {
        name: 'createRoutine',
        result: {
          sucesso: true,
          mensagem: `${this.translateRoutineType(type)} ${actionText} com sucesso!`,
          rotina: {
            id: routine?.id,
            tipo: this.translateRoutineType(type),
            inicio: routine?.startTime,
            fim: routine?.endTime,
          },
        },
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro ao registrar rotina';
      return {
        name: 'createRoutine',
        result: null,
        error: errorMessage,
      };
    }
  }

  // ==========================================
  // Helper Methods
  // ==========================================

  private translateRoutineType(type: string): string {
    const translations: Record<string, string> = {
      FEEDING: 'Mamada',
      SLEEP: 'Soneca',
      DIAPER: 'Troca de fralda',
      BATH: 'Banho',
      MILK_EXTRACTION: 'Extração de leite',
    };
    return translations[type] || type;
  }

  private formatRoutineMeta(type: string, meta: any): string | null {
    if (!meta) return null;

    switch (type) {
      case 'FEEDING':
        const parts: string[] = [];
        if (meta.feedingType === 'breast' && meta.breastSide) {
          parts.push(`seio ${meta.breastSide === 'left' ? 'esquerdo' : meta.breastSide === 'right' ? 'direito' : 'ambos'}`);
        }
        if (meta.bottleMl) {
          parts.push(`${meta.bottleMl}ml mamadeira`);
        }
        if (meta.complementMl) {
          parts.push(`${meta.complementMl}ml complemento`);
        }
        return parts.length > 0 ? parts.join(', ') : null;

      case 'DIAPER':
        const types: string[] = [];
        if (meta.diaperType === 'pee' || meta.diaperType === 'both') types.push('xixi');
        if (meta.diaperType === 'poop' || meta.diaperType === 'both') types.push('cocô');
        return types.join(' e ');

      case 'MILK_EXTRACTION':
        if (meta.extractionMl) {
          return `${meta.extractionMl}ml extraídos`;
        }
        return null;

      default:
        return null;
    }
  }

  private formatHourlyActivity(hourlyCounts: number[]): string {
    const periods = {
      madrugada: hourlyCounts.slice(0, 6).reduce((a, b) => a + b, 0),
      manha: hourlyCounts.slice(6, 12).reduce((a, b) => a + b, 0),
      tarde: hourlyCounts.slice(12, 18).reduce((a, b) => a + b, 0),
      noite: hourlyCounts.slice(18, 24).reduce((a, b) => a + b, 0),
    };

    return `Madrugada: ${periods.madrugada}, Manhã: ${periods.manha}, Tarde: ${periods.tarde}, Noite: ${periods.noite}`;
  }
}

// Singleton instance
export const aiToolsService = new AIToolsService();

// Olive Baby API - CSV Export Helper
import { createObjectCsvStringifier } from 'csv-writer';
import { RoutineLog, RoutineType } from '@prisma/client';
import { formatDateBR, formatTimeBR, formatDuration } from './date.helper';

interface RoutineLogWithMeta extends Omit<RoutineLog, 'meta'> {
  meta: Record<string, unknown> | null;
}

const ROUTINE_TYPE_LABELS: Record<RoutineType, string> = {
  FEEDING: 'Alimentação',
  SLEEP: 'Sono',
  DIAPER: 'Fralda',
  BATH: 'Banho',
  MILK_EXTRACTION: 'Extração de Leite',
};

export function generateRoutinesCsv(routines: RoutineLogWithMeta[]): string {
  const csvStringifier = createObjectCsvStringifier({
    header: [
      { id: 'data', title: 'Data' },
      { id: 'hora_inicio', title: 'Hora Início' },
      { id: 'hora_fim', title: 'Hora Fim' },
      { id: 'tipo_rotina', title: 'Tipo de Rotina' },
      { id: 'duracao_minutos', title: 'Duração (min)' },
      { id: 'detalhes', title: 'Detalhes' },
      { id: 'observacoes', title: 'Observações' },
    ],
  });

  const records = routines.map(routine => ({
    data: formatDateBR(routine.startTime),
    hora_inicio: formatTimeBR(routine.startTime),
    hora_fim: routine.endTime ? formatTimeBR(routine.endTime) : '-',
    tipo_rotina: ROUTINE_TYPE_LABELS[routine.routineType],
    duracao_minutos: routine.durationSeconds 
      ? Math.round(routine.durationSeconds / 60).toString() 
      : '-',
    detalhes: formatRoutineDetails(routine),
    observacoes: routine.notes || '',
  }));

  const header = csvStringifier.getHeaderString();
  const body = csvStringifier.stringifyRecords(records);

  return header + body;
}

function formatRoutineDetails(routine: RoutineLogWithMeta): string {
  if (!routine.meta) return '';

  const meta = routine.meta as Record<string, unknown>;
  const details: string[] = [];

  switch (routine.routineType) {
    case 'FEEDING':
      if (meta.feedingType) {
        const typeLabels: Record<string, string> = {
          breast: 'Amamentação',
          bottle: 'Mamadeira',
          solid: 'Sólidos',
        };
        details.push(typeLabels[meta.feedingType as string] || meta.feedingType as string);
      }
      if (meta.breastSide) {
        const sideLabels: Record<string, string> = {
          left: 'Esquerdo',
          right: 'Direito',
          both: 'Ambos',
        };
        details.push(`Lado: ${sideLabels[meta.breastSide as string] || meta.breastSide}`);
      }
      if (meta.bottleMl) {
        details.push(`${meta.bottleMl}ml`);
      }
      if (meta.complement === 'yes' && meta.complementMl) {
        details.push(`Complemento: ${meta.complementMl}ml`);
      }
      break;

    case 'DIAPER':
      if (meta.diaperType) {
        const diaperLabels: Record<string, string> = {
          pee: 'Xixi',
          poop: 'Cocô',
          both: 'Xixi e Cocô',
        };
        details.push(diaperLabels[meta.diaperType as string] || meta.diaperType as string);
      }
      break;

    case 'MILK_EXTRACTION':
      if (meta.extractionMl) {
        details.push(`${meta.extractionMl}ml`);
      }
      if (meta.extractionMethod) {
        const methodLabels: Record<string, string> = {
          manual: 'Manual',
          electric: 'Elétrica',
        };
        details.push(methodLabels[meta.extractionMethod as string] || meta.extractionMethod as string);
      }
      break;

    case 'BATH':
      if (meta.bathTemperature) {
        details.push(`${meta.bathTemperature}°C`);
      }
      break;

    case 'SLEEP':
      if (meta.sleepQuality) {
        const qualityLabels: Record<string, string> = {
          good: 'Bom',
          regular: 'Regular',
          bad: 'Ruim',
        };
        details.push(`Qualidade: ${qualityLabels[meta.sleepQuality as string] || meta.sleepQuality}`);
      }
      break;
  }

  return details.join(' | ');
}

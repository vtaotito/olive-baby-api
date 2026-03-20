import fs from 'fs/promises';
import path from 'path';
import { logger } from '../config/logger';

export interface TemplateVariables {
  [key: string]: unknown;
}

export interface RenderOptions {
  variables: TemplateVariables;
  templatePath?: string;
}

const isProduction = (process.env.NODE_ENV || 'development') === 'production';
const INTERNAL_WEB_URL = process.env.INTERNAL_WEB_URL || 'http://olivebaby-web-server';
const TEMPLATES_DIR = isProduction
  ? null
  : path.join(process.cwd(), '..', 'olive-baby-web', 'public', 'email-templates');

function renderTemplate(html: string, variables: TemplateVariables): string {
  let rendered = html;

  rendered = rendered.replace(/\{\{#each\s+(\w+)\}\}([\s\S]*?)\{\{\/each\}\}/g, (_match, arrayName, content) => {
    const array = variables[arrayName];
    if (!Array.isArray(array) || array.length === 0) return '';
    return array.map((item, index) => {
      const itemVars: TemplateVariables = {
        ...variables,
        '@index': index,
        '@first': index === 0,
        '@last': index === array.length - 1,
      };
      if (typeof item === 'object' && item !== null) Object.assign(itemVars, item);
      else itemVars['this'] = item as string;
      return renderTemplate(content, itemVars);
    }).join('');
  });

  rendered = rendered.replace(/\{\{#if\s+(\w+)\}\}([\s\S]*?)\{\{\/if\}\}/g, (_match, varName, content) => {
    const value = variables[varName];
    if (value && value !== 'false' && value !== '0' && value !== '') {
      return renderTemplate(content, variables);
    }
    return '';
  });

  rendered = rendered.replace(/\{\{(\w+)\}\}/g, (_match, varName) => {
    const value = variables[varName];
    if (value === undefined || value === null) return '';
    return String(value);
  });

  return rendered;
}

async function loadTemplateContent(templateName: string): Promise<string> {
  const cleanName = templateName.replace(/\.html$/, '');

  if (TEMPLATES_DIR) {
    const filePath = path.join(TEMPLATES_DIR, `${cleanName}.html`);
    return fs.readFile(filePath, 'utf-8');
  }

  const url = `${INTERNAL_WEB_URL}/email-templates/${cleanName}.html`;
  const resp = await fetch(url);
  if (!resp.ok) {
    throw new Error(`HTTP ${resp.status} fetching template from ${url}`);
  }
  return resp.text();
}

export async function renderEmailTemplate(
  templateName: string,
  variables: TemplateVariables
): Promise<string> {
  try {
    const html = await loadTemplateContent(templateName);
    return renderTemplate(html, variables);
  } catch (error: any) {
    logger.error('Failed to render email template', {
      templateName,
      error: error.message,
    });
    throw new Error(`Failed to render template ${templateName}: ${error.message}`);
  }
}

export async function getTemplatePreview(templateName: string): Promise<string | null> {
  try {
    const sampleVariables: TemplateVariables = {
      userName: 'Maria Silva',
      babyName: 'João',
      babyId: '123',
      routineType: 'mamada',
      routineCount: '42',
      daysActive: '30',
      totalRoutines: '150',
      totalDays: '365',
      totalInsights: '45',
      totalMilestones: '12',
      insight: 'Seu bebê está dormindo em média 14 horas por dia, o que é ideal para a idade.',
      milestone: '100 rotinas registradas',
      milestoneBadge: '🏆',
      featureName: 'Insights de IA',
      featureDescription: 'Análise inteligente dos padrões do seu bebê.',
      daysInactive: '7',
      avgSleepHours: '12.5',
      announcementTitle: 'Novidade no OlieCare!',
      announcementBody: 'Estamos trazendo novas funcionalidades para você.',
      unsubscribeUrl: 'https://oliecare.cloud/unsubscribe',
    };
    return await renderEmailTemplate(templateName, sampleVariables);
  } catch (error: any) {
    logger.error('Failed to get template preview', { templateName, error: error.message });
    return null;
  }
}

export async function listAvailableTemplates(): Promise<string[]> {
  if (!TEMPLATES_DIR) {
    return [
      '09-onboarding-day1', '10-first-baby-registered', '11-first-routine-recorded',
      '12-onboarding-day3', '13-onboarding-day7', '14-weekly-insights',
      '15-milestone-achievement', '16-feature-discovery', '17-educational-tip',
      '18-premium-teaser', '19-premium-feature-locked', '20-premium-trial-ending',
      '21-inactivity-reminder', '22-comeback-surprise', '23-annual-review',
      '24-professional-welcome', '25-first-patient-connected', '26-professional-tips',
      '27-patient-activity-summary', '28-professional-feature-update',
      '29-feedback-request', '30-announcement',
    ];
  }
  try {
    const files = await fs.readdir(TEMPLATES_DIR);
    return files
      .filter(file => file.endsWith('.html') && !file.startsWith('_'))
      .map(file => file.replace('.html', ''))
      .sort();
  } catch (error: any) {
    logger.error('Failed to list templates', { error: error.message });
    return [];
  }
}

export function validateTemplateVariables(
  _templateName: string,
  _variables: TemplateVariables
): { valid: boolean; missing: string[] } {
  return { valid: true, missing: [] };
}

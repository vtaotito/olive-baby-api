// OlieCare API - Email Template Service
// Renders HTML email templates with variable substitution
import fs from 'fs/promises';
import path from 'path';
import { logger } from '../config/logger';

// ==========================================
// Types
// ==========================================

export interface TemplateVariables {
  [key: string]: string | number | boolean | undefined | null;
}

export interface RenderOptions {
  variables: TemplateVariables;
  templatePath?: string;
}

// ==========================================
// Template Paths
// ==========================================

// Templates are in the frontend project, but we need to access them from the API
// In production, templates are served via the web server, so we fetch them via HTTP
// In development, we can use a relative path
import { env } from '../config/env';

const isProduction = env.NODE_ENV === 'production';
const FRONTEND_URL = env.FRONTEND_URL || 'https://oliecare.cloud';
const TEMPLATES_DIR = isProduction 
  ? null // Will fetch via HTTP
  : path.join(process.cwd(), '..', 'olive-baby-web', 'public', 'email-templates');

/**
 * Get the full path or URL to a template file
 */
function getTemplatePath(templateName: string): string | null {
  // Remove .html extension if present
  const cleanName = templateName.replace(/\.html$/, '');
  
  if (TEMPLATES_DIR) {
    // Development: use local file path
    return path.join(TEMPLATES_DIR, `${cleanName}.html`);
  } else {
    // Production: return URL to fetch via HTTP
    return `${FRONTEND_URL}/email-templates/${cleanName}.html`;
  }
}

// ==========================================
// Template Rendering
// ==========================================

/**
 * Simple template variable substitution
 * Supports {{variable}} and {{#if variable}}...{{/if}} syntax
 */
function renderTemplate(html: string, variables: TemplateVariables): string {
  let rendered = html;

  // Replace simple variables: {{variableName}}
  rendered = rendered.replace(/\{\{(\w+)\}\}/g, (match, varName) => {
    const value = variables[varName];
    if (value === undefined || value === null) {
      logger.warn(`Template variable ${varName} is undefined`, { variables });
      return '';
    }
    return String(value);
  });

  // Handle conditional blocks: {{#if variable}}...{{/if}}
  rendered = rendered.replace(/\{\{#if\s+(\w+)\}\}([\s\S]*?)\{\{\/if\}\}/g, (match, varName, content) => {
    const value = variables[varName];
    if (value && value !== 'false' && value !== '0' && value !== '') {
      // Recursively render the content inside the block
      return renderTemplate(content, variables);
    }
    return '';
  });

  // Handle {{#each array}}...{{/each}} blocks
  rendered = rendered.replace(/\{\{#each\s+(\w+)\}\}([\s\S]*?)\{\{\/each\}\}/g, (match, arrayName, content) => {
    const array = variables[arrayName];
    if (!Array.isArray(array) || array.length === 0) {
      return '';
    }
    
    return array.map((item, index) => {
      // Create a new variables object with item data
      const itemVariables: TemplateVariables = {
        ...variables,
        '@index': index,
        '@first': index === 0,
        '@last': index === array.length - 1,
      };
      
      // If item is an object, merge its properties
      if (typeof item === 'object' && item !== null) {
        Object.assign(itemVariables, item);
      } else {
        itemVariables['this'] = item;
      }
      
      return renderTemplate(content, itemVariables);
    }).join('');
  });

  return rendered;
}

/**
 * Load and render an email template
 */
export async function renderEmailTemplate(
  templateName: string,
  variables: TemplateVariables
): Promise<string> {
  try {
    const templatePathOrUrl = getTemplatePath(templateName);
    
    if (!templatePathOrUrl) {
      throw new Error(`Template path not configured for: ${templateName}`);
    }

    let templateContent: string;

    // Check if it's a URL (production) or file path (development)
    if (templatePathOrUrl.startsWith('http://') || templatePathOrUrl.startsWith('https://')) {
      // Production: fetch template via HTTP
      try {
        const response = await fetch(templatePathOrUrl);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        templateContent = await response.text();
      } catch (fetchError: any) {
        throw new Error(`Failed to fetch template from ${templatePathOrUrl}: ${fetchError.message}`);
      }
    } else {
      // Development: read from file system
      try {
        await fs.access(templatePathOrUrl);
      } catch {
        throw new Error(`Template not found: ${templateName} (path: ${templatePathOrUrl})`);
      }
      templateContent = await fs.readFile(templatePathOrUrl, 'utf-8');
    }

    // Render template with variables
    const rendered = renderTemplate(templateContent, variables);

    return rendered;
  } catch (error: any) {
    logger.error('Failed to render email template', {
      templateName,
      error: error.message,
      stack: error.stack,
    });
    throw new Error(`Failed to render template ${templateName}: ${error.message}`);
  }
}

/**
 * Get template preview with sample data
 */
export async function getTemplatePreview(templateName: string): Promise<string | null> {
  try {
    // Sample variables for preview
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
      unsubscribeUrl: 'https://oliecare.cloud/unsubscribe',
      // Add more sample variables as needed
    };

    return await renderEmailTemplate(templateName, sampleVariables);
  } catch (error: any) {
    logger.error('Failed to get template preview', {
      templateName,
      error: error.message,
    });
    return null;
  }
}

/**
 * List all available templates
 */
export async function listAvailableTemplates(): Promise<string[]> {
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

/**
 * Validate template variables
 * Checks if all required variables are provided
 */
export function validateTemplateVariables(
  templateName: string,
  variables: TemplateVariables
): { valid: boolean; missing: string[] } {
  // Extract all variable names from template
  const templatePath = getTemplatePath(templateName);
  
  // For now, return valid - in production, you might want to parse the template
  // and check for required variables
  return { valid: true, missing: [] };
}

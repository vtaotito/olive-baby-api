import { prisma } from '../config/database';
import { env } from '../config/env';
import { logger } from '../config/logger';

type ContentAudience = 'b2c_parents' | 'b2b_pediatricians' | 'b2b_lactation' | 'b2b_caregivers';

interface SocialTopicSuggestion {
  caption: string;
  hashtags: string[];
  audience: ContentAudience;
  platforms: string[];
  angle: string;
  contentType: string;
}

interface GeneratedCaption {
  caption: string;
  hashtags: string[];
  platforms: string[];
}

async function callLLM(systemPrompt: string, userPrompt: string, temperature = 0.7): Promise<string> {
  if (env.ANTHROPIC_API_KEY) {
    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': env.ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: env.ANTHROPIC_MODEL || 'claude-sonnet-4-20250514',
          max_tokens: 4096,
          temperature,
          system: systemPrompt + '\n\nIMPORTANTE: Responda APENAS com JSON válido.',
          messages: [{ role: 'user', content: userPrompt }],
        }),
      });
      if (response.ok) {
        const data = await response.json() as { content: Array<{ text: string }> };
        const text = data.content?.[0]?.text || '{}';
        const match = text.match(/\{[\s\S]*\}/);
        return match ? match[0] : '{}';
      }
    } catch (e) {
      logger.warn('Anthropic failed for social content, falling back to OpenAI');
    }
  }

  if (!env.OPENAI_API_KEY) throw new Error('Nenhuma API key de IA configurada');

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: env.OPENAI_MODEL || 'gpt-4o',
      messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }],
      temperature,
      response_format: { type: 'json_object' },
    }),
  });

  if (!response.ok) throw new Error(`OpenAI API error: ${response.status}`);
  const data = await response.json() as { choices: Array<{ message: { content: string } }> };
  return data.choices[0]?.message?.content || '{}';
}

export class AISocialContentService {
  static async generateTopics(config?: {
    count?: number;
    audience?: ContentAudience;
    platforms?: string[];
  }): Promise<SocialTopicSuggestion[]> {
    const count = config?.count || 5;

    const existingCaptions = await prisma.socialPost.findMany({
      select: { caption: true },
      orderBy: { createdAt: 'desc' },
      take: 30,
    });
    const existingContext = existingCaptions.map(p => p.caption.substring(0, 80)).join('\n- ');

    const systemPrompt = `Você é um social media manager sênior da OlieCare, app de acompanhamento de bebês.

## Sobre a OlieCare
App para registrar rotinas do bebê (sono, alimentação, fraldas), crescimento, marcos, vacinas. Portal profissional para pediatras e especialistas. Assistente de IA.

## Estratégia Multi-Audiência para Redes Sociais

### b2c_parents (Pais e Famílias)
- Conteúdo emocional, dicas práticas, marcos do bebê, humor parental
- Formatos: carrossel, reels curtos, stories informativos
- CTA: "Baixe o OlieCare" / "Acompanhe no app"

### b2b_pediatricians (Pediatras)
- Conteúdo profissional: dados, estudos, eficiência no consultório
- Formatos: posts técnicos, infográficos, depoimentos
- CTA: "Conheça o portal profissional" / "Acompanhe pacientes remotamente"

### b2b_lactation (Consultoras de Amamentação)
- Técnicas, dados de mamada, casos de sucesso
- Formatos: carrossel educativo, dicas visuais
- CTA: "Recomende OlieCare para suas pacientes"

### b2b_caregivers (Cuidadores)
- Rotina, comunicação, registros compartilhados
- Formatos: posts práticos, checklists
- CTA: "Use OlieCare para manter a família informada"

## Limites por Plataforma
- Instagram: 2200 chars, visual-first, hashtags importantes
- LinkedIn: 3000 chars, profissional, sem muitas hashtags
- Twitter/X: 280 chars, conciso, threads para mais conteúdo
- Facebook: longo OK, engagement, compartilhável
- Threads: 500 chars, conversacional

Responda em JSON:
{ "topics": [{ "caption": "...", "hashtags": ["..."], "audience": "...", "platforms": ["instagram","linkedin"], "angle": "...", "contentType": "carrossel|post|reels|story|thread" }] }`;

    let audienceInstruction = '';
    if (config?.audience) {
      audienceInstruction = `\nGere TODAS as pautas para a audiência "${config.audience}".`;
    } else {
      audienceInstruction = '\nDistribua entre as 4 audiências.';
    }

    const platformHint = config?.platforms?.length
      ? `\nPlataformas alvo: ${config.platforms.join(', ')}`
      : '';

    const userPrompt = `Sugira ${count} posts para redes sociais da OlieCare.
${audienceInstruction}${platformHint}
${existingContext ? `\nPosts existentes (NÃO repetir):\n- ${existingContext}` : ''}`;

    try {
      const raw = await callLLM(systemPrompt, userPrompt, 0.8);
      const parsed = JSON.parse(raw);
      return (parsed.topics || []) as SocialTopicSuggestion[];
    } catch (error) {
      logger.error('Failed to generate social topics', { error });
      throw error;
    }
  }

  static async generateCaption(topic: {
    idea: string;
    audience?: ContentAudience;
    platforms?: string[];
  }): Promise<GeneratedCaption> {
    const audience = topic.audience || 'b2c_parents';
    const platforms = topic.platforms || ['instagram'];

    const charLimits: Record<string, number> = {
      instagram: 2200, linkedin: 3000, twitter: 280, facebook: 5000, threads: 500,
    };
    const targetLimit = Math.min(...platforms.map(p => charLimits[p] || 2200));

    const systemPrompt = `Você é um copywriter sênior de redes sociais da OlieCare (app de acompanhamento de bebês).

Escreva legendas em português brasileiro que sejam:
- Engajadoras e com hook forte nos primeiros 125 caracteres
- Adaptadas para ${platforms.join(', ')}
- Máximo ${targetLimit} caracteres
- Com call-to-action claro
- Tom adequado para a audiência ${audience}
- Incluir emojis relevantes com moderação
- Hashtags separadas no campo próprio (5-15 hashtags)

Responda em JSON:
{ "caption": "...", "hashtags": ["..."], "platforms": ${JSON.stringify(platforms)} }`;

    const userPrompt = `Crie uma legenda para o seguinte conteúdo:\n${topic.idea}`;

    try {
      const raw = await callLLM(systemPrompt, userPrompt, 0.7);
      return JSON.parse(raw) as GeneratedCaption;
    } catch (error) {
      logger.error('Failed to generate social caption', { error });
      throw error;
    }
  }
}

import { prisma } from '../config/database';
import { env } from '../config/env';
import { logger } from '../config/logger';

interface TopicSuggestion {
  title: string;
  angle: string;
  targetKeywords: string[];
  category: string;
  estimatedSearchVolume: string;
}

interface GeneratedContent {
  title: string;
  content: string;
  excerpt: string;
  seoTitle: string;
  seoDescription: string;
  seoKeywords: string[];
  suggestedCategory: string;
  suggestedTags: string[];
}

interface SEOOptimization {
  seoTitle: string;
  seoDescription: string;
  seoKeywords: string[];
  excerpt: string;
  readingTimeMin: number;
  schemaMarkup: Record<string, unknown>;
}

async function callOpenAI(systemPrompt: string, userPrompt: string, temperature = 0.7): Promise<string> {
  if (!env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY não configurada');
  }

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: env.OPENAI_MODEL || 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature,
      response_format: { type: 'json_object' },
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    logger.error('OpenAI API error', { status: response.status, error: err });
    throw new Error(`OpenAI API error: ${response.status}`);
  }

  const data = await response.json() as { choices: Array<{ message: { content: string } }> };
  return data.choices[0]?.message?.content || '{}';
}

export class AIContentService {
  static async generateTopics(config?: {
    count?: number;
    focus?: string;
  }): Promise<TopicSuggestion[]> {
    const count = config?.count || 5;
    const focusHint = config?.focus || '';

    const recentQuestions = await prisma.aiChatMessage.findMany({
      where: { role: 'user' },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: { content: true },
    });
    const questionsContext = recentQuestions
      .map(q => q.content)
      .filter(c => c.length > 10)
      .slice(0, 20)
      .join('\n- ');

    const existingTitles = await prisma.blogPost.findMany({
      select: { title: true },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    const existingContext = existingTitles.map(p => p.title).join('\n- ');

    const systemPrompt = `Você é um estrategista de conteúdo especializado em saúde infantil, parentalidade e cuidados com bebês.
Seu objetivo é sugerir pautas de blog posts que:
- Atendam dúvidas reais de pais e cuidadores brasileiros
- Tenham alto potencial de SEO (volume de busca razoável)
- Sejam relevantes para a plataforma OlieCare (app de acompanhamento de bebês)
- Considerem sazonalidade e tendências atuais
- NÃO repitam tópicos já existentes

Responda SEMPRE em JSON com a estrutura:
{ "topics": [{ "title": "...", "angle": "...", "targetKeywords": ["..."], "category": "...", "estimatedSearchVolume": "alto|medio|baixo" }] }`;

    const userPrompt = `Sugira ${count} pautas de blog posts para o OlieCare (plataforma de cuidados com bebês).

${focusHint ? `Foco especial em: ${focusHint}\n` : ''}
${questionsContext ? `Perguntas frequentes dos usuários:\n- ${questionsContext}\n` : ''}
${existingContext ? `Posts já existentes (NÃO repetir):\n- ${existingContext}\n` : ''}

Categorias disponíveis: Sono do Bebê, Amamentação, Alimentação, Desenvolvimento, Saúde, Rotina, Dicas para Pais, Gravidez`;

    try {
      const raw = await callOpenAI(systemPrompt, userPrompt, 0.8);
      const parsed = JSON.parse(raw);
      return (parsed.topics || []) as TopicSuggestion[];
    } catch (error) {
      logger.error('Failed to generate topics', { error });
      throw error;
    }
  }

  static async generateContent(topic: {
    title: string;
    angle?: string;
    targetKeywords?: string[];
  }): Promise<GeneratedContent> {
    const systemPrompt = `Você é um redator especializado em conteúdo sobre cuidados com bebês e parentalidade.
Escreva artigos em português brasileiro que sejam:
- Baseados em evidências científicas e boas práticas pediátricas
- Acolhedores e empáticos no tom
- Estruturados com headings semânticos (H2, H3)
- Otimizados para SEO com a keyword principal nos primeiros 100 caracteres
- Entre 1500 e 3000 palavras
- Com uma seção FAQ no final (3-5 perguntas)
- Com introdução direta que responda a intenção de busca (position zero)

⚠️ NUNCA faça diagnóstico médico nem prescreva medicamentos.
⚠️ SEMPRE recomende consultar o pediatra quando apropriado.

Responda em JSON:
{
  "title": "...",
  "content": "... (markdown)",
  "excerpt": "... (max 160 chars, otimizado para featured snippet)",
  "seoTitle": "... (max 60 chars)",
  "seoDescription": "... (max 155 chars com CTA)",
  "seoKeywords": ["..."],
  "suggestedCategory": "...",
  "suggestedTags": ["..."]
}`;

    const keywordsHint = topic.targetKeywords?.length
      ? `Keywords alvo: ${topic.targetKeywords.join(', ')}`
      : '';

    const userPrompt = `Escreva um artigo completo sobre:
Título: ${topic.title}
${topic.angle ? `Ângulo: ${topic.angle}` : ''}
${keywordsHint}

Estruture com:
1. Introdução (responda a pergunta principal nos primeiros 2 parágrafos)
2. 3-5 seções H2 com conteúdo detalhado
3. Dicas práticas em bullet points
4. Seção FAQ com perguntas e respostas
5. Conclusão com call-to-action`;

    try {
      const raw = await callOpenAI(systemPrompt, userPrompt, 0.7);
      return JSON.parse(raw) as GeneratedContent;
    } catch (error) {
      logger.error('Failed to generate content', { error });
      throw error;
    }
  }

  static async optimizeSEO(post: {
    id: number;
    title: string;
    content: string;
    excerpt?: string | null;
  }): Promise<SEOOptimization> {
    const wordCount = post.content.trim().split(/\s+/).length;
    const readingTimeMin = Math.max(1, Math.ceil(wordCount / 200));

    const systemPrompt = `Você é um especialista em SEO técnico e AIO (AI Optimization).
Analise o conteúdo e gere metadados otimizados para motores de busca e sistemas de IA.

Responda em JSON:
{
  "seoTitle": "... (max 60 chars, com keyword principal)",
  "seoDescription": "... (max 155 chars, com CTA)",
  "seoKeywords": ["... (5-10 LSI keywords)"],
  "excerpt": "... (max 160 chars, otimizado para featured snippet)",
  "readingTimeMin": number,
  "schemaMarkup": {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    "headline": "...",
    "description": "...",
    "author": { "@type": "Organization", "name": "OlieCare" },
    "publisher": { "@type": "Organization", "name": "OlieCare", "url": "https://oliecare.cloud" },
    "mainEntityOfPage": { "@type": "WebPage" },
    "articleSection": "...",
    "keywords": "...",
    "wordCount": ${wordCount},
    "faq": [{ "question": "...", "answer": "..." }]
  }
}

Para o schemaMarkup.faq, extraia perguntas e respostas da seção FAQ do conteúdo (se houver).
Se houver FAQ, adicione também um bloco FAQPage separado dentro do schema.`;

    const userPrompt = `Otimize o SEO para este artigo:

Título: ${post.title}
${post.excerpt ? `Excerpt atual: ${post.excerpt}` : ''}

Conteúdo (primeiros 3000 chars):
${post.content.substring(0, 3000)}`;

    try {
      const raw = await callOpenAI(systemPrompt, userPrompt, 0.3);
      const parsed = JSON.parse(raw) as SEOOptimization;
      parsed.readingTimeMin = readingTimeMin;
      return parsed;
    } catch (error) {
      logger.error('Failed to optimize SEO', { error });
      throw error;
    }
  }
}

import { prisma } from '../config/database';
import { env } from '../config/env';
import { logger } from '../config/logger';

type ContentAudience = 'b2c_parents' | 'b2b_pediatricians' | 'b2b_lactation' | 'b2b_caregivers';

interface TopicSuggestion {
  title: string;
  angle: string;
  targetKeywords: string[];
  category: string;
  estimatedSearchVolume: string;
  audience: ContentAudience;
}

interface ContentSource {
  title: string;
  url: string;
  publisher?: string;
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
  sources?: ContentSource[];
  qualityScore?: number;
  reviewSummary?: string;
}

interface ResearchResult {
  summary: string;
  sources: ContentSource[];
}

interface EditorialReview {
  qualityScore: number;
  safe: boolean;
  issues: string[];
  reviewSummary: string;
  revisedContent?: string;
}

interface SEOOptimization {
  seoTitle: string;
  seoDescription: string;
  seoKeywords: string[];
  excerpt: string;
  readingTimeMin: number;
  schemaMarkup: Record<string, unknown>;
}

type AIProvider = 'anthropic' | 'openai';

function getProvider(): AIProvider {
  if (env.ANTHROPIC_API_KEY) return 'anthropic';
  if (env.OPENAI_API_KEY) return 'openai';
  throw new Error('Nenhuma API key de IA configurada (ANTHROPIC_API_KEY ou OPENAI_API_KEY)');
}

async function callAnthropic(systemPrompt: string, userPrompt: string, temperature = 0.7): Promise<string> {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': env.ANTHROPIC_API_KEY!,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: env.ANTHROPIC_MODEL || 'claude-sonnet-4-20250514',
      max_tokens: 8192,
      temperature,
      system: systemPrompt + '\n\nIMPORTANTE: Responda APENAS com JSON válido, sem texto adicional antes ou depois.',
      messages: [
        { role: 'user', content: userPrompt },
      ],
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    logger.error('Anthropic API error', { status: response.status, error: err });
    throw new Error(`Anthropic API error: ${response.status}`);
  }

  const data = await response.json() as {
    content: Array<{ type: string; text: string }>;
  };
  const text = data.content?.[0]?.text || '{}';
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  return jsonMatch ? jsonMatch[0] : '{}';
}

async function callOpenAI(systemPrompt: string, userPrompt: string, temperature = 0.7): Promise<string> {
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

async function callLLM(systemPrompt: string, userPrompt: string, temperature = 0.7): Promise<string> {
  const provider = getProvider();
  logger.info(`AI content: using ${provider} provider`);

  if (provider === 'anthropic') {
    try {
      return await callAnthropic(systemPrompt, userPrompt, temperature);
    } catch (error) {
      if (env.OPENAI_API_KEY) {
        logger.warn('Anthropic failed, falling back to OpenAI', { error: (error as Error).message });
        return callOpenAI(systemPrompt, userPrompt, temperature);
      }
      throw error;
    }
  }
  return callOpenAI(systemPrompt, userPrompt, temperature);
}

/**
 * Etapa de pesquisa/grounding. Usa a ferramenta nativa de web search da Anthropic
 * para coletar fontes confiáveis (SBP, AAP, OMS, Ministério da Saúde) antes de redigir.
 * Falha de forma graciosa (retorna null) quando indisponível, sem quebrar o fluxo.
 */
async function researchTopic(topic: {
  title: string;
  angle?: string;
  targetKeywords?: string[];
}): Promise<ResearchResult | null> {
  if (!env.BLOG_AI_RESEARCH_ENABLED) return null;
  if (!env.ANTHROPIC_API_KEY) {
    logger.info('Blog research skipped: ANTHROPIC_API_KEY not set (web search requires Anthropic)');
    return null;
  }

  const maxSources = Math.max(1, Math.min(env.BLOG_AI_RESEARCH_MAX_SOURCES, 8));
  const system = `Você é um pesquisador de saúde infantil. Pesquise na web fontes CONFIÁVEIS e ATUAIS sobre o tema fornecido.
Priorize: Sociedade Brasileira de Pediatria (SBP), American Academy of Pediatrics (AAP), OMS/WHO, Ministério da Saúde, UNICEF, periódicos científicos e diretrizes oficiais.
Evite blogs comerciais, fóruns e fontes sem credibilidade.
Ao final, responda APENAS com JSON válido (sem texto adicional) no formato:
{ "summary": "resumo dos achados com os pontos-chave baseados em evidência (max 1200 chars)", "sources": [{ "title": "...", "url": "https://...", "publisher": "..." }] }
Inclua no máximo ${maxSources} fontes, todas com URL real verificada na busca.`;

  const userPrompt = `Tema: ${topic.title}
${topic.angle ? `Ângulo: ${topic.angle}` : ''}
${topic.targetKeywords?.length ? `Palavras-chave: ${topic.targetKeywords.join(', ')}` : ''}

Pesquise e retorne o resumo de evidências + fontes confiáveis.`;

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
        system,
        messages: [{ role: 'user', content: userPrompt }],
        tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: maxSources }],
      }),
      signal: AbortSignal.timeout(120000),
    });

    if (!response.ok) {
      const err = await response.text();
      logger.warn('Blog research web_search failed', { status: response.status, error: err.slice(0, 300) });
      return null;
    }

    const data = await response.json() as { content?: Array<{ type: string; text?: string }> };
    const text = (data.content || [])
      .filter(b => b.type === 'text' && b.text)
      .map(b => b.text as string)
      .join('\n');

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    const parsed = JSON.parse(jsonMatch[0]) as ResearchResult;
    const sources = (parsed.sources || [])
      .filter(s => s && typeof s.url === 'string' && /^https?:\/\//.test(s.url))
      .slice(0, maxSources);

    logger.info('Blog research completed', { topic: topic.title, sources: sources.length });
    return { summary: parsed.summary || '', sources };
  } catch (error) {
    logger.warn('Blog research step errored, proceeding without grounding', {
      error: (error as Error).message,
    });
    return null;
  }
}

/**
 * Auto-revisão editorial: 2ª passagem em baixa temperatura que checa segurança médica,
 * precisão factual (vs. fontes), legibilidade e presença de CTA. Pode devolver o conteúdo
 * revisado. Falha graciosamente devolvendo o conteúdo original com score neutro.
 */
async function reviewContent(args: {
  title: string;
  content: string;
  audience: ContentAudience;
  sources: ContentSource[];
}): Promise<EditorialReview> {
  const fallback: EditorialReview = {
    qualityScore: 70,
    safe: true,
    issues: [],
    reviewSummary: 'Revisão automática indisponível; conteúdo não alterado.',
  };

  if (!env.BLOG_AI_REVIEW_ENABLED) {
    return { ...fallback, reviewSummary: 'Auto-revisão desabilitada por configuração.' };
  }

  const sourcesText = args.sources.length
    ? args.sources.map(s => `- ${s.title} (${s.publisher || ''}): ${s.url}`).join('\n')
    : 'Nenhuma fonte fornecida.';

  const systemPrompt = `Você é um editor sênior de conteúdo de saúde infantil. Revise o artigo em Markdown com rigor:
1. SEGURANÇA MÉDICA: não pode haver diagnóstico, prescrição de medicamentos/dosagens ou promessas de cura. Deve recomendar consultar profissional quando apropriado.
2. PRECISÃO FACTUAL: afirmações devem ser consistentes com evidências e com as fontes fornecidas. Corrija exageros e generalizações sem suporte.
3. LEGIBILIDADE: estrutura clara (H2/H3), parágrafos curtos, linguagem adequada à audiência.
4. CTA: deve haver um call-to-action coerente para a audiência.

Devolva o conteúdo revisado (corrija o que for necessário, preservando o sentido e o tamanho aproximado) e uma avaliação.

Responda APENAS com JSON válido:
{
  "qualityScore": <0-100>,
  "safe": <true|false>,
  "issues": ["..."],
  "reviewSummary": "resumo curto do que foi ajustado (max 400 chars)",
  "revisedContent": "markdown completo revisado"
}`;

  const userPrompt = `Audiência: ${args.audience}
Título: ${args.title}

Fontes de referência:
${sourcesText}

Conteúdo (Markdown) a revisar:
${args.content}`;

  try {
    const raw = await callLLM(systemPrompt, userPrompt, 0.2);
    const parsed = JSON.parse(raw) as EditorialReview;
    return {
      qualityScore: typeof parsed.qualityScore === 'number' ? parsed.qualityScore : fallback.qualityScore,
      safe: parsed.safe !== false,
      issues: Array.isArray(parsed.issues) ? parsed.issues : [],
      reviewSummary: parsed.reviewSummary || 'Revisão concluída.',
      revisedContent: typeof parsed.revisedContent === 'string' && parsed.revisedContent.length > 200
        ? parsed.revisedContent
        : undefined,
    };
  } catch (error) {
    logger.warn('Editorial review step errored, keeping original content', {
      error: (error as Error).message,
    });
    return fallback;
  }
}

/** Constrói a seção "Referências" em Markdown a partir das fontes coletadas. */
function buildReferencesSection(sources: ContentSource[]): string {
  if (!sources.length) return '';
  const items = sources
    .map(s => `- [${s.title || s.url}](${s.url})${s.publisher ? ` — ${s.publisher}` : ''}`)
    .join('\n');
  return `\n\n## Referências\n\n${items}\n`;
}

/** Busca posts publicados (título + slug) para sugerir links internos. */
async function getInternalLinkCandidates(limit = 30): Promise<Array<{ title: string; slug: string }>> {
  try {
    const posts = await prisma.blogPost.findMany({
      where: { status: 'PUBLISHED' },
      orderBy: { publishedAt: 'desc' },
      take: limit,
      select: { title: true, slug: true },
    });
    return posts;
  } catch {
    return [];
  }
}

export class AIContentService {
  static async generateTopics(config?: {
    count?: number;
    focus?: string;
    audience?: ContentAudience;
  }): Promise<TopicSuggestion[]> {
    const count = config?.count || 5;
    const focusHint = config?.focus || '';
    const audienceFilter = config?.audience || '';

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

    const systemPrompt = `Você é um estrategista de conteúdo sênior da OlieCare, plataforma de acompanhamento de bebês usada por pais, cuidadores, pediatras e consultoras de amamentação.

## Sobre a OlieCare
A OlieCare é um app que permite registrar rotinas do bebê (sono, alimentação, fraldas), acompanhar crescimento, marcos de desenvolvimento, vacinas, e conta com um assistente de IA. Tem portal para profissionais (pediatras, especialistas) acompanharem pacientes remotamente.

## Estratégia de Conteúdo Multi-Audiência
O blog atende 4 públicos estratégicos. Cada pauta DEVE indicar a audiência:

### 1. b2c_parents (Pais e Famílias)
- Dúvidas do dia a dia: sono, amamentação, alimentação, marcos
- Tom acolhedor e empático, baseado em evidências
- CTA: usar o OlieCare para acompanhar o bebê

### 2. b2b_pediatricians (Pediatras)
- Conteúdo técnico-científico sobre acompanhamento neonatal e pediátrico
- Como a tecnologia (apps como OlieCare) melhora o acompanhamento de pacientes
- Eficiência no consultório: dados de rotina dos pacientes, telemedicina, prontuário digital
- Tom profissional e baseado em estudos
- CTA: conhecer o portal profissional OlieCare para acompanhar pacientes

### 3. b2b_lactation (Consultoras de Amamentação e Especialistas)
- Técnicas avançadas de manejo de amamentação, pega correta, banco de leite
- Como usar dados de registro de mamadas para orientar mães (tempo, frequência, distribuição)
- Casos práticos de como ferramentas digitais potencializam o atendimento
- Tom técnico mas acessível
- CTA: recomendar OlieCare para suas pacientes e usar o portal profissional

### 4. b2b_caregivers (Cuidadores, Babás, Avós)
- Rotina prática de cuidados, transição de cuidador, comunicação com os pais
- Como registrar e compartilhar informações do bebê com a família
- Tom prático e inclusivo
- CTA: usar o OlieCare para manter todos informados sobre o bebê

## Regras
- Distribuir pautas entre as audiências (não concentrar em uma só)
- Posts B2B devem posicionar o profissional como promotor da OlieCare para famílias (B2C)
- Incluir keyword potencial SEO realista para cada pauta
- NÃO repetir tópicos já existentes

Responda SEMPRE em JSON:
{ "topics": [{ "title": "...", "angle": "...", "targetKeywords": ["..."], "category": "...", "estimatedSearchVolume": "alto|medio|baixo", "audience": "b2c_parents|b2b_pediatricians|b2b_lactation|b2b_caregivers" }] }`;

    let audienceInstruction = '';
    if (audienceFilter) {
      const labels: Record<string, string> = {
        b2c_parents: 'pais e famílias (B2C)',
        b2b_pediatricians: 'pediatras (B2B)',
        b2b_lactation: 'consultoras de amamentação e especialistas (B2B)',
        b2b_caregivers: 'cuidadores, babás e avós (B2B)',
      };
      audienceInstruction = `\nFOCO: Gere TODAS as pautas para a audiência "${labels[audienceFilter]}".`;
    } else {
      audienceInstruction = `\nDistribua as pautas entre as audiências: pelo menos 2 para b2c_parents, 1 para b2b_pediatricians, 1 para b2b_lactation, e 1 para b2b_caregivers.`;
    }

    const userPrompt = `Sugira ${count} pautas de blog posts para o OlieCare.
${audienceInstruction}
${focusHint ? `\nFoco especial em: ${focusHint}` : ''}
${questionsContext ? `\nPerguntas frequentes dos usuários:\n- ${questionsContext}` : ''}
${existingContext ? `\nPosts já existentes (NÃO repetir):\n- ${existingContext}` : ''}

Categorias disponíveis: Sono do Bebê, Amamentação, Alimentação, Desenvolvimento, Saúde, Rotina, Dicas para Pais, Gravidez, Para Profissionais, Para Cuidadores, Consultório Digital, Tecnologia e Saúde`;

    try {
      const raw = await callLLM(systemPrompt, userPrompt, 0.8);
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
    audience?: ContentAudience;
  }): Promise<GeneratedContent> {
    const audience = topic.audience || 'b2c_parents';

    const audienceInstructions: Record<ContentAudience, string> = {
      b2c_parents: `## Audiência: Pais e Famílias (B2C)
- Tom acolhedor, empático e encorajador. Mães e pais podem estar cansados e inseguros.
- Linguagem acessível, evitando jargões médicos sem explicação.
- Exemplos práticos do cotidiano com bebês.
- CTA final: "Acompanhe cada momento do desenvolvimento do seu bebê com o OlieCare. Comece grátis em oliecare.cloud"
- Mencione naturalmente como registrar rotinas no app pode ajudar a identificar padrões.`,

      b2b_pediatricians: `## Audiência: Pediatras (B2B Profissional)
- Tom profissional, baseado em evidências científicas e guidelines (SBP, AAP, OMS).
- Cite estudos e referências quando relevante (pode citar de forma genérica).
- Foque em como a tecnologia melhora o acompanhamento pediátrico: dados de rotina em tempo real, teleconsulta, prontuário digital.
- Mostre como o profissional pode se diferenciar usando ferramentas como a OlieCare.
- CTA final: "Conheça o Portal Profissional da OlieCare e acompanhe seus pacientes remotamente com dados reais de rotina. Acesse prof.oliecare.cloud"
- Posicione o pediatra como promotor da plataforma: ao recomendar o OlieCare aos pais, ele ganha visibilidade dos dados do bebê para melhor acompanhamento.`,

      b2b_lactation: `## Audiência: Consultoras de Amamentação e Especialistas (B2B)
- Tom técnico mas acessível, voltado para profissionais de saúde.
- Aborde técnicas de manejo, pega correta, livre demanda, banco de leite, complementação.
- Mostre como dados de registro de mamadas (frequência, duração, lateralidade) auxiliam na avaliação e orientação.
- CTA final: "Recomende o OlieCare para suas pacientes: o registro detalhado de mamadas ajuda você a orientar com dados reais. Acesse prof.oliecare.cloud"
- Posicione a consultora como parceira: ao recomendar o app às mães, ela recebe dados que enriquecem o atendimento.`,

      b2b_caregivers: `## Audiência: Cuidadores, Babás e Avós (B2B)
- Tom prático, inclusivo e respeitoso. Reconheça a importância do cuidador na vida do bebê.
- Foque em rotina, comunicação com os pais, transição entre cuidadores, segurança.
- Mostre como o app facilita a comunicação: registrar o que aconteceu durante o dia para os pais acompanharem.
- CTA final: "Use o OlieCare para registrar a rotina do bebê e manter toda a família informada. Comece grátis em oliecare.cloud"
- Valorize o papel do cuidador como membro essencial da equipe de cuidados.`,
    };

    // Etapas de qualidade (graciosas): pesquisa com fontes + candidatos a link interno
    const [research, internalLinks] = await Promise.all([
      researchTopic(topic),
      getInternalLinkCandidates(),
    ]);

    const systemPrompt = `Você é um redator sênior da OlieCare, especializado em conteúdo de saúde infantil para múltiplos públicos.

${audienceInstructions[audience]}

## Regras Gerais
- Escreva em português brasileiro
- Baseie-se em evidências científicas e boas práticas pediátricas
- Estruture com headings semânticos (H2, H3) para SEO
- Otimize para SEO: keyword principal nos primeiros 100 caracteres
- Entre 1500 e 3000 palavras
- Inclua seção FAQ no final (3-5 perguntas relevantes para a audiência)
- Introdução direta que responda a intenção de busca (position zero)
- Mencione o OlieCare de forma natural e contextualizada (não forçada)
- LINKS INTERNOS: quando fizer sentido, insira 2-3 links internos para outros posts do blog usando o caminho relativo /blog/{slug} (somente os fornecidos na lista de posts existentes).
- FONTES: baseie afirmações nas evidências de pesquisa fornecidas; quando houver fontes, cite-as ao longo do texto de forma natural.

⚠️ NUNCA faça diagnóstico médico nem prescreva medicamentos.
⚠️ SEMPRE recomende consultar profissional de saúde quando apropriado.

Responda em JSON:
{
  "title": "...",
  "content": "... (markdown completo)",
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

    const audienceLabel: Record<ContentAudience, string> = {
      b2c_parents: 'Pais e Famílias',
      b2b_pediatricians: 'Pediatras',
      b2b_lactation: 'Consultoras de Amamentação',
      b2b_caregivers: 'Cuidadores e Babás',
    };

    const researchBlock = research?.summary
      ? `\n\nEvidências da pesquisa (use como base factual):\n${research.summary}\n\nFontes disponíveis:\n${research.sources.map(s => `- ${s.title} (${s.publisher || ''}): ${s.url}`).join('\n')}`
      : '';

    const internalLinksBlock = internalLinks.length
      ? `\n\nPosts existentes para possíveis links internos (use /blog/{slug}):\n${internalLinks.map(p => `- ${p.title} -> /blog/${p.slug}`).join('\n')}`
      : '';

    const userPrompt = `Escreva um artigo completo para a audiência "${audienceLabel[audience]}":

Título: ${topic.title}
${topic.angle ? `Ângulo: ${topic.angle}` : ''}
${keywordsHint}${researchBlock}${internalLinksBlock}

Estruture com:
1. Introdução impactante (responda a pergunta principal nos primeiros 2 parágrafos)
2. 3-5 seções H2 com conteúdo aprofundado
3. Dicas práticas em bullet points
4. Como o OlieCare ajuda neste contexto (integrado naturalmente ao conteúdo)
5. Seção FAQ com perguntas e respostas relevantes para ${audienceLabel[audience]}
6. Conclusão com call-to-action específico para a audiência`;

    try {
      const raw = await callLLM(systemPrompt, userPrompt, 0.7);
      const generated = JSON.parse(raw) as GeneratedContent;
      const sources = research?.sources || [];

      // Auto-revisão editorial (segurança médica + fact-check + legibilidade)
      const review = await reviewContent({
        title: generated.title,
        content: generated.content,
        audience,
        sources,
      });
      if (review.revisedContent) {
        generated.content = review.revisedContent;
      }

      // Anexa seção de Referências se houver fontes e ainda não estiver presente
      if (sources.length && !/##\s*Referências/i.test(generated.content)) {
        generated.content += buildReferencesSection(sources);
      }

      generated.sources = sources;
      generated.qualityScore = review.qualityScore;
      generated.reviewSummary = review.reviewSummary;

      logger.info('Blog content generated', {
        title: generated.title,
        audience,
        sources: sources.length,
        qualityScore: review.qualityScore,
        safe: review.safe,
      });

      return generated;
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
      const raw = await callLLM(systemPrompt, userPrompt, 0.3);
      const parsed = JSON.parse(raw) as SEOOptimization;
      parsed.readingTimeMin = readingTimeMin;
      return parsed;
    } catch (error) {
      logger.error('Failed to optimize SEO', { error });
      throw error;
    }
  }
}

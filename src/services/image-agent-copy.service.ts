import { env } from '../config/env';
import { logger } from '../config/logger';
import { AppError } from '../utils/errors/AppError';
import {
  IMAGE_AGENT_TEMPLATES,
  type ImageAgentFormat,
  type ImageAgentTemplateId,
} from '../constants/image-agent';

export interface ImageAgentCopyResult {
  titulo: string;
  cta: string;
  /** Legenda para o editor de blog/redes — não aparece no PNG exportado */
  legenda: string;
  hashtags: string[];
}

export class ImageAgentCopyService {
  static async generate(options: {
    topico: string;
    format: ImageAgentFormat;
    templateId: ImageAgentTemplateId;
  }): Promise<ImageAgentCopyResult> {
    if (!env.OPENAI_API_KEY) {
      throw AppError.badRequest('OPENAI_API_KEY não configurada no servidor');
    }

    const template = IMAGE_AGENT_TEMPLATES.find(t => t.id === options.templateId) ?? IMAGE_AGENT_TEMPLATES[0];
    const channel = options.format === 'instagram' ? 'Instagram' : 'blog OlieCare';

    const system = `Você é copywriter da OlieCare (oliecare.cloud) — marca acolhedora de cuidados com bebês no Brasil.
Responda APENAS com JSON válido, sem markdown:
{"titulo":"...","cta":"...","legenda":"...","hashtags":["#tag1","#tag2"]}

Regras para a IMAGEM exportada (só título + CTA aparecem no PNG):
- titulo: frase principal curta e humana (máx 70 caracteres), tom conversacional, sem jargão médico
- cta: call-to-action de 2-5 palavras (ex: "Saiba mais", "Acesse grátis", "Conheça o OlieCare")

Regras para legenda (uso no editor, NÃO vai na imagem):
- legenda: 2-3 frases acolhedoras para caption do post (máx 280 caracteres)
- hashtags: 4 a 6 tags incluindo #oliecare

Tom: empático, próximo, como uma amiga que entende de maternidade. Evite tom corporativo ou excesso de informação.`;

    const user = `Crie conteúdo para ${channel}.
Tópico: ${options.topico}
Template visual: ${template.label} — ${template.description}
O título e CTA devem combinar com esse estilo e a identidade OlieCare (verde-oliva, acolhedor).`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: env.OPENAI_MODEL || 'gpt-4o',
        temperature: 0.75,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
      }),
      signal: AbortSignal.timeout(60000),
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      logger.error('OpenAI copy error', { status: response.status, errText: errText.slice(0, 300) });
      throw AppError.badRequest('Falha ao gerar texto com OpenAI');
    }

    const json = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const raw = json.choices?.[0]?.message?.content;
    if (!raw) throw AppError.badRequest('OpenAI não retornou conteúdo');

    let parsed: ImageAgentCopyResult;
    try {
      parsed = JSON.parse(raw) as ImageAgentCopyResult;
    } catch {
      throw AppError.badRequest('Resposta OpenAI inválida');
    }

    return {
      titulo: String(parsed.titulo || '').trim(),
      cta: String(parsed.cta || 'Conheça o OlieCare').trim(),
      legenda: String(parsed.legenda || '').trim(),
      hashtags: Array.isArray(parsed.hashtags)
        ? parsed.hashtags.map(h => String(h).trim()).filter(Boolean).slice(0, 8)
        : ['#oliecare', '#maternidade'],
    };
  }
}

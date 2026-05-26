import { env } from '../config/env';
import { logger } from '../config/logger';
import { AppError } from '../utils/errors/AppError';
import {
  IMAGE_AGENT_TEMPLATES,
  type ImageAgentFormat,
  type ImageAgentTemplateId,
} from '../constants/image-agent';

export interface ImageAgentCopyResult {
  destaque: string;
  titulo: string;
  corpo: string;
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

    const system = `Você é copywriter sênior da marca OlieCare (cuidados com bebês, maternidade, saúde infantil).
Responda APENAS com JSON válido, sem markdown, no formato:
{"destaque":"...","titulo":"...","corpo":"...","hashtags":["#tag1","#tag2"]}
Regras:
- Português do Brasil, tom acolhedor e baseado em evidências
- destaque: frase curta de impacto (máx 80 caracteres)
- titulo: título principal (máx 120 caracteres)
- corpo: 2-4 frases para o post (máx 400 caracteres)
- hashtags: 4 a 6 tags relevantes incluindo #oliecare
- Não invente dados médicos específicos nem estatísticas falsas`;

    const user = `Crie conteúdo para um post de ${channel}.
Tópico: ${options.topico}
Estilo visual do template: ${template.label} — ${template.description}
O texto deve combinar com esse estilo visual.`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: env.OPENAI_MODEL || 'gpt-4o',
        temperature: 0.7,
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
      destaque: String(parsed.destaque || '').trim(),
      titulo: String(parsed.titulo || '').trim(),
      corpo: String(parsed.corpo || '').trim(),
      hashtags: Array.isArray(parsed.hashtags)
        ? parsed.hashtags.map(h => String(h).trim()).filter(Boolean).slice(0, 8)
        : ['#oliecare', '#maternidade'],
    };
  }
}

export type ImageAgentFormat = 'blog' | 'instagram';

export type ImageAgentTemplateId =
  | 'essencial'
  | 'jardim'
  | 'impulso'
  | 'afeto';

export interface ImageAgentTemplate {
  id: ImageAgentTemplateId;
  label: string;
  description: string;
  stylePrompt: string;
}

export const IMAGE_AGENT_FORMATS: Record<
  ImageAgentFormat,
  { width: number; height: number; label: string; openAiSize: '1024x1024' | '1536x1024' }
> = {
  blog: {
    width: 1200,
    height: 630,
    label: 'Blog (capa)',
    openAiSize: '1536x1024',
  },
  instagram: {
    width: 1080,
    height: 1080,
    label: 'Instagram (feed)',
    openAiSize: '1024x1024',
  },
};

/** Identidade visual OlieCare — alinhada ao site oliecare.cloud */
export const OLIECARE_BRAND = {
  primary: '#738251',
  cream: '#f9f6f1',
  sand: '#f3ede4',
  mood:
    'acolhedor, humano, autêntico, baseado em evidências, sem clichês de banco de imagens',
};

export const IMAGE_AGENT_TEMPLATES: ImageAgentTemplate[] = [
  {
    id: 'essencial',
    label: 'Essencial',
    description: 'Clean editorial, confiança',
    stylePrompt:
      'Template Essencial: interior residencial brasileiro claro, paredes creme linho (#f9f6f1), madeira clara, roupa em tons neutros e verde-oliva. Luz de janela lateral (north light), 85mm f/1.8, espaço negativo generoso à esquerda. Clima de calma profissional, como editorial de lifestyle premium.',
  },
  {
    id: 'jardim',
    label: 'Jardim',
    description: 'Natureza e organicidade',
    stylePrompt:
      'Template Jardim: varanda, quintal ou canto com plantas reais (folha de oliveira, costela-de-adão, luz filtrada). Paleta verde-oliva (#738251) e areia quente. Golden hour suave, tons Portra 400, atmosfera orgânica e materna sem floreio de stock.',
  },
  {
    id: 'impulso',
    label: 'Impulso',
    description: 'Contraste profissional',
    stylePrompt:
      'Template Impulso: consultório acolhedor ou home office sofisticado, fundo mais escuro (carvão/oliva profundo), um feixe de luz suave no rosto. Visual de marca B2B premium, confiança e modernidade, sem neon e sem tech cínico. Área esquerda mais escura e limpa para texto.',
  },
  {
    id: 'afeto',
    label: 'Afeto',
    description: 'Vínculo íntimo',
    stylePrompt:
      'Template Afeto: quarto aconchegante, luz íntima quente (abajur ou fim de tarde), tons sage e blush discreto. Colo, pele com pele responsável, olhar baixo entre cuidador e bebê. Silêncio emocional, sem pose de campanha publicitária.',
  },
];

const BASE_IMAGE_RULES =
  'PHOTOGRAPH of REAL PEOPLE — photorealistic documentary-editorial photography for OlieCare (oliecare.cloud), a Brazilian baby-care brand. ' +
  'Shot as if by a professional lifestyle photographer on a full-frame camera (85mm or 35mm, natural window light, shallow depth of field, tack-sharp eyes). ' +
  'Subjects: real Brazilian families and caregivers with diverse skin tones, natural hair, visible skin texture, pores, fine lines, baby with realistic proportions. ' +
  'Candid moment in progress (not looking at camera, not smiling on command). Hands anatomically correct, five fingers, natural baby hold. ' +
  'Wardrobe and set: linen, cotton, wood, ceramic, plants — cream #f9f6f1, olive #738251, warm sand. No logos on clothes. ' +
  'Grade like Kodak Portra / Magnum: muted, warm, true-to-life, never plastic, never oversaturated. ' +
  'This photo is ONLY the photographic background; title and CTA are overlaid later. Keep ~40% of the frame quieter/out of focus for text. ' +
  'If the topic mentions apps or data, keep people as the hero; a phone may appear in the periphery, never a dashboard, UI, chart, or glowing screen as the subject. ' +
  'NO text, letters, numbers, watermarks, logos, UI, or captions in the image. ' +
  'NO CGI, 3D, illustration, anime, beauty-filter skin, stock-photo pose, extra limbs, uncanny baby, NICU cliché.';

/** Negative prompt compartilhado (Pollinations e referência para providers). */
export const IMAGE_NEGATIVE_PROMPT =
  'text, letters, words, numbers, typography, writing, captions, watermark, logo, signature, ' +
  'label, title, subtitle, heading, font, alphabet, UI, interface, screenshot, dashboard, chart, ' +
  'stock photo pose, plastic skin, beauty filter, oversaturated, CGI, 3d render, illustration, ' +
  'deformed hands, extra fingers, uncanny baby, hospital cliché, NICU, forced smile to camera, ' +
  'cartoon, anime, collage, mannequin, wax figure';

type SceneCue = { pattern: RegExp; direction: string };

const SCENE_CUES: SceneCue[] = [
  {
    pattern: /amament|lacta|peito|mamad|aleitamento/i,
    direction:
      'Direção visual: momento íntimo de amamentação ou vínculo lactante–bebê, luz suave, sem exposição explícita.',
  },
  {
    pattern: /sono|dorm|nana|ber[cç]o|noite|rotina noturna/i,
    direction:
      'Direção visual: ritual de sono calmo — berço, luz baixa, mão acolhedora, atmosfera serena.',
  },
  {
    pattern: /pediatr|consult[oó]rio|m[eé]dic|vacin|sa[uú]de/i,
    direction:
      'Direção visual: cuidado profissional acolhedor — confiança e calma, sem equipamento hospitalar agressivo.',
  },
  {
    pattern: /banho|higiene|frald|troca|cuidad/i,
    direction:
      'Direção visual: rotina cotidiana de cuidados — gestos práticos e afetivos em ambiente doméstico.',
  },
  {
    pattern: /v[ií]nculo|carinh|abra[cç]|colo|afeto|pai|m[aã]e|fam[ií]lia/i,
    direction:
      'Direção visual: vínculo familiar — colo, olhar, toque gentil entre cuidador e bebê.',
  },
  {
    pattern: /alimenta|papinha|introdu[cç][aã]o|refei[cç]/i,
    direction:
      'Direção visual: alimentação infantil em casa — utensílios simples, clima leve e cotidiano.',
  },
  {
    pattern: /desenvolvimento|marco|engatinh|primeiro passo|brinc/i,
    direction:
      'Direção visual: marco de desenvolvimento — exploração segura, brincadeira e descoberta.',
  },
  {
    pattern: /dado|aplicativo|app|tecnolog|digital|plataforma|prontu[aá]rio|teleconsult/i,
    direction:
      'Direção visual: cuidado humano em primeiro plano; se houver celular, ele é periférico e desligado de UI. Nunca tela, gráfico ou dashboard como assunto.',
  },
];

function resolveSceneDirection(topic: string, excerpt?: string, headings?: string[]): string {
  const haystack = [topic, excerpt || '', ...(headings || [])].join(' ');
  for (const cue of SCENE_CUES) {
    if (cue.pattern.test(haystack)) return cue.direction;
  }
  return 'Direção visual: momento cotidiano autêntico de cuidado infantil no Brasil, emoção genuína sem literalidade forçada.';
}

export function buildImageAgentPrompt(options: {
  topic: string;
  excerpt?: string;
  templateId: ImageAgentTemplateId;
  format: ImageAgentFormat;
  customPrompt?: string;
  /** Subtítulos (H2) do artigo, usados para tornar a imagem mais fiel ao conteúdo. */
  headings?: string[];
}): string {
  const template = IMAGE_AGENT_TEMPLATES.find(t => t.id === options.templateId) ?? IMAGE_AGENT_TEMPLATES[0];
  const format = IMAGE_AGENT_FORMATS[options.format];

  const aspect =
    options.format === 'blog'
      ? 'Composição widescreen 16:9 para capa de blog: sujeito principal à direita ou centro-direita, margem limpa/desfocada à esquerda (~40%) para overlay de texto.'
      : 'Composição quadrada 1:1 para Instagram: sujeito no terço superior/centro, área inferior (~35%) mais limpa/desfocada para overlay de texto.';

  const topicClean = options.topic.trim().substring(0, 200);
  const excerptHint = options.excerpt?.trim()
    ? `Contexto do conteúdo: "${options.excerpt.trim().substring(0, 400)}".`
    : '';

  const headingsHint = options.headings?.length
    ? `O artigo aborda: ${options.headings
        .slice(0, 8)
        .map(h => h.trim())
        .filter(Boolean)
        .join('; ')
        .substring(0, 360)}. Reflita esse contexto na cena sem ilustrar texto.`
    : '';

  const sceneDirection = resolveSceneDirection(topicClean, options.excerpt, options.headings);
  const customHint = options.customPrompt?.trim()
    ? `Direção adicional do editor: ${options.customPrompt.trim().substring(0, 500)}.`
    : '';

  return [
    BASE_IMAGE_RULES,
    `Estilo visual: ${template.stylePrompt}.`,
    `Inspire-se no tema "${topicClean}" — traduza em emoção e momento cotidiano, não em literalidade.`,
    sceneDirection,
    excerptHint,
    headingsHint,
    customHint,
    aspect,
    `Resolução alvo ${format.width}x${format.height}.`,
    `Evite: ${IMAGE_NEGATIVE_PROMPT}.`,
  ]
    .filter(Boolean)
    .join(' ');
}

/** Extrai os títulos de seção (H2/H3) de um conteúdo Markdown. */
export function extractMarkdownHeadings(content: string, max = 8): string[] {
  const matches = content.match(/^#{2,3}\s+(.+)$/gm) || [];
  return matches
    .map(h => h.replace(/^#{2,3}\s+/, '').replace(/[#*_`]/g, '').trim())
    .filter(h => h.length > 0 && !/^refer[êe]ncias$/i.test(h) && !/^faq$/i.test(h) && !/^perguntas/i.test(h))
    .slice(0, max);
}

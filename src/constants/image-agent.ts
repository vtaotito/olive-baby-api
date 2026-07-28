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
    description: 'Clean com barra lateral',
    stylePrompt:
      'Essencial OlieCare: fundo claro creme (#f9f6f1), luz natural suave, composição editorial limpa com espaço negativo generoso para overlay de texto à esquerda, sensação de calma e confiança',
  },
  {
    id: 'jardim',
    label: 'Jardim',
    description: 'Folhas e natureza',
    stylePrompt:
      'Jardim OlieCare: paleta verde-oliva (#738251) e areia quente, luz dourada de fim de tarde, elementos botânicos suaves desfocados, atmosfera orgânica e materna',
  },
  {
    id: 'impulso',
    label: 'Impulso',
    description: 'Bold escuro',
    stylePrompt:
      'Impulso OlieCare: contraste elegante, fundo escuro com destaque em verde-oliva, luz dramática suave, energia confiante e moderna, espaço para texto em área escura',
  },
  {
    id: 'afeto',
    label: 'Afeto',
    description: 'Suave com lua',
    stylePrompt:
      'Afeto OlieCare: tons sage e blush, luz íntima e aconchegante, momento terno entre cuidador e bebê, sensação noturna serena e emocional',
  },
];

const BASE_IMAGE_RULES =
  'Fotografia editorial autêntica para a marca OlieCare (oliecare.cloud), plataforma de cuidados com bebês no Brasil. ' +
  'Cena REAL e humanizada: família brasileira diversa, gestos naturais, expressões genuínas, pele real, imperfeições naturais. ' +
  'Evite poses de stock photo, evite look artificial ou plástico. ' +
  'Paleta: verde-oliva (#738251), creme (#f9f6f1) e areia quente. ' +
  'Temas: maternidade, paternidade, amamentação, sono do bebê, primeiros cuidados, vínculo afetivo. ' +
  'Iluminação natural difusa, profundidade de campo rasa, tom acolhedor e esperançoso. ' +
  'Esta imagem é APENAS o fundo fotográfico — o título e CTA serão sobrepostos depois pelo template. ' +
  'Deixe cerca de 40% da composição com área mais limpa/desfocada para overlay de texto. ' +
  'PROIBIDO: qualquer texto, letras, números, tipografia, watermark, logo, legenda ou UI na imagem. ' +
  'PROIBIDO: mãos deformadas, dedos extras, bebê irrealista, proporções estranhas, hospital clichê, neonato em UTI sem contexto, stock pose olhando para câmera forçada. ' +
  'Somente fotografia pura, alta qualidade.';

/** Negative prompt compartilhado (Pollinations e referência para providers). */
export const IMAGE_NEGATIVE_PROMPT =
  'text, letters, words, numbers, typography, writing, captions, watermark, logo, signature, ' +
  'label, title, subtitle, heading, font, alphabet, UI, interface, stock photo pose, plastic skin, ' +
  'oversaturated, CGI, 3d render, deformed hands, extra fingers, uncanny baby, hospital cliché, ' +
  'forced smile to camera, cartoon, anime, collage';

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

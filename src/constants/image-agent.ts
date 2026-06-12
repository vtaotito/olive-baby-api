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
  'Deixe 40% da composição com área mais limpa/desfocada para overlay de texto. ' +
  'PROIBIDO: qualquer texto, letras, números, tipografia, watermark, logo, legenda ou UI na imagem. ' +
  'Somente fotografia pura, alta qualidade.';

export function buildImageAgentPrompt(options: {
  topic: string;
  excerpt?: string;
  templateId: ImageAgentTemplateId;
  format: ImageAgentFormat;
  customPrompt?: string;
}): string {
  if (options.customPrompt?.trim()) {
    return `${options.customPrompt.trim()}. ${BASE_IMAGE_RULES}`;
  }

  const template = IMAGE_AGENT_TEMPLATES.find(t => t.id === options.templateId) ?? IMAGE_AGENT_TEMPLATES[0];
  const format = IMAGE_AGENT_FORMATS[options.format];

  const aspect =
    options.format === 'blog'
      ? 'Composição widescreen 16:9 para capa de blog, sujeito principal à direita ou centralizado com margem para texto à esquerda.'
      : 'Composição quadrada 1:1 para Instagram, sujeito no terço superior, área inferior reservada para overlay de texto.';

  const topicClean = options.topic.trim().substring(0, 120);

  return [
    BASE_IMAGE_RULES,
    `Estilo visual: ${template.stylePrompt}.`,
    `Inspire-se no tema "${topicClean}" — traduza em emoção e momento cotidiano, não em literalidade.`,
    aspect,
    `Resolução alvo ${format.width}x${format.height}.`,
  ].join(' ');
}

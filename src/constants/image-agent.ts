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
  /** Modificador de estilo visual para o prompt de imagem OpenAI */
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

export const IMAGE_AGENT_TEMPLATES: ImageAgentTemplate[] = [
  {
    id: 'essencial',
    label: 'Essencial',
    description: 'Clean com barra lateral',
    stylePrompt:
      'Minimal clean layout mood, white and soft cream background, subtle olive green accents, editorial magazine cover aesthetic, airy negative space, gentle heart motif feeling without drawing symbols',
  },
  {
    id: 'jardim',
    label: 'Jardim',
    description: 'Folhas e natureza',
    stylePrompt:
      'Organic nature-inspired mood, warm sand and leaf green palette, soft botanical atmosphere, natural light, tender parenting scene among subtle garden elements',
  },
  {
    id: 'impulso',
    label: 'Impulso',
    description: 'Bold escuro',
    stylePrompt:
      'Bold high-contrast mood, deep charcoal background with olive green highlights, dramatic soft spotlight, confident energetic composition, modern editorial look',
  },
  {
    id: 'afeto',
    label: 'Afeto',
    description: 'Suave com lua',
    stylePrompt:
      'Soft emotional mood, muted sage and blush tones, cozy nighttime warmth, intimate tender parent and baby moment, calm moonlit ambiance without text',
  },
];

const BASE_IMAGE_RULES =
  'Photorealistic illustration for OlieCare baby care brand. ' +
  'Warm pastel palette with soft olive green (#738251) and cream tones. ' +
  'Cozy tender scene about baby care, parenting, breastfeeding, infant sleep, or early childhood. ' +
  'Soft natural lighting, shallow depth of field, editorial photography style. ' +
  'STRICTLY NO TEXT, NO LETTERS, NO WORDS, NO NUMBERS, NO TYPOGRAPHY, NO WATERMARKS, NO LOGOS, NO CAPTIONS. ' +
  'Pure visual only, high quality.';

export function buildImageAgentPrompt(options: {
  topic: string;
  excerpt?: string;
  templateId: ImageAgentTemplateId;
  format: ImageAgentFormat;
  customPrompt?: string;
}): string {
  if (options.customPrompt?.trim()) {
    return `${options.customPrompt.trim()} ${BASE_IMAGE_RULES}`;
  }

  const template = IMAGE_AGENT_TEMPLATES.find(t => t.id === options.templateId) ?? IMAGE_AGENT_TEMPLATES[0];
  const format = IMAGE_AGENT_FORMATS[options.format];
  const topicHint = options.excerpt
    ? ` Scene theme: ${options.excerpt.substring(0, 160)}.`
    : ` Topic: "${options.topic}".`;

  const aspect =
    options.format === 'blog'
      ? 'Wide 16:9 cinematic composition for blog cover.'
      : 'Square 1:1 composition for Instagram feed.';

  return (
    `${BASE_IMAGE_RULES} ${template.stylePrompt}.${topicHint} ${aspect} ` +
    `Target dimensions ${format.width}x${format.height}.`
  );
}

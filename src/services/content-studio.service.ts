import { logger } from '../config/logger';
import { AppError } from '../utils/errors/AppError';
import { AIContentService } from './ai-content.service';
import { AISocialContentService } from './ai-social-content.service';
import { BlogService } from './blog.service';
import { SocialService } from './social.service';
import { ImageAgentImageService } from './image-agent-image.service';
import type { ImageAgentTemplateId } from '../constants/image-agent';

export type ContentAudience =
  | 'b2c_parents'
  | 'b2b_pediatricians'
  | 'b2b_lactation'
  | 'b2b_caregivers';

export type ContentChannel = 'blog' | 'social';

export type RegeneratePart =
  | 'content'
  | 'seo'
  | 'cover'
  | 'caption'
  | 'social_image'
  | 'inline';

const AUDIENCE_DEFAULT_TEMPLATE: Record<ContentAudience, ImageAgentTemplateId> = {
  b2c_parents: 'jardim',
  b2b_pediatricians: 'impulso',
  b2b_lactation: 'afeto',
  b2b_caregivers: 'essencial',
};

export interface ContentGenerateInput {
  brief: string;
  angle?: string;
  audience: ContentAudience;
  channels: ContentChannel[];
  targetKeywords?: string[];
  templateId?: ImageAgentTemplateId;
  accountIds?: number[];
  generateInlineImages?: boolean;
  authorId?: number;
}

export interface ContentGenerateResult {
  blogPostId?: number;
  socialPostId?: number;
  qualityScore?: number;
  sources?: unknown;
  blog?: { id: number; title: string; slug: string; excerpt?: string | null; coverImageUrl?: string | null; status: string };
  social?: { id: number; caption: string; mediaUrls: string[]; status: string; audience?: string | null };
  errors: Array<{ channel: ContentChannel; stage: string; message: string }>;
}

export class ContentStudioService {
  static resolveTemplate(
    audience: ContentAudience,
    templateId?: ImageAgentTemplateId
  ): ImageAgentTemplateId {
    return templateId || AUDIENCE_DEFAULT_TEMPLATE[audience] || 'essencial';
  }

  static async generate(input: ContentGenerateInput): Promise<ContentGenerateResult> {
    if (!input.brief?.trim()) {
      throw AppError.badRequest('Brief é obrigatório');
    }
    if (!input.channels?.length) {
      throw AppError.badRequest('Selecione ao menos um canal (blog ou social)');
    }

    const audience = input.audience || 'b2c_parents';
    const templateId = ContentStudioService.resolveTemplate(audience, input.templateId);
    const result: ContentGenerateResult = { errors: [] };

    if (input.channels.includes('blog')) {
      try {
        const blog = await ContentStudioService.generateBlog(input, audience, templateId);
        result.blogPostId = blog.id;
        result.blog = {
          id: blog.id,
          title: blog.title,
          slug: blog.slug,
          excerpt: blog.excerpt,
          coverImageUrl: blog.coverImageUrl,
          status: blog.status,
        };
        result.qualityScore = blog.qualityScore ?? undefined;
        result.sources = blog.sources ?? undefined;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger.error('Content Studio blog generation failed', { error: message });
        result.errors.push({ channel: 'blog', stage: 'generate', message });
      }
    }

    if (input.channels.includes('social')) {
      try {
        const social = await ContentStudioService.generateSocial(input, audience, templateId);
        result.socialPostId = social.id;
        result.social = {
          id: social.id,
          caption: social.caption,
          mediaUrls: social.mediaUrls,
          status: social.status,
          audience: social.audience,
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger.error('Content Studio social generation failed', { error: message });
        result.errors.push({ channel: 'social', stage: 'generate', message });
      }
    }

    if (!result.blogPostId && !result.socialPostId) {
      throw AppError.badRequest(
        `Falha ao gerar conteúdo: ${result.errors.map(e => e.message).join('; ') || 'erro desconhecido'}`
      );
    }

    return result;
  }

  private static async generateBlog(
    input: ContentGenerateInput,
    audience: ContentAudience,
    templateId: ImageAgentTemplateId
  ) {
    const generated = await AIContentService.generateContent({
      title: input.brief.trim(),
      angle: input.angle,
      targetKeywords: input.targetKeywords,
      audience,
    });

    let categoryId: number | undefined;
    if (generated.suggestedCategory) {
      categoryId = await BlogService.resolveOrCreateCategoryByName(generated.suggestedCategory);
    }

    let post = await BlogService.createPost({
      title: generated.title || input.brief.trim(),
      content: generated.content,
      excerpt: generated.excerpt,
      seoTitle: generated.seoTitle,
      seoDescription: generated.seoDescription,
      seoKeywords: generated.seoKeywords,
      tagNames: generated.suggestedTags,
      categoryId,
      aiGenerated: true,
      aiPromptUsed: `Content Studio | audience=${audience} | brief=${input.brief.trim().slice(0, 200)}`,
      audience,
      qualityScore: generated.qualityScore,
      sources: generated.sources,
      reviewSummary: generated.reviewSummary,
      authorId: input.authorId,
      status: 'IN_REVIEW',
    });

    try {
      const optimization = await AIContentService.optimizeSEO({
        id: post.id,
        title: post.title,
        content: post.content,
        excerpt: post.excerpt,
      });
      post = await BlogService.updatePost(post.id, {
        seoTitle: optimization.seoTitle,
        seoDescription: optimization.seoDescription,
        seoKeywords: optimization.seoKeywords,
        schemaMarkup: optimization.schemaMarkup,
        excerpt: optimization.excerpt || post.excerpt || undefined,
      });
    } catch (error) {
      logger.warn('Content Studio SEO step failed', {
        postId: post.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    try {
      const image = await ImageAgentImageService.generate({
        topic: post.title,
        excerpt: post.excerpt || undefined,
        format: 'blog',
        templateId,
        headings: post.content
          ? post.content.match(/^#{2,3}\s+(.+)$/gm)?.map(h => h.replace(/^#{2,3}\s+/, ''))?.slice(0, 5)
          : undefined,
      });
      post = await BlogService.updatePost(post.id, {
        coverImageUrl: image.imageUrl,
        ogImageUrl: image.imageUrl,
      });
    } catch (error) {
      logger.warn('Content Studio cover image failed', {
        postId: post.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    if (input.generateInlineImages) {
      try {
        const images = await ImageAgentImageService.generateInlineImages({
          topic: post.title,
          content: post.content,
          templateId,
          count: 2,
        });
        if (images.length) {
          const content = ImageAgentImageService.insertInlineImages(post.content, images);
          post = await BlogService.updatePost(post.id, { content });
        }
      } catch (error) {
        logger.warn('Content Studio inline images failed', {
          postId: post.id,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return post;
  }

  private static async generateSocial(
    input: ContentGenerateInput,
    audience: ContentAudience,
    templateId: ImageAgentTemplateId
  ) {
    const captionResult = await AISocialContentService.generateCaption({
      idea: [
        input.brief.trim(),
        input.angle ? `Ângulo: ${input.angle}` : '',
        input.targetKeywords?.length ? `Keywords: ${input.targetKeywords.join(', ')}` : '',
      ]
        .filter(Boolean)
        .join('\n'),
      audience,
      platforms: ['instagram'],
    });

    let post = await SocialService.createPost({
      caption: captionResult.caption,
      hashtags: captionResult.hashtags || [],
      audience,
      accountIds: input.accountIds,
      aiGenerated: true,
      aiPromptUsed: `Content Studio | audience=${audience} | brief=${input.brief.trim().slice(0, 200)}`,
      authorId: input.authorId,
      status: 'IN_REVIEW',
    });

    try {
      const image = await ImageAgentImageService.generate({
        topic: input.brief.trim().slice(0, 200),
        excerpt: captionResult.caption.slice(0, 400),
        format: 'instagram',
        templateId,
      });
      post = await SocialService.updatePost(post.id, { mediaUrls: [image.imageUrl] });
    } catch (error) {
      logger.warn('Content Studio social image failed', {
        postId: post.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    return post;
  }

  static async getQueue(limit = 30) {
    const take = Math.min(Math.max(limit, 1), 100);
    const [blogResult, socialResult] = await Promise.all([
      BlogService.listAllPosts({ status: 'IN_REVIEW', limit: take }),
      SocialService.listPosts({ status: 'IN_REVIEW', limit: take }),
    ]);

    const blogItems = blogResult.data.map(p => ({
      channel: 'blog' as const,
      id: p.id,
      title: p.title,
      excerpt: p.excerpt,
      coverImageUrl: p.coverImageUrl,
      status: p.status,
      audience: p.audience,
      qualityScore: p.qualityScore,
      aiGenerated: p.aiGenerated,
      updatedAt: p.updatedAt,
      editPath: `/admin/blog/${p.id}/edit`,
    }));

    const socialItems = socialResult.data.map(p => ({
      channel: 'social' as const,
      id: p.id,
      title: p.caption.slice(0, 80),
      excerpt: p.caption.slice(0, 160),
      coverImageUrl: p.mediaUrls?.[0] || null,
      status: p.status,
      audience: p.audience,
      qualityScore: null as number | null,
      aiGenerated: p.aiGenerated,
      updatedAt: p.updatedAt,
      editPath: `/admin/social/${p.id}/edit`,
    }));

    const items = [...blogItems, ...socialItems].sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );

    return { items: items.slice(0, take), total: items.length };
  }

  static async regenerate(input: {
    channel: ContentChannel;
    id: number;
    part: RegeneratePart;
    audience?: ContentAudience;
    templateId?: ImageAgentTemplateId;
  }) {
    if (input.channel === 'blog') {
      return ContentStudioService.regenerateBlog(input.id, input.part, input.audience, input.templateId);
    }
    return ContentStudioService.regenerateSocial(input.id, input.part, input.audience, input.templateId);
  }

  private static async regenerateBlog(
    id: number,
    part: RegeneratePart,
    audience?: ContentAudience,
    templateId?: ImageAgentTemplateId
  ) {
    const post = await BlogService.getPostById(id);
    const aud = (audience || post.audience || 'b2c_parents') as ContentAudience;
    const tmpl = ContentStudioService.resolveTemplate(aud, templateId);

    if (part === 'content') {
      const generated = await AIContentService.generateContent({
        title: post.title,
        audience: aud,
        targetKeywords: post.seoKeywords,
      });
      const updated = await BlogService.updatePost(id, {
        content: generated.content,
        excerpt: generated.excerpt,
        seoTitle: generated.seoTitle,
        seoDescription: generated.seoDescription,
        seoKeywords: generated.seoKeywords,
        tagNames: generated.suggestedTags,
        aiGenerated: true,
        audience: aud,
        qualityScore: generated.qualityScore,
        sources: generated.sources,
        reviewSummary: generated.reviewSummary,
      });
      return { channel: 'blog' as const, part, post: updated };
    }

    if (part === 'seo') {
      const optimization = await AIContentService.optimizeSEO({
        id: post.id,
        title: post.title,
        content: post.content,
        excerpt: post.excerpt,
      });
      const updated = await BlogService.updatePost(id, {
        seoTitle: optimization.seoTitle,
        seoDescription: optimization.seoDescription,
        seoKeywords: optimization.seoKeywords,
        schemaMarkup: optimization.schemaMarkup,
        excerpt: optimization.excerpt || post.excerpt || undefined,
      });
      return { channel: 'blog' as const, part, post: updated };
    }

    if (part === 'cover') {
      const image = await ImageAgentImageService.generate({
        topic: post.title,
        excerpt: post.excerpt || undefined,
        format: 'blog',
        templateId: tmpl,
      });
      const updated = await BlogService.updatePost(id, {
        coverImageUrl: image.imageUrl,
        ogImageUrl: image.imageUrl,
      });
      return { channel: 'blog' as const, part, post: updated, imageUrl: image.imageUrl };
    }

    if (part === 'inline') {
      const images = await ImageAgentImageService.generateInlineImages({
        topic: post.title,
        content: post.content,
        templateId: tmpl,
        count: 2,
      });
      const content = images.length
        ? ImageAgentImageService.insertInlineImages(post.content, images)
        : post.content;
      const updated = await BlogService.updatePost(id, { content });
      return { channel: 'blog' as const, part, post: updated, inserted: images.length };
    }

    throw AppError.badRequest(`Parte "${part}" não suportada para blog`);
  }

  private static async regenerateSocial(
    id: number,
    part: RegeneratePart,
    audience?: ContentAudience,
    templateId?: ImageAgentTemplateId
  ) {
    const post = await SocialService.getPostById(id);
    const aud = (audience || post.audience || 'b2c_parents') as ContentAudience;
    const tmpl = ContentStudioService.resolveTemplate(aud, templateId);

    if (part === 'caption') {
      const captionResult = await AISocialContentService.generateCaption({
        idea: post.caption.slice(0, 500),
        audience: aud,
        platforms: ['instagram'],
      });
      const updated = await SocialService.updatePost(id, {
        caption: captionResult.caption,
        hashtags: captionResult.hashtags || [],
        audience: aud,
      });
      return { channel: 'social' as const, part, post: updated };
    }

    if (part === 'social_image') {
      const image = await ImageAgentImageService.generate({
        topic: post.caption.slice(0, 200),
        excerpt: post.caption.slice(0, 400),
        format: 'instagram',
        templateId: tmpl,
      });
      const updated = await SocialService.updatePost(id, { mediaUrls: [image.imageUrl] });
      return { channel: 'social' as const, part, post: updated, imageUrl: image.imageUrl };
    }

    throw AppError.badRequest(`Parte "${part}" não suportada para social`);
  }

  /** Cria um draft social a partir de um post de blog (hand-off). */
  static async createSocialFromBlog(input: {
    blogPostId: number;
    accountIds?: number[];
    authorId?: number;
  }) {
    const blog = await BlogService.getPostById(input.blogPostId);
    const audience = (blog.audience || 'b2c_parents') as ContentAudience;
    const templateId = ContentStudioService.resolveTemplate(audience);

    const captionResult = await AISocialContentService.generateCaption({
      idea: `Artigo do blog: ${blog.title}\n\n${blog.excerpt || blog.content.slice(0, 500)}`,
      audience,
      platforms: ['instagram'],
    });

    let post = await SocialService.createPost({
      caption: captionResult.caption,
      hashtags: captionResult.hashtags || [],
      audience,
      accountIds: input.accountIds,
      aiGenerated: true,
      aiPromptUsed: `From blog #${blog.id}: ${blog.title}`,
      authorId: input.authorId,
      status: 'IN_REVIEW',
      mediaUrls: blog.coverImageUrl ? [blog.coverImageUrl] : [],
    });

    try {
      const image = await ImageAgentImageService.generate({
        topic: blog.title,
        excerpt: blog.excerpt || captionResult.caption.slice(0, 400),
        format: 'instagram',
        templateId,
      });
      post = await SocialService.updatePost(post.id, { mediaUrls: [image.imageUrl] });
    } catch (error) {
      logger.warn('createSocialFromBlog image failed', {
        blogPostId: blog.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    return post;
  }
}

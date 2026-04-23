import { BlogPostStatus, Prisma } from '@prisma/client';
import { prisma } from '../config/database';
import { AppError } from '../utils/errors/AppError';
import { logger } from '../config/logger';

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 200);
}

function calculateReadingTime(content: string): number {
  const wordsPerMinute = 200;
  const words = content.trim().split(/\s+/).length;
  return Math.max(1, Math.ceil(words / wordsPerMinute));
}

export class BlogService {
  // ==========================================
  // Categories
  // ==========================================

  static async listCategories() {
    return prisma.blogCategory.findMany({
      orderBy: { name: 'asc' },
      include: { _count: { select: { posts: true } } },
    });
  }

  static async createCategory(data: { name: string; description?: string }) {
    const slug = slugify(data.name);
    const existing = await prisma.blogCategory.findUnique({ where: { slug } });
    if (existing) throw AppError.conflict('Categoria já existe com esse nome');

    return prisma.blogCategory.create({
      data: { name: data.name, slug, description: data.description },
    });
  }

  static async updateCategory(id: number, data: { name?: string; description?: string }) {
    const category = await prisma.blogCategory.findUnique({ where: { id } });
    if (!category) throw AppError.notFound('Categoria não encontrada');

    const updateData: Prisma.BlogCategoryUpdateInput = {};
    if (data.name) {
      updateData.name = data.name;
      updateData.slug = slugify(data.name);
    }
    if (data.description !== undefined) updateData.description = data.description;

    return prisma.blogCategory.update({ where: { id }, data: updateData });
  }

  static async deleteCategory(id: number) {
    const category = await prisma.blogCategory.findUnique({ where: { id } });
    if (!category) throw AppError.notFound('Categoria não encontrada');
    return prisma.blogCategory.delete({ where: { id } });
  }

  // ==========================================
  // Tags
  // ==========================================

  static async listTags() {
    return prisma.blogTag.findMany({
      orderBy: { name: 'asc' },
      include: { _count: { select: { posts: true } } },
    });
  }

  static async createTag(data: { name: string }) {
    const slug = slugify(data.name);
    const existing = await prisma.blogTag.findUnique({ where: { slug } });
    if (existing) return existing;

    return prisma.blogTag.create({ data: { name: data.name, slug } });
  }

  static async deleteTag(id: number) {
    const tag = await prisma.blogTag.findUnique({ where: { id } });
    if (!tag) throw AppError.notFound('Tag não encontrada');
    return prisma.blogTag.delete({ where: { id } });
  }

  // ==========================================
  // Posts - Public
  // ==========================================

  static async listPublishedPosts(options: {
    page?: number;
    limit?: number;
    categorySlug?: string;
    tagSlug?: string;
    q?: string;
  }) {
    const page = options.page || 1;
    const limit = Math.min(options.limit || 12, 50);
    const skip = (page - 1) * limit;

    const where: Prisma.BlogPostWhereInput = {
      status: 'PUBLISHED',
      publishedAt: { not: null },
    };

    if (options.categorySlug) {
      where.category = { slug: options.categorySlug };
    }
    if (options.tagSlug) {
      where.tags = { some: { tag: { slug: options.tagSlug } } };
    }
    if (options.q) {
      where.OR = [
        { title: { contains: options.q, mode: 'insensitive' } },
        { excerpt: { contains: options.q, mode: 'insensitive' } },
      ];
    }

    const [posts, total] = await Promise.all([
      prisma.blogPost.findMany({
        where,
        skip,
        take: limit,
        orderBy: { publishedAt: 'desc' },
        select: {
          id: true,
          title: true,
          slug: true,
          excerpt: true,
          coverImageUrl: true,
          publishedAt: true,
          readingTimeMin: true,
          seoTitle: true,
          seoDescription: true,
          category: { select: { id: true, name: true, slug: true } },
          tags: { include: { tag: { select: { id: true, name: true, slug: true } } } },
          author: { select: { id: true, email: true, caregiver: { select: { fullName: true } } } },
        },
      }),
      prisma.blogPost.count({ where }),
    ]);

    return {
      data: posts.map(p => ({
        ...p,
        tags: p.tags.map(t => t.tag),
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  static async getPublishedPostBySlug(slug: string) {
    const post = await prisma.blogPost.findFirst({
      where: { slug, status: 'PUBLISHED' },
      include: {
        category: { select: { id: true, name: true, slug: true } },
        tags: { include: { tag: { select: { id: true, name: true, slug: true } } } },
        author: { select: { id: true, email: true, caregiver: { select: { fullName: true } } } },
      },
    });

    if (!post) throw AppError.notFound('Post não encontrado');

    return {
      ...post,
      tags: post.tags.map(t => t.tag),
    };
  }

  // ==========================================
  // Posts - Admin
  // ==========================================

  static async listAllPosts(options: {
    page?: number;
    limit?: number;
    status?: BlogPostStatus;
    categoryId?: number;
    q?: string;
  }) {
    const page = options.page || 1;
    const limit = Math.min(options.limit || 20, 100);
    const skip = (page - 1) * limit;

    const where: Prisma.BlogPostWhereInput = {};
    if (options.status) where.status = options.status;
    if (options.categoryId) where.categoryId = options.categoryId;
    if (options.q) {
      where.OR = [
        { title: { contains: options.q, mode: 'insensitive' } },
        { excerpt: { contains: options.q, mode: 'insensitive' } },
      ];
    }

    const [posts, total] = await Promise.all([
      prisma.blogPost.findMany({
        where,
        skip,
        take: limit,
        orderBy: { updatedAt: 'desc' },
        include: {
          category: { select: { id: true, name: true, slug: true } },
          tags: { include: { tag: { select: { id: true, name: true, slug: true } } } },
          author: { select: { id: true, email: true, caregiver: { select: { fullName: true } } } },
        },
      }),
      prisma.blogPost.count({ where }),
    ]);

    return {
      data: posts.map(p => ({
        ...p,
        tags: p.tags.map(t => t.tag),
      })),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  static async getPostById(id: number) {
    const post = await prisma.blogPost.findUnique({
      where: { id },
      include: {
        category: { select: { id: true, name: true, slug: true } },
        tags: { include: { tag: { select: { id: true, name: true, slug: true } } } },
        author: { select: { id: true, email: true, caregiver: { select: { fullName: true } } } },
      },
    });

    if (!post) throw AppError.notFound('Post não encontrado');

    return { ...post, tags: post.tags.map(t => t.tag) };
  }

  static async createPost(data: {
    title: string;
    content: string;
    excerpt?: string;
    coverImageUrl?: string;
    categoryId?: number;
    tagNames?: string[];
    seoTitle?: string;
    seoDescription?: string;
    seoKeywords?: string[];
    ogImageUrl?: string;
    schemaMarkup?: Record<string, unknown>;
    aiGenerated?: boolean;
    aiPromptUsed?: string;
    authorId?: number;
    status?: BlogPostStatus;
  }) {
    let slug = slugify(data.title);
    const existing = await prisma.blogPost.findUnique({ where: { slug } });
    if (existing) {
      slug = `${slug}-${Date.now().toString(36)}`;
    }

    const readingTimeMin = calculateReadingTime(data.content);

    const post = await prisma.blogPost.create({
      data: {
        title: data.title,
        slug,
        content: data.content,
        excerpt: data.excerpt,
        coverImageUrl: data.coverImageUrl,
        categoryId: data.categoryId,
        seoTitle: data.seoTitle,
        seoDescription: data.seoDescription,
        seoKeywords: data.seoKeywords || [],
        ogImageUrl: data.ogImageUrl,
        schemaMarkup: data.schemaMarkup as Prisma.InputJsonValue,
        readingTimeMin,
        aiGenerated: data.aiGenerated || false,
        aiPromptUsed: data.aiPromptUsed,
        authorId: data.authorId,
        status: data.status || 'DRAFT',
      },
    });

    if (data.tagNames && data.tagNames.length > 0) {
      await this.syncPostTags(post.id, data.tagNames);
    }

    return this.getPostById(post.id);
  }

  static async updatePost(id: number, data: {
    title?: string;
    content?: string;
    excerpt?: string;
    coverImageUrl?: string;
    categoryId?: number | null;
    tagNames?: string[];
    seoTitle?: string;
    seoDescription?: string;
    seoKeywords?: string[];
    ogImageUrl?: string;
    schemaMarkup?: Record<string, unknown>;
    status?: BlogPostStatus;
  }) {
    const post = await prisma.blogPost.findUnique({ where: { id } });
    if (!post) throw AppError.notFound('Post não encontrado');

    const updateData: Prisma.BlogPostUpdateInput = {};

    if (data.title !== undefined) {
      updateData.title = data.title;
      if (data.title !== post.title) {
        let newSlug = slugify(data.title);
        const existing = await prisma.blogPost.findFirst({ where: { slug: newSlug, id: { not: id } } });
        if (existing) newSlug = `${newSlug}-${Date.now().toString(36)}`;
        updateData.slug = newSlug;
      }
    }
    if (data.content !== undefined) {
      updateData.content = data.content;
      updateData.readingTimeMin = calculateReadingTime(data.content);
    }
    if (data.excerpt !== undefined) updateData.excerpt = data.excerpt;
    if (data.coverImageUrl !== undefined) updateData.coverImageUrl = data.coverImageUrl;
    if (data.categoryId !== undefined) {
      updateData.category = data.categoryId ? { connect: { id: data.categoryId } } : { disconnect: true };
    }
    if (data.seoTitle !== undefined) updateData.seoTitle = data.seoTitle;
    if (data.seoDescription !== undefined) updateData.seoDescription = data.seoDescription;
    if (data.seoKeywords !== undefined) updateData.seoKeywords = data.seoKeywords;
    if (data.ogImageUrl !== undefined) updateData.ogImageUrl = data.ogImageUrl;
    if (data.schemaMarkup !== undefined) updateData.schemaMarkup = data.schemaMarkup as Prisma.InputJsonValue;
    if (data.status !== undefined) updateData.status = data.status;

    await prisma.blogPost.update({ where: { id }, data: updateData });

    if (data.tagNames !== undefined) {
      await this.syncPostTags(id, data.tagNames);
    }

    return this.getPostById(id);
  }

  static async deletePost(id: number) {
    const post = await prisma.blogPost.findUnique({ where: { id } });
    if (!post) throw AppError.notFound('Post não encontrado');
    await prisma.blogPost.delete({ where: { id } });
  }

  static async reviewPost(id: number, data: { approved: boolean; reviewNotes?: string; reviewedBy: number }) {
    const post = await prisma.blogPost.findUnique({ where: { id } });
    if (!post) throw AppError.notFound('Post não encontrado');
    if (post.status !== 'IN_REVIEW' && post.status !== 'DRAFT') {
      throw AppError.badRequest('Post não está em revisão');
    }

    return prisma.blogPost.update({
      where: { id },
      data: {
        status: data.approved ? 'APPROVED' : 'DRAFT',
        reviewedBy: data.reviewedBy,
        reviewedAt: new Date(),
        reviewNotes: data.reviewNotes,
      },
    });
  }

  static async publishPost(id: number) {
    const post = await prisma.blogPost.findUnique({ where: { id } });
    if (!post) throw AppError.notFound('Post não encontrado');
    if (post.status !== 'APPROVED') {
      throw AppError.badRequest('Post precisa estar aprovado para publicar');
    }

    return prisma.blogPost.update({
      where: { id },
      data: { status: 'PUBLISHED', publishedAt: new Date() },
    });
  }

  static async archivePost(id: number) {
    const post = await prisma.blogPost.findUnique({ where: { id } });
    if (!post) throw AppError.notFound('Post não encontrado');

    return prisma.blogPost.update({
      where: { id },
      data: { status: 'ARCHIVED' },
    });
  }

  // ==========================================
  // Stats
  // ==========================================

  static async getStats() {
    const [total, byStatus, recentPosts] = await Promise.all([
      prisma.blogPost.count(),
      prisma.blogPost.groupBy({ by: ['status'], _count: true }),
      prisma.blogPost.findMany({
        where: { status: 'PUBLISHED' },
        orderBy: { publishedAt: 'desc' },
        take: 5,
        select: { id: true, title: true, slug: true, publishedAt: true },
      }),
    ]);

    const statusMap: Record<string, number> = {};
    byStatus.forEach(s => { statusMap[s.status] = s._count; });

    return {
      total,
      published: statusMap['PUBLISHED'] || 0,
      draft: statusMap['DRAFT'] || 0,
      inReview: statusMap['IN_REVIEW'] || 0,
      approved: statusMap['APPROVED'] || 0,
      archived: statusMap['ARCHIVED'] || 0,
      idea: statusMap['IDEA'] || 0,
      recentPosts,
    };
  }

  // ==========================================
  // Sitemap
  // ==========================================

  static async getSitemapEntries() {
    return prisma.blogPost.findMany({
      where: { status: 'PUBLISHED' },
      select: { slug: true, publishedAt: true, updatedAt: true },
      orderBy: { publishedAt: 'desc' },
    });
  }

  // ==========================================
  // Helpers
  // ==========================================

  private static async syncPostTags(postId: number, tagNames: string[]) {
    await prisma.blogPostTag.deleteMany({ where: { postId } });

    for (const name of tagNames) {
      const slug = slugify(name);
      const tag = await prisma.blogTag.upsert({
        where: { slug },
        create: { name: name.trim(), slug },
        update: {},
      });
      await prisma.blogPostTag.create({ data: { postId, tagId: tag.id } });
    }
  }
}

import { SocialPostStatus, Prisma } from '@prisma/client';
import { prisma } from '../config/database';
import { AppError } from '../utils/errors/AppError';

export class SocialService {
  // ==========================================
  // Accounts
  // ==========================================

  static async listAccounts() {
    return prisma.socialAccount.findMany({
      orderBy: { connectedAt: 'desc' },
      include: { _count: { select: { posts: true } } },
    });
  }

  static async createAccount(data: {
    platform: string;
    accountName: string;
    accountId: string;
    accessToken?: string;
    refreshToken?: string;
    externalData?: Record<string, unknown>;
  }) {
    return prisma.socialAccount.create({
      data: {
        platform: data.platform as any,
        accountName: data.accountName,
        accountId: data.accountId,
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
        externalData: data.externalData as Prisma.InputJsonValue,
      },
    });
  }

  static async deleteAccount(id: number) {
    const account = await prisma.socialAccount.findUnique({ where: { id } });
    if (!account) throw AppError.notFound('Conta não encontrada');
    return prisma.socialAccount.delete({ where: { id } });
  }

  static async getActiveAccounts() {
    return prisma.socialAccount.findMany({ where: { isActive: true } });
  }

  // ==========================================
  // Posts - Admin
  // ==========================================

  static async listPosts(options: {
    page?: number;
    limit?: number;
    status?: SocialPostStatus;
    audience?: string;
    platform?: string;
    q?: string;
  }) {
    const page = options.page || 1;
    const limit = Math.min(options.limit || 20, 100);
    const skip = (page - 1) * limit;

    const where: Prisma.SocialPostWhereInput = {};
    if (options.status) where.status = options.status;
    if (options.audience) where.audience = options.audience;
    if (options.q) {
      where.caption = { contains: options.q, mode: 'insensitive' };
    }
    if (options.platform) {
      where.platforms = { some: { account: { platform: options.platform as any } } };
    }

    const [posts, total] = await Promise.all([
      prisma.socialPost.findMany({
        where,
        skip,
        take: limit,
        orderBy: { updatedAt: 'desc' },
        include: {
          platforms: { include: { account: { select: { id: true, platform: true, accountName: true } } } },
          author: { select: { id: true, email: true, caregiver: { select: { fullName: true } } } },
        },
      }),
      prisma.socialPost.count({ where }),
    ]);

    return {
      data: posts,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  static async getPostById(id: number) {
    const post = await prisma.socialPost.findUnique({
      where: { id },
      include: {
        platforms: { include: { account: { select: { id: true, platform: true, accountName: true } } } },
        author: { select: { id: true, email: true, caregiver: { select: { fullName: true } } } },
      },
    });
    if (!post) throw AppError.notFound('Post não encontrado');
    return post;
  }

  static async createPost(data: {
    caption: string;
    mediaUrls?: string[];
    audience?: string;
    hashtags?: string[];
    scheduledAt?: string;
    aiGenerated?: boolean;
    aiPromptUsed?: string;
    authorId?: number;
    status?: SocialPostStatus;
    accountIds?: number[];
  }) {
    const post = await prisma.socialPost.create({
      data: {
        caption: data.caption,
        mediaUrls: data.mediaUrls || [],
        audience: data.audience,
        hashtags: data.hashtags || [],
        scheduledAt: data.scheduledAt ? new Date(data.scheduledAt) : undefined,
        aiGenerated: data.aiGenerated || false,
        aiPromptUsed: data.aiPromptUsed,
        authorId: data.authorId,
        status: data.status || 'DRAFT',
      },
    });

    if (data.accountIds?.length) {
      await prisma.socialPostPlatform.createMany({
        data: data.accountIds.map(accountId => ({ postId: post.id, accountId })),
      });
    }

    return this.getPostById(post.id);
  }

  static async updatePost(id: number, data: {
    caption?: string;
    mediaUrls?: string[];
    audience?: string;
    hashtags?: string[];
    scheduledAt?: string | null;
    status?: SocialPostStatus;
    accountIds?: number[];
  }) {
    const post = await prisma.socialPost.findUnique({ where: { id } });
    if (!post) throw AppError.notFound('Post não encontrado');

    const updateData: Prisma.SocialPostUpdateInput = {};
    if (data.caption !== undefined) updateData.caption = data.caption;
    if (data.mediaUrls !== undefined) updateData.mediaUrls = data.mediaUrls;
    if (data.audience !== undefined) updateData.audience = data.audience;
    if (data.hashtags !== undefined) updateData.hashtags = data.hashtags;
    if (data.scheduledAt !== undefined) {
      updateData.scheduledAt = data.scheduledAt ? new Date(data.scheduledAt) : null;
    }
    if (data.status !== undefined) updateData.status = data.status;

    await prisma.socialPost.update({ where: { id }, data: updateData });

    if (data.accountIds !== undefined) {
      await prisma.socialPostPlatform.deleteMany({ where: { postId: id } });
      if (data.accountIds.length) {
        await prisma.socialPostPlatform.createMany({
          data: data.accountIds.map(accountId => ({ postId: id, accountId })),
        });
      }
    }

    return this.getPostById(id);
  }

  static async deletePost(id: number) {
    const post = await prisma.socialPost.findUnique({ where: { id } });
    if (!post) throw AppError.notFound('Post não encontrado');
    await prisma.socialPost.delete({ where: { id } });
  }

  static async reviewPost(id: number, data: { approved: boolean; reviewNotes?: string; reviewedBy: number }) {
    const post = await prisma.socialPost.findUnique({ where: { id } });
    if (!post) throw AppError.notFound('Post não encontrado');
    if (post.status !== 'IN_REVIEW' && post.status !== 'DRAFT') {
      throw AppError.badRequest('Post não está em revisão');
    }

    return prisma.socialPost.update({
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
    const post = await prisma.socialPost.findUnique({
      where: { id },
      include: { platforms: { include: { account: true } } },
    });
    if (!post) throw AppError.notFound('Post não encontrado');
    if (post.status !== 'APPROVED' && post.status !== 'SCHEDULED') {
      throw AppError.badRequest('Post precisa estar aprovado para publicar');
    }

    await prisma.socialPost.update({
      where: { id },
      data: { status: 'PUBLISHED', publishedAt: new Date() },
    });

    await prisma.socialPostPlatform.updateMany({
      where: { postId: id },
      data: { status: 'published', publishedAt: new Date() },
    });

    return this.getPostById(id);
  }

  static async schedulePost(id: number, scheduledAt: string) {
    const post = await prisma.socialPost.findUnique({ where: { id } });
    if (!post) throw AppError.notFound('Post não encontrado');
    if (post.status !== 'APPROVED') {
      throw AppError.badRequest('Post precisa estar aprovado para agendar');
    }

    return prisma.socialPost.update({
      where: { id },
      data: { status: 'SCHEDULED', scheduledAt: new Date(scheduledAt) },
    });
  }

  static async archivePost(id: number) {
    const post = await prisma.socialPost.findUnique({ where: { id } });
    if (!post) throw AppError.notFound('Post não encontrado');
    return prisma.socialPost.update({ where: { id }, data: { status: 'ARCHIVED' } });
  }

  // ==========================================
  // Stats
  // ==========================================

  static async getStats() {
    const [total, byStatus, byPlatform, recentPosts] = await Promise.all([
      prisma.socialPost.count(),
      prisma.socialPost.groupBy({ by: ['status'], _count: true }),
      prisma.socialAccount.findMany({
        where: { isActive: true },
        select: { platform: true, accountName: true, _count: { select: { posts: true } } },
      }),
      prisma.socialPost.findMany({
        where: { status: 'PUBLISHED' },
        orderBy: { publishedAt: 'desc' },
        take: 5,
        select: { id: true, caption: true, publishedAt: true, audience: true },
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
      scheduled: statusMap['SCHEDULED'] || 0,
      failed: statusMap['FAILED'] || 0,
      archived: statusMap['ARCHIVED'] || 0,
      accounts: byPlatform,
      recentPosts,
    };
  }
}

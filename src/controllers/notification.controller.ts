// Olive Baby API - Notification Controller
import { Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../config/database';
import { AuthenticatedRequest, ApiResponse } from '../types';
import { AppError } from '../utils/errors/AppError';
import { NotificationStatus } from '@prisma/client';

// ==========================================
// Validation Schemas
// ==========================================

export const listNotificationsSchema = z.object({
  status: z.enum(['UNREAD', 'READ', 'ARCHIVED']).optional(),
  type: z.enum(['INSIGHT', 'ALERT', 'REMINDER', 'SYSTEM', 'ACHIEVEMENT']).optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
});

// ==========================================
// Controller
// ==========================================

export class NotificationController {
  /**
   * GET /notifications
   * List notifications for the authenticated user
   */
  static async listNotifications(
    req: AuthenticatedRequest,
    res: Response<ApiResponse>,
    next: NextFunction
  ): Promise<void> {
    try {
      const userId = req.user!.userId;
      const { status, type, page, limit } = listNotificationsSchema.parse(req.query);

      const where: any = { userId };
      if (status) where.status = status;
      if (type) where.type = type;

      const [notifications, total] = await Promise.all([
        prisma.notification.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
        }),
        prisma.notification.count({ where }),
      ]);

      res.json({
        success: true,
        data: notifications,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /notifications/count
   * Get count of unread notifications
   */
  static async getUnreadCount(
    req: AuthenticatedRequest,
    res: Response<ApiResponse>,
    next: NextFunction
  ): Promise<void> {
    try {
      const userId = req.user!.userId;

      const count = await prisma.notification.count({
        where: {
          userId,
          status: 'UNREAD',
        },
      });

      res.json({
        success: true,
        data: { count },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /notifications/:id/read
   * Mark a notification as read
   */
  static async markAsRead(
    req: AuthenticatedRequest,
    res: Response<ApiResponse>,
    next: NextFunction
  ): Promise<void> {
    try {
      const userId = req.user!.userId;
      const notificationId = parseInt(req.params.id, 10);

      const notification = await prisma.notification.findFirst({
        where: {
          id: notificationId,
          userId,
        },
      });

      if (!notification) {
        throw AppError.notFound('Notificação não encontrada');
      }

      const updated = await prisma.notification.update({
        where: { id: notificationId },
        data: {
          status: 'READ',
          readAt: new Date(),
        },
      });

      res.json({
        success: true,
        message: 'Notificação marcada como lida',
        data: updated,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /notifications/:id/archive
   * Archive a notification
   */
  static async archive(
    req: AuthenticatedRequest,
    res: Response<ApiResponse>,
    next: NextFunction
  ): Promise<void> {
    try {
      const userId = req.user!.userId;
      const notificationId = parseInt(req.params.id, 10);

      const notification = await prisma.notification.findFirst({
        where: {
          id: notificationId,
          userId,
        },
      });

      if (!notification) {
        throw AppError.notFound('Notificação não encontrada');
      }

      const updated = await prisma.notification.update({
        where: { id: notificationId },
        data: {
          status: 'ARCHIVED',
          archivedAt: new Date(),
        },
      });

      res.json({
        success: true,
        message: 'Notificação arquivada',
        data: updated,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /notifications/read-all
   * Mark all notifications as read
   */
  static async markAllAsRead(
    req: AuthenticatedRequest,
    res: Response<ApiResponse>,
    next: NextFunction
  ): Promise<void> {
    try {
      const userId = req.user!.userId;

      const result = await prisma.notification.updateMany({
        where: {
          userId,
          status: 'UNREAD',
        },
        data: {
          status: 'READ',
          readAt: new Date(),
        },
      });

      res.json({
        success: true,
        message: `${result.count} notificações marcadas como lidas`,
        data: { count: result.count },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * DELETE /notifications/:id
   * Delete a notification
   */
  static async delete(
    req: AuthenticatedRequest,
    res: Response<ApiResponse>,
    next: NextFunction
  ): Promise<void> {
    try {
      const userId = req.user!.userId;
      const notificationId = parseInt(req.params.id, 10);

      const notification = await prisma.notification.findFirst({
        where: {
          id: notificationId,
          userId,
        },
      });

      if (!notification) {
        throw AppError.notFound('Notificação não encontrada');
      }

      await prisma.notification.delete({
        where: { id: notificationId },
      });

      res.json({
        success: true,
        message: 'Notificação excluída',
      });
    } catch (error) {
      next(error);
    }
  }
}

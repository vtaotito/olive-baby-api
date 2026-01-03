// Utility to ensure the initial admin user exists
import { prisma } from '../config/database';
import { UserRole } from '@prisma/client';
import { logger } from '../config/logger';

const ADMIN_EMAIL = 'adm@api.oliecare.cloud';

export async function ensureInitialAdmin(): Promise<void> {
  try {
    const user = await prisma.user.findUnique({
      where: { email: ADMIN_EMAIL },
    });

    if (!user) {
      logger.warn('Initial admin user not found', { email: ADMIN_EMAIL });
      return;
    }

    if (user.role === UserRole.ADMIN) {
      logger.info('Initial admin already configured', { userId: user.id, email: ADMIN_EMAIL });
      return;
    }

    // Promote user to admin
    await prisma.user.update({
      where: { id: user.id },
      data: { role: UserRole.ADMIN },
    });

    // Create audit event
    await prisma.auditEvent.create({
      data: {
        userId: user.id,
        action: 'ADMIN_USER_ROLE_CHANGED',
        targetType: 'user',
        targetId: user.id,
        metadata: {
          oldRole: user.role,
          newRole: UserRole.ADMIN,
          method: 'startup',
          script: 'ensureInitialAdmin',
        },
      },
    });

    logger.info('Initial admin user promoted successfully', { 
      userId: user.id, 
      email: ADMIN_EMAIL,
      oldRole: user.role,
      newRole: UserRole.ADMIN,
    });

    console.log(`✅ User ${ADMIN_EMAIL} promoted to ADMIN`);
  } catch (error) {
    logger.error('Failed to ensure initial admin', { error });
    // Don't throw - allow server to start even if this fails
  }
}

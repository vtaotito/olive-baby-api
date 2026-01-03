// Olive Baby API - Promote User to Admin Script
// Run: npx ts-node src/scripts/promoteAdmin.ts

import { PrismaClient, UserRole } from '@prisma/client';

const prisma = new PrismaClient();

const ADMIN_EMAIL = 'adm@api.oliecare.cloud';

async function promoteAdmin() {
  console.log('🔄 Procurando usuário para promoção a ADMIN...');
  console.log(`📧 Email: ${ADMIN_EMAIL}`);

  try {
    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email: ADMIN_EMAIL },
      select: {
        id: true,
        email: true,
        role: true,
        caregiver: {
          select: { fullName: true },
        },
      },
    });

    if (!user) {
      console.log('❌ Usuário não encontrado. Criando usuário admin...');
      
      // Create admin user if not exists
      // Note: You may want to customize the password and other fields
      const bcrypt = await import('bcryptjs');
      const passwordHash = await bcrypt.hash('AdminOlieCare2026!', 10);
      
      const newAdmin = await prisma.user.create({
        data: {
          email: ADMIN_EMAIL,
          passwordHash,
          role: UserRole.ADMIN,
          status: 'ACTIVE',
          isActive: true,
        },
      });
      
      console.log('✅ Usuário admin criado com sucesso!');
      console.log(`   ID: ${newAdmin.id}`);
      console.log(`   Email: ${newAdmin.email}`);
      console.log(`   Role: ${newAdmin.role}`);
      console.log('\n⚠️  IMPORTANTE: Altere a senha padrão imediatamente!');
      return;
    }

    if (user.role === 'ADMIN') {
      console.log('✅ Usuário já é ADMIN!');
      console.log(`   ID: ${user.id}`);
      console.log(`   Nome: ${user.caregiver?.fullName || '-'}`);
      return;
    }

    // Promote to admin
    const updated = await prisma.user.update({
      where: { id: user.id },
      data: { role: UserRole.ADMIN },
      select: {
        id: true,
        email: true,
        role: true,
        caregiver: {
          select: { fullName: true },
        },
      },
    });

    console.log('✅ Usuário promovido a ADMIN com sucesso!');
    console.log(`   ID: ${updated.id}`);
    console.log(`   Nome: ${updated.caregiver?.fullName || '-'}`);
    console.log(`   Email: ${updated.email}`);
    console.log(`   Role anterior: ${user.role}`);
    console.log(`   Role atual: ${updated.role}`);

    // Create audit log
    await prisma.auditEvent.create({
      data: {
        userId: updated.id,
        action: 'ADMIN_USER_ROLE_CHANGED',
        targetType: 'user',
        targetId: updated.id,
        metadata: {
          oldRole: user.role,
          newRole: updated.role,
          method: 'script',
          script: 'promoteAdmin.ts',
        },
      },
    });

    console.log('📝 Evento de auditoria registrado.');

  } catch (error) {
    console.error('❌ Erro ao promover usuário:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
promoteAdmin()
  .then(() => {
    console.log('\n✨ Script finalizado com sucesso!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Script falhou:', error);
    process.exit(1);
  });

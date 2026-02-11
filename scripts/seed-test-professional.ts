// Olive Baby API - Seed Usuário Profissional de Teste
// Cria um usuário PEDIATRICIAN com registro Professional associado
// Uso: npx tsx scripts/seed-test-professional.ts

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();
const SALT_ROUNDS = 10;

const TEST_PROFESSIONAL = {
  email: 'dra.ana@oliecare.cloud',
  password: '@OlieCare2025Pro!',
  fullName: 'Dra. Ana Beatriz Santos',
  specialty: 'Pediatria',
  crmNumber: '123456',
  crmState: 'SP',
  phone: '(11) 99999-0001',
  city: 'São Paulo',
  state: 'SP',
};

async function main() {
  console.log('🩺 Criando usuário profissional de teste...\n');

  // Verificar se já existe
  const existingUser = await prisma.user.findUnique({
    where: { email: TEST_PROFESSIONAL.email },
    include: { professional: true },
  });

  if (existingUser) {
    console.log(`⚠️  Usuário já existe: ${existingUser.email} (id: ${existingUser.id}, role: ${existingUser.role})`);
    if (existingUser.professional) {
      console.log(`   Professional ID: ${existingUser.professional.id}`);
    }
    console.log('\n📋 Credenciais de acesso:');
    console.log(`   Email: ${TEST_PROFESSIONAL.email}`);
    console.log(`   Senha: ${TEST_PROFESSIONAL.password}`);
    console.log(`   Portal: https://prof.oliecare.cloud`);
    await prisma.$disconnect();
    return;
  }

  // Hash da senha
  const passwordHash = await bcrypt.hash(TEST_PROFESSIONAL.password, SALT_ROUNDS);

  // Criar usuário + profissional em transação
  const result = await prisma.$transaction(async (tx) => {
    // 1. Criar User com role PEDIATRICIAN
    const user = await tx.user.create({
      data: {
        email: TEST_PROFESSIONAL.email,
        passwordHash,
        role: 'PEDIATRICIAN',
        status: 'ACTIVE',
        isActive: true,
        onboardingCompletedAt: new Date(),
      },
    });

    // 2. Criar Professional vinculado ao User
    const professional = await tx.professional.create({
      data: {
        userId: user.id,
        fullName: TEST_PROFESSIONAL.fullName,
        email: TEST_PROFESSIONAL.email,
        specialty: TEST_PROFESSIONAL.specialty,
        crmNumber: TEST_PROFESSIONAL.crmNumber,
        crmState: TEST_PROFESSIONAL.crmState,
        phone: TEST_PROFESSIONAL.phone,
        city: TEST_PROFESSIONAL.city,
        state: TEST_PROFESSIONAL.state,
        country: 'BR',
        registrationSource: 'SELF_REGISTERED',
        status: 'ACTIVE',
      },
    });

    return { user, professional };
  });

  console.log('✅ Usuário profissional criado com sucesso!\n');
  console.log(`   User ID: ${result.user.id}`);
  console.log(`   Role: ${result.user.role}`);
  console.log(`   Professional ID: ${result.professional.id}`);
  console.log(`   Nome: ${result.professional.fullName}`);
  console.log(`   CRM: ${result.professional.crmNumber}/${result.professional.crmState}`);
  console.log(`   Especialidade: ${result.professional.specialty}`);
  console.log('\n📋 Credenciais de acesso:');
  console.log(`   Email: ${TEST_PROFESSIONAL.email}`);
  console.log(`   Senha: ${TEST_PROFESSIONAL.password}`);
  console.log(`   Portal: https://prof.oliecare.cloud`);

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error('❌ Erro ao criar usuário profissional:', err);
  prisma.$disconnect();
  process.exit(1);
});

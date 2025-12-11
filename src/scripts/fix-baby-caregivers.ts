// Olive Baby API - Script para corrigir bebês sem cuidadores vinculados
// Execute: npx ts-node src/scripts/fix-baby-caregivers.ts

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fixBabyCaregivers() {
  console.log('🔍 Procurando bebês sem cuidadores vinculados...\n');

  // Buscar todos os bebês
  const babies = await prisma.baby.findMany({
    include: {
      caregivers: true
    }
  });

  let fixed = 0;
  let skipped = 0;

  for (const baby of babies) {
    if (baby.caregivers.length === 0) {
      console.log(`⚠️  Bebê "${baby.name}" (ID: ${baby.id}) não tem cuidadores vinculados`);

      // Tentar encontrar o cuidador que criou o bebê (primeiro usuário com role PARENT ou CAREGIVER)
      // Como não temos informação de quem criou, vamos pular
      console.log(`   ⏭️  Pulando - não é possível determinar o cuidador automaticamente`);
      skipped++;
    } else {
      console.log(`✅ Bebê "${baby.name}" (ID: ${baby.id}) tem ${baby.caregivers.length} cuidador(es)`);
    }
  }

  console.log(`\n📊 Resumo:`);
  console.log(`   ✅ Bebês OK: ${babies.length - skipped}`);
  console.log(`   ⚠️  Bebês sem cuidadores: ${skipped}`);
  console.log(`   🔧 Corrigidos: ${fixed}`);

  if (skipped > 0) {
    console.log(`\n💡 Para corrigir manualmente, use:`);
    console.log(`   POST /api/v1/babies/:babyId/caregivers`);
    console.log(`   { "caregiverId": <id>, "relationship": "MOTHER", "isPrimary": true }`);
  }
}

fixBabyCaregivers()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

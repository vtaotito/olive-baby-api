// Olive Baby API - Seed Vacinas PNI (Programa Nacional de Imunização)
// Referência: https://www.gov.br/saude/pt-br/vacinacao/calendario
// Calendário Nacional de Vacinação - Criança (0 a 10 anos)

import { PrismaClient, VaccineCalendarSource } from '@prisma/client';

const prisma = new PrismaClient();

interface VaccineDefinitionSeed {
  vaccineKey: string;
  name: string;
  description?: string;
  doseLabel: string;
  doseNumber: number;
  ageMonths: number;
  ageDays?: number;
  ageMaxMonths?: number;
  notes?: string;
  isOptional: boolean;
  sortOrder: number;
}

// Calendário PNI - Vacinas para crianças (0 a 10 anos)
// Atualizado conforme diretrizes do Ministério da Saúde
const PNI_VACCINES: VaccineDefinitionSeed[] = [
  // ====== AO NASCER ======
  {
    vaccineKey: 'BCG',
    name: 'BCG',
    description: 'Proteção contra formas graves de tuberculose (meníngea e miliar)',
    doseLabel: 'dose única',
    doseNumber: 1,
    ageMonths: 0,
    notes: 'Idealmente nas primeiras 12 horas de vida. Pode ser aplicada até 4 anos, 11 meses e 29 dias.',
    isOptional: false,
    sortOrder: 1,
  },
  {
    vaccineKey: 'HEPATITE_B',
    name: 'Hepatite B',
    description: 'Proteção contra Hepatite B',
    doseLabel: '1ª dose',
    doseNumber: 1,
    ageMonths: 0,
    notes: 'Aplicar nas primeiras 24 horas de vida, preferencialmente nas primeiras 12 horas.',
    isOptional: false,
    sortOrder: 2,
  },

  // ====== 2 MESES ======
  {
    vaccineKey: 'PENTA',
    name: 'Pentavalente (DTP+Hib+HB)',
    description: 'Proteção contra Difteria, Tétano, Coqueluche, Hepatite B e Haemophilus influenzae B',
    doseLabel: '1ª dose',
    doseNumber: 1,
    ageMonths: 2,
    notes: null,
    isOptional: false,
    sortOrder: 10,
  },
  {
    vaccineKey: 'VIP',
    name: 'VIP (Poliomielite Inativada)',
    description: 'Proteção contra Poliomielite (Paralisia Infantil)',
    doseLabel: '1ª dose',
    doseNumber: 1,
    ageMonths: 2,
    notes: null,
    isOptional: false,
    sortOrder: 11,
  },
  {
    vaccineKey: 'PNEUMO_10V',
    name: 'Pneumocócica 10-valente',
    description: 'Proteção contra doenças invasivas e otite média causadas por Streptococcus pneumoniae',
    doseLabel: '1ª dose',
    doseNumber: 1,
    ageMonths: 2,
    notes: null,
    isOptional: false,
    sortOrder: 12,
  },
  {
    vaccineKey: 'ROTAVIRUS',
    name: 'Rotavírus Humano',
    description: 'Proteção contra diarreia por Rotavírus',
    doseLabel: '1ª dose',
    doseNumber: 1,
    ageMonths: 2,
    notes: 'Primeira dose: de 1 mês e 15 dias até 3 meses e 15 dias. Intervalo mínimo de 30 dias entre as doses.',
    isOptional: false,
    sortOrder: 13,
  },

  // ====== 3 MESES ======
  {
    vaccineKey: 'MENC',
    name: 'Meningocócica C conjugada',
    description: 'Proteção contra doença meningocócica causada pelo sorogrupo C',
    doseLabel: '1ª dose',
    doseNumber: 1,
    ageMonths: 3,
    notes: null,
    isOptional: false,
    sortOrder: 20,
  },

  // ====== 4 MESES ======
  {
    vaccineKey: 'PENTA',
    name: 'Pentavalente (DTP+Hib+HB)',
    description: 'Proteção contra Difteria, Tétano, Coqueluche, Hepatite B e Haemophilus influenzae B',
    doseLabel: '2ª dose',
    doseNumber: 2,
    ageMonths: 4,
    notes: null,
    isOptional: false,
    sortOrder: 30,
  },
  {
    vaccineKey: 'VIP',
    name: 'VIP (Poliomielite Inativada)',
    description: 'Proteção contra Poliomielite (Paralisia Infantil)',
    doseLabel: '2ª dose',
    doseNumber: 2,
    ageMonths: 4,
    notes: null,
    isOptional: false,
    sortOrder: 31,
  },
  {
    vaccineKey: 'PNEUMO_10V',
    name: 'Pneumocócica 10-valente',
    description: 'Proteção contra doenças invasivas e otite média causadas por Streptococcus pneumoniae',
    doseLabel: '2ª dose',
    doseNumber: 2,
    ageMonths: 4,
    notes: null,
    isOptional: false,
    sortOrder: 32,
  },
  {
    vaccineKey: 'ROTAVIRUS',
    name: 'Rotavírus Humano',
    description: 'Proteção contra diarreia por Rotavírus',
    doseLabel: '2ª dose',
    doseNumber: 2,
    ageMonths: 4,
    notes: 'Segunda dose: de 3 meses e 15 dias até 7 meses e 29 dias. Não aplicar após essa idade.',
    isOptional: false,
    sortOrder: 33,
  },

  // ====== 5 MESES ======
  {
    vaccineKey: 'MENC',
    name: 'Meningocócica C conjugada',
    description: 'Proteção contra doença meningocócica causada pelo sorogrupo C',
    doseLabel: '2ª dose',
    doseNumber: 2,
    ageMonths: 5,
    notes: null,
    isOptional: false,
    sortOrder: 40,
  },

  // ====== 6 MESES ======
  {
    vaccineKey: 'PENTA',
    name: 'Pentavalente (DTP+Hib+HB)',
    description: 'Proteção contra Difteria, Tétano, Coqueluche, Hepatite B e Haemophilus influenzae B',
    doseLabel: '3ª dose',
    doseNumber: 3,
    ageMonths: 6,
    notes: null,
    isOptional: false,
    sortOrder: 50,
  },
  {
    vaccineKey: 'VIP',
    name: 'VIP (Poliomielite Inativada)',
    description: 'Proteção contra Poliomielite (Paralisia Infantil)',
    doseLabel: '3ª dose',
    doseNumber: 3,
    ageMonths: 6,
    notes: null,
    isOptional: false,
    sortOrder: 51,
  },
  {
    vaccineKey: 'INFLUENZA',
    name: 'Influenza (gripe)',
    description: 'Proteção contra Influenza/Gripe',
    doseLabel: '1ª dose',
    doseNumber: 1,
    ageMonths: 6,
    notes: 'Crianças de 6 meses a menores de 6 anos. Primovacinação: 2 doses com intervalo de 30 dias. Após: dose anual.',
    isOptional: false,
    sortOrder: 52,
  },
  {
    vaccineKey: 'COVID_19',
    name: 'Covid-19',
    description: 'Proteção contra Covid-19',
    doseLabel: '1ª dose',
    doseNumber: 1,
    ageMonths: 6,
    notes: 'A partir de 6 meses. Esquema pode variar conforme fabricante e disponibilidade.',
    isOptional: false,
    sortOrder: 53,
  },

  // ====== 7 MESES ======
  {
    vaccineKey: 'INFLUENZA',
    name: 'Influenza (gripe)',
    description: 'Proteção contra Influenza/Gripe',
    doseLabel: '2ª dose',
    doseNumber: 2,
    ageMonths: 7,
    notes: 'Segunda dose para primovacinação. Intervalo mínimo de 30 dias da 1ª dose.',
    isOptional: false,
    sortOrder: 60,
  },
  {
    vaccineKey: 'COVID_19',
    name: 'Covid-19',
    description: 'Proteção contra Covid-19',
    doseLabel: '2ª dose',
    doseNumber: 2,
    ageMonths: 7,
    notes: 'Intervalo conforme orientação do fabricante (geralmente 4-8 semanas).',
    isOptional: false,
    sortOrder: 61,
  },

  // ====== 9 MESES ======
  {
    vaccineKey: 'FEBRE_AMARELA',
    name: 'Febre Amarela',
    description: 'Proteção contra Febre Amarela',
    doseLabel: '1ª dose',
    doseNumber: 1,
    ageMonths: 9,
    notes: 'Uma dose aos 9 meses e uma dose de reforço aos 4 anos. Indicada para residentes ou viajantes para áreas com recomendação.',
    isOptional: false,
    sortOrder: 70,
  },
  {
    vaccineKey: 'COVID_19',
    name: 'Covid-19',
    description: 'Proteção contra Covid-19',
    doseLabel: '3ª dose',
    doseNumber: 3,
    ageMonths: 9,
    notes: 'Dose de reforço conforme esquema do fabricante.',
    isOptional: true,
    sortOrder: 71,
  },

  // ====== 12 MESES ======
  {
    vaccineKey: 'PNEUMO_10V',
    name: 'Pneumocócica 10-valente',
    description: 'Proteção contra doenças invasivas e otite média causadas por Streptococcus pneumoniae',
    doseLabel: 'reforço',
    doseNumber: 3,
    ageMonths: 12,
    notes: null,
    isOptional: false,
    sortOrder: 80,
  },
  {
    vaccineKey: 'MENACWY',
    name: 'Meningocócica ACWY conjugada',
    description: 'Proteção contra doença meningocócica causada pelos sorogrupos A, C, W e Y',
    doseLabel: '1ª dose',
    doseNumber: 1,
    ageMonths: 12,
    notes: 'Substituiu a vacina Meningocócica C aos 12 meses.',
    isOptional: false,
    sortOrder: 81,
  },
  {
    vaccineKey: 'TRIPLICE_VIRAL',
    name: 'Tríplice Viral (SCR)',
    description: 'Proteção contra Sarampo, Caxumba e Rubéola',
    doseLabel: '1ª dose',
    doseNumber: 1,
    ageMonths: 12,
    notes: null,
    isOptional: false,
    sortOrder: 82,
  },

  // ====== 15 MESES ======
  {
    vaccineKey: 'DTP',
    name: 'DTP (Tríplice Bacteriana)',
    description: 'Proteção contra Difteria, Tétano e Coqueluche',
    doseLabel: '1º reforço',
    doseNumber: 4,
    ageMonths: 15,
    notes: 'Primeiro reforço após esquema básico com Pentavalente.',
    isOptional: false,
    sortOrder: 90,
  },
  {
    vaccineKey: 'VIP',
    name: 'VIP (Poliomielite Inativada)',
    description: 'Proteção contra Poliomielite (Paralisia Infantil)',
    doseLabel: '1º reforço',
    doseNumber: 4,
    ageMonths: 15,
    notes: null,
    isOptional: false,
    sortOrder: 91,
  },
  {
    vaccineKey: 'TETRAVIRAL',
    name: 'Tetraviral (SCRV)',
    description: 'Proteção contra Sarampo, Caxumba, Rubéola e Varicela',
    doseLabel: 'dose única',
    doseNumber: 1,
    ageMonths: 15,
    notes: 'Corresponde à 2ª dose de Tríplice Viral + 1ª dose de Varicela.',
    isOptional: false,
    sortOrder: 92,
  },
  {
    vaccineKey: 'HEPATITE_A',
    name: 'Hepatite A',
    description: 'Proteção contra Hepatite A',
    doseLabel: 'dose única',
    doseNumber: 1,
    ageMonths: 15,
    notes: 'Dose única no calendário do PNI. Rede privada pode recomendar 2 doses.',
    isOptional: false,
    sortOrder: 93,
  },

  // ====== 4 ANOS ======
  {
    vaccineKey: 'DTP',
    name: 'DTP (Tríplice Bacteriana)',
    description: 'Proteção contra Difteria, Tétano e Coqueluche',
    doseLabel: '2º reforço',
    doseNumber: 5,
    ageMonths: 48,
    notes: 'Segundo reforço. Pode usar dTpa (acelular) se disponível.',
    isOptional: false,
    sortOrder: 100,
  },
  {
    vaccineKey: 'FEBRE_AMARELA',
    name: 'Febre Amarela',
    description: 'Proteção contra Febre Amarela',
    doseLabel: 'reforço',
    doseNumber: 2,
    ageMonths: 48,
    notes: 'Dose de reforço única aos 4 anos de idade.',
    isOptional: false,
    sortOrder: 101,
  },
  {
    vaccineKey: 'VARICELA',
    name: 'Varicela',
    description: 'Proteção contra Varicela (Catapora)',
    doseLabel: '2ª dose',
    doseNumber: 2,
    ageMonths: 48,
    notes: 'Segunda dose para crianças que não receberam Tetraviral aos 15 meses ou dose adicional.',
    isOptional: true,
    sortOrder: 102,
  },
  {
    vaccineKey: 'VOP',
    name: 'VOP (Poliomielite Oral)',
    description: 'Proteção contra Poliomielite (Paralisia Infantil)',
    doseLabel: '2º reforço',
    doseNumber: 5,
    ageMonths: 48,
    notes: 'Pode ser usada nos reforços. Crianças com imunossupressão devem receber apenas VIP.',
    isOptional: true,
    sortOrder: 103,
  },

  // ====== 9-14 ANOS (HPV) ======
  {
    vaccineKey: 'HPV4',
    name: 'HPV quadrivalente',
    description: 'Proteção contra HPV (tipos 6, 11, 16 e 18) - prevenção de cânceres e verrugas genitais',
    doseLabel: '1ª dose',
    doseNumber: 1,
    ageMonths: 108, // 9 anos
    ageMaxMonths: 168, // até 14 anos
    notes: 'Meninas e meninos de 9 a 14 anos. Esquema de 2 doses com intervalo de 6 meses.',
    isOptional: false,
    sortOrder: 110,
  },
  {
    vaccineKey: 'HPV4',
    name: 'HPV quadrivalente',
    description: 'Proteção contra HPV (tipos 6, 11, 16 e 18) - prevenção de cânceres e verrugas genitais',
    doseLabel: '2ª dose',
    doseNumber: 2,
    ageMonths: 114, // 9 anos e 6 meses
    ageMaxMonths: 174, // até 14 anos e 6 meses
    notes: 'Segunda dose 6 meses após a primeira.',
    isOptional: false,
    sortOrder: 111,
  },

  // ====== 11-14 ANOS (Reforços adolescentes) ======
  {
    vaccineKey: 'MENACWY',
    name: 'Meningocócica ACWY conjugada',
    description: 'Proteção contra doença meningocócica causada pelos sorogrupos A, C, W e Y',
    doseLabel: 'reforço',
    doseNumber: 2,
    ageMonths: 132, // 11 anos
    ageMaxMonths: 168, // até 14 anos
    notes: 'Dose de reforço para adolescentes.',
    isOptional: false,
    sortOrder: 120,
  },
  {
    vaccineKey: 'DTPA',
    name: 'dTpa (Tríplice Bacteriana Acelular do adulto)',
    description: 'Proteção contra Difteria, Tétano e Coqueluche',
    doseLabel: 'reforço',
    doseNumber: 6,
    ageMonths: 132, // 11 anos
    ageMaxMonths: 168, // até 14 anos
    notes: 'Reforço com formulação acelular para adolescentes e adultos.',
    isOptional: true,
    sortOrder: 121,
  },
];

async function seedVaccinesPNI() {
  console.log('🌱 Iniciando seed do calendário de vacinas PNI...');
  
  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const vaccine of PNI_VACCINES) {
    try {
      const existing = await prisma.vaccineDefinition.findUnique({
        where: {
          vaccineKey_doseLabel_source: {
            vaccineKey: vaccine.vaccineKey,
            doseLabel: vaccine.doseLabel,
            source: VaccineCalendarSource.PNI,
          },
        },
      });

      if (existing) {
        // Atualizar se houver mudanças
        await prisma.vaccineDefinition.update({
          where: { id: existing.id },
          data: {
            name: vaccine.name,
            description: vaccine.description,
            doseNumber: vaccine.doseNumber,
            ageMonths: vaccine.ageMonths,
            ageDays: vaccine.ageDays,
            ageMaxMonths: vaccine.ageMaxMonths,
            notes: vaccine.notes,
            isOptional: vaccine.isOptional,
            sortOrder: vaccine.sortOrder,
          },
        });
        updated++;
        console.log(`  📝 Atualizado: ${vaccine.name} - ${vaccine.doseLabel}`);
      } else {
        // Criar novo
        await prisma.vaccineDefinition.create({
          data: {
            vaccineKey: vaccine.vaccineKey,
            name: vaccine.name,
            description: vaccine.description,
            doseLabel: vaccine.doseLabel,
            doseNumber: vaccine.doseNumber,
            ageMonths: vaccine.ageMonths,
            ageDays: vaccine.ageDays,
            ageMaxMonths: vaccine.ageMaxMonths,
            source: VaccineCalendarSource.PNI,
            notes: vaccine.notes,
            isOptional: vaccine.isOptional,
            sortOrder: vaccine.sortOrder,
          },
        });
        created++;
        console.log(`  ✅ Criado: ${vaccine.name} - ${vaccine.doseLabel}`);
      }
    } catch (error) {
      console.error(`  ❌ Erro ao processar ${vaccine.name} - ${vaccine.doseLabel}:`, error);
      skipped++;
    }
  }

  console.log('\n📊 Resumo do seed:');
  console.log(`   ✅ Criados: ${created}`);
  console.log(`   📝 Atualizados: ${updated}`);
  console.log(`   ❌ Ignorados: ${skipped}`);
  console.log(`   📋 Total: ${PNI_VACCINES.length}`);
}

// Executar seed
seedVaccinesPNI()
  .then(() => {
    console.log('\n🎉 Seed de vacinas PNI concluído com sucesso!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Erro ao executar seed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

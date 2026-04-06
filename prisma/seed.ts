/**
 * StreamMalin V2 — Seed de base de données
 * Initialise les comptes maîtres YouTube et Disney+
 *
 * Usage: npm run prisma:seed
 *
 * IMPORTANT: Remplacer les données fictives par les vrais comptes !
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding StreamMalin database...');

  // ══════════════════════════════════════
  // YOUTUBE PREMIUM — 30 comptes maîtres
  // 5 slots par compte = 150 places max
  // ══════════════════════════════════════

  // Données fictives à remplacer par vos vrais comptes YouTube
  const youtubeAccounts = Array.from({ length: 30 }, (_, i) => ({
    email: `youtube-master-${i + 1}@example.com`, // ← REMPLACER
    service: 'YOUTUBE',
    maxSlots: 5,
  }));

  for (const account of youtubeAccounts) {
    const master = await prisma.masterAccount.upsert({
      where: { id: `yt-${account.email}` },
      create: {
        id: `yt-${account.email}`,
        service: account.service,
        email: account.email,
        maxSlots: account.maxSlots,
        active: true,
      },
      update: {},
    });

    // Créer 5 slots pour chaque compte YouTube
    for (let slot = 1; slot <= 5; slot++) {
      await prisma.slot.upsert({
        where: { id: `slot-yt-${master.id}-${slot}` },
        create: {
          id: `slot-yt-${master.id}-${slot}`,
          masterAccountId: master.id,
          profileNumber: slot,
          isAvailable: true,
        },
        update: {},
      });
    }
  }

  console.log(`✅ ${youtubeAccounts.length} comptes YouTube créés (${youtubeAccounts.length * 5} slots)`);

  // ══════════════════════════════════════
  // DISNEY+ PREMIUM 4K — 10 comptes maîtres
  // 5 slots par compte = 50 places max
  // ══════════════════════════════════════

  // Données fictives à remplacer par vos vrais comptes Disney+
  const disneyAccounts = [
    { email: 'disney-master-1@example.com', password: 'ChangeMe1!', service: 'DISNEY' },
    { email: 'disney-master-2@example.com', password: 'ChangeMe2!', service: 'DISNEY' },
    { email: 'disney-master-3@example.com', password: 'ChangeMe3!', service: 'DISNEY' },
    { email: 'disney-master-4@example.com', password: 'ChangeMe4!', service: 'DISNEY' },
    { email: 'disney-master-5@example.com', password: 'ChangeMe5!', service: 'DISNEY' },
    { email: 'disney-master-6@example.com', password: 'ChangeMe6!', service: 'DISNEY' },
    { email: 'disney-master-7@example.com', password: 'ChangeMe7!', service: 'DISNEY' },
    { email: 'disney-master-8@example.com', password: 'ChangeMe8!', service: 'DISNEY' },
    { email: 'disney-master-9@example.com', password: 'ChangeMe9!', service: 'DISNEY' },
    { email: 'disney-master-10@example.com', password: 'ChangeMe10!', service: 'DISNEY' },
  ];

  // PINs fictifs pour les profils Disney+ (à remplacer)
  const samplePins = ['1234', '5678', '9012', '3456', '7890'];

  for (const account of disneyAccounts) {
    const master = await prisma.masterAccount.upsert({
      where: { id: `dis-${account.email}` },
      create: {
        id: `dis-${account.email}`,
        service: account.service,
        email: account.email,
        password: account.password,
        maxSlots: 5,
        active: true,
      },
      update: {},
    });

    // Créer 5 slots pour chaque compte Disney+
    for (let slot = 1; slot <= 5; slot++) {
      await prisma.slot.upsert({
        where: { id: `slot-dis-${master.id}-${slot}` },
        create: {
          id: `slot-dis-${master.id}-${slot}`,
          masterAccountId: master.id,
          profileNumber: slot,
          pinCode: samplePins[slot - 1], // ← REMPLACER par vrais PINs
          isAvailable: true,
        },
        update: {},
      });
    }
  }

  console.log(`✅ ${disneyAccounts.length} comptes Disney+ créés (${disneyAccounts.length * 5} slots)`);
  console.log('');
  console.log('⚠️  IMPORTANT: Remplacez les données fictives par vos vrais comptes !');
  console.log('   Utilisez "npm run prisma:studio" pour éditer la base directement.');
  console.log('');
  console.log('🎉 Seed terminé !');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

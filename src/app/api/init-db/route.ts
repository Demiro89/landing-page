/**
 * GET /api/init-db?token=ADMIN_SECRET_TOKEN
 *
 * Initialise la base de données PostgreSQL (Neon) en une visite :
 * 1. Crée toutes les tables si elles n'existent pas
 * 2. Seed des comptes Disney+ et YouTube de test
 *
 * ⚠️  SÉCURITÉ : protégé par ADMIN_SECRET_TOKEN
 * ⚠️  USAGE UNIQUE : à supprimer une fois la DB initialisée
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// ──────────────────────────────────────
// Helper : exécute du SQL et log le résultat
// ──────────────────────────────────────
type LogEntry = { ok: boolean; msg: string };

async function run(logs: LogEntry[], label: string, sql: string) {
  try {
    await prisma.$executeRawUnsafe(sql);
    logs.push({ ok: true, msg: `✅ ${label}` });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    // "already exists" n'est pas une erreur bloquante
    if (msg.includes('already exists') || msg.includes('duplicate')) {
      logs.push({ ok: true, msg: `⏭️  ${label} (déjà existant)` });
    } else {
      logs.push({ ok: false, msg: `❌ ${label}: ${msg.slice(0, 120)}` });
    }
  }
}

// ──────────────────────────────────────
// GET handler
// ──────────────────────────────────────
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get('token');
  const adminToken = process.env.ADMIN_SECRET_TOKEN;

  if (!adminToken || token !== adminToken) {
    return new Response(
      renderHtml('❌ Non autorisé', [{ ok: false, msg: 'Token invalide ou manquant.' }]),
      { status: 401, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
    );
  }

  const logs: LogEntry[] = [];

  // ══════════════════════════════════════
  // ÉTAPE 1 — Création des tables
  // ══════════════════════════════════════

  // Table User
  await run(logs, 'Création table User', `
    CREATE TABLE IF NOT EXISTS "User" (
      "id"        TEXT NOT NULL,
      "email"     TEXT NOT NULL,
      "name"      TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "User_pkey" PRIMARY KEY ("id")
    )
  `);

  await run(logs, 'Index unique User.email', `
    CREATE UNIQUE INDEX IF NOT EXISTS "User_email_key" ON "User"("email")
  `);

  // Table MasterAccount
  await run(logs, 'Création table MasterAccount', `
    CREATE TABLE IF NOT EXISTS "MasterAccount" (
      "id"        TEXT NOT NULL,
      "service"   TEXT NOT NULL,
      "email"     TEXT NOT NULL,
      "password"  TEXT,
      "maxSlots"  INTEGER NOT NULL DEFAULT 5,
      "active"    BOOLEAN NOT NULL DEFAULT true,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "MasterAccount_pkey" PRIMARY KEY ("id")
    )
  `);

  // Table Slot
  await run(logs, 'Création table Slot', `
    CREATE TABLE IF NOT EXISTS "Slot" (
      "id"              TEXT NOT NULL,
      "masterAccountId" TEXT NOT NULL,
      "profileNumber"   INTEGER NOT NULL,
      "pinCode"         TEXT,
      "isAvailable"     BOOLEAN NOT NULL DEFAULT true,
      "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "Slot_pkey" PRIMARY KEY ("id")
    )
  `);

  // Table Order
  await run(logs, 'Création table Order', `
    CREATE TABLE IF NOT EXISTS "Order" (
      "id"            TEXT NOT NULL,
      "userId"        TEXT NOT NULL,
      "service"       TEXT NOT NULL,
      "amount"        DOUBLE PRECISION NOT NULL,
      "paymentMethod" TEXT NOT NULL,
      "paymentTxId"   TEXT,
      "status"        TEXT NOT NULL DEFAULT 'PENDING',
      "gmail"         TEXT,
      "slotId"        TEXT,
      "expiresAt"     TIMESTAMP(3),
      "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
    )
  `);

  await run(logs, 'Index unique Order.slotId', `
    CREATE UNIQUE INDEX IF NOT EXISTS "Order_slotId_key" ON "Order"("slotId")
  `);

  // Foreign keys (dans un DO block pour éviter l'erreur "already exists")
  await run(logs, 'FK Slot → MasterAccount', `
    DO $$ BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'Slot_masterAccountId_fkey'
      ) THEN
        ALTER TABLE "Slot"
          ADD CONSTRAINT "Slot_masterAccountId_fkey"
          FOREIGN KEY ("masterAccountId")
          REFERENCES "MasterAccount"("id")
          ON DELETE RESTRICT ON UPDATE CASCADE;
      END IF;
    END $$
  `);

  await run(logs, 'FK Order → User', `
    DO $$ BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'Order_userId_fkey'
      ) THEN
        ALTER TABLE "Order"
          ADD CONSTRAINT "Order_userId_fkey"
          FOREIGN KEY ("userId")
          REFERENCES "User"("id")
          ON DELETE RESTRICT ON UPDATE CASCADE;
      END IF;
    END $$
  `);

  await run(logs, 'FK Order → Slot', `
    DO $$ BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'Order_slotId_fkey'
      ) THEN
        ALTER TABLE "Order"
          ADD CONSTRAINT "Order_slotId_fkey"
          FOREIGN KEY ("slotId")
          REFERENCES "Slot"("id")
          ON DELETE SET NULL ON UPDATE CASCADE;
      END IF;
    END $$
  `);

  // ══════════════════════════════════════
  // ÉTAPE 2 — Seed des comptes de test
  // ══════════════════════════════════════

  // Vérifie si des données existent déjà
  let alreadySeeded = false;
  try {
    const count = await prisma.masterAccount.count();
    if (count > 0) {
      alreadySeeded = true;
      logs.push({ ok: true, msg: `⏭️  Seed ignoré (${count} comptes maîtres déjà en base)` });
    }
  } catch {
    logs.push({ ok: false, msg: '❌ Impossible de vérifier la table MasterAccount' });
  }

  if (!alreadySeeded) {
    try {
      // -- 3 comptes Disney+ de test (5 slots chacun = 15 slots) --
      const disneyAccounts = [
        { email: 'disney-compte1@example.com', password: 'MotDePasse1!', pins: ['1111', '2222', '3333', '4444', '5555'] },
        { email: 'disney-compte2@example.com', password: 'MotDePasse2!', pins: ['6666', '7777', '8888', '9999', '0000'] },
        { email: 'disney-compte3@example.com', password: 'MotDePasse3!', pins: ['1234', '2345', '3456', '4567', '5678'] },
      ];

      for (const acc of disneyAccounts) {
        const master = await prisma.masterAccount.create({
          data: {
            service: 'DISNEY',
            email: acc.email,
            password: acc.password,
            maxSlots: 5,
            active: true,
          },
        });

        for (let i = 1; i <= 5; i++) {
          await prisma.slot.create({
            data: {
              masterAccountId: master.id,
              profileNumber: i,
              pinCode: acc.pins[i - 1],
              isAvailable: true,
            },
          });
        }
      }

      logs.push({ ok: true, msg: `✅ 3 comptes Disney+ de test créés (15 slots)` });

      // -- 2 comptes YouTube de test --
      const ytAccounts = [
        { email: 'youtube-famille1@gmail.com' },
        { email: 'youtube-famille2@gmail.com' },
      ];

      for (const acc of ytAccounts) {
        const master = await prisma.masterAccount.create({
          data: {
            service: 'YOUTUBE',
            email: acc.email,
            maxSlots: 5,
            active: true,
          },
        });

        for (let i = 1; i <= 5; i++) {
          await prisma.slot.create({
            data: {
              masterAccountId: master.id,
              profileNumber: i,
              isAvailable: true,
            },
          });
        }
      }

      logs.push({ ok: true, msg: '✅ 2 comptes YouTube de test créés (10 slots)' });
      logs.push({ ok: true, msg: '⚠️  REMPLACEZ ces comptes par vos vrais comptes via /admin ou Prisma Studio !' });

    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      logs.push({ ok: false, msg: `❌ Erreur seed: ${msg.slice(0, 200)}` });
    }
  }

  // ══════════════════════════════════════
  // Résumé final
  // ══════════════════════════════════════
  const errors = logs.filter((l) => !l.ok).length;
  const title = errors === 0
    ? '🎉 Base de données initialisée !'
    : `⚠️ Terminé avec ${errors} erreur(s)`;

  return new Response(renderHtml(title, logs), {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}

// ──────────────────────────────────────
// HTML de réponse
// ──────────────────────────────────────
function renderHtml(title: string, logs: LogEntry[]): string {
  const rows = logs
    .map(
      (l) =>
        `<div style="padding:8px 12px;border-radius:6px;margin-bottom:6px;background:${
          l.ok ? 'rgba(0,255,170,0.06)' : 'rgba(255,59,59,0.08)'
        };border:1px solid ${
          l.ok ? 'rgba(0,255,170,0.2)' : 'rgba(255,59,59,0.3)'
        };font-size:0.85rem;">${l.msg}</div>`
    )
    .join('');

  const hasError = logs.some((l) => !l.ok);

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>StreamMalin — Init DB</title>
  <link href="https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@400;500&display=swap" rel="stylesheet"/>
  <style>
    *{box-sizing:border-box;margin:0;padding:0;}
    body{font-family:'DM Sans',sans-serif;background:#0a0a0f;color:#f0f0f5;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;}
    .box{background:#12121a;border:1px solid #1e1e2e;border-radius:20px;padding:36px;max-width:620px;width:100%;}
    h1{font-family:'Syne',sans-serif;font-size:1.5rem;font-weight:800;margin-bottom:6px;color:${hasError ? '#f59e0b' : '#00ffaa'};}
    .sub{font-size:0.82rem;color:#8888aa;margin-bottom:24px;}
    .logs{margin-bottom:24px;}
    .actions{display:flex;gap:10px;flex-wrap:wrap;}
    .btn{display:inline-flex;align-items:center;gap:8px;padding:11px 18px;border-radius:10px;font-family:'Syne',sans-serif;font-weight:700;font-size:0.85rem;text-decoration:none;cursor:pointer;}
    .btn-home{background:linear-gradient(135deg,#2563eb,#7c3aed);color:#fff;}
    .btn-admin{background:rgba(255,255,255,0.06);border:1px solid #2a2a3a;color:#f0f0f5;}
    .warn{margin-top:20px;padding:12px 16px;background:rgba(245,158,11,0.08);border:1px solid rgba(245,158,11,0.3);border-radius:10px;font-size:0.8rem;color:#f59e0b;line-height:1.6;}
  </style>
</head>
<body>
  <div class="box">
    <h1>${title}</h1>
    <p class="sub">Résultat de l'initialisation de la base de données</p>
    <div class="logs">${rows}</div>
    <div class="actions">
      <a href="/" class="btn btn-home">🏠 Voir le site</a>
      <a href="/admin" class="btn btn-admin">⚙️ Espace admin</a>
      <a href="/dashboard" class="btn btn-admin">👤 Dashboard client</a>
    </div>
    <div class="warn">
      ⚠️ <strong>Sécurité :</strong> Supprimez ce fichier (<code>app/api/init-db/route.ts</code>) de votre code une fois la base initialisée. Ce endpoint ne doit pas rester accessible en production.
    </div>
  </div>
</body>
</html>`;
}

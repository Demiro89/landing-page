/**
 * Migration unique : chiffre les identifiants déjà présents en base.
 *
 * À lancer une seule fois, après avoir défini ENCRYPTION_KEY :
 *   node --env-file=.env scripts/encrypt-existing-details.mjs
 *
 * Le script est idempotent : une valeur déjà chiffrée est ignorée, on peut
 * donc le relancer sans risque. L'algorithme reproduit exactement lib/crypto.ts.
 */
import crypto from 'crypto';
import { PrismaClient } from '@prisma/client';

const ALGO = 'aes-256-gcm';
const PREFIX = 'enc:v1:';

const raw = process.env.ENCRYPTION_KEY;
if (!raw || raw.length < 16) {
  console.error('❌ ENCRYPTION_KEY manquant ou trop court. Abandon.');
  process.exit(1);
}
const KEY = crypto.createHash('sha256').update(raw).digest();

const isEncrypted = (v) => typeof v === 'string' && v.startsWith(PREFIX);

function encrypt(plain) {
  if (plain == null || plain === '' || isEncrypted(plain)) return plain;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, KEY, iv);
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return PREFIX + iv.toString('hex') + ':' + tag.toString('hex') + ':' + enc.toString('hex');
}

const prisma = new PrismaClient();

async function main() {
  let stocksDone = 0;
  let ordersDone = 0;

  const stocks = await prisma.stockAccount.findMany();
  for (const s of stocks) {
    if (!isEncrypted(s.details)) {
      await prisma.stockAccount.update({ where: { id: s.id }, data: { details: encrypt(s.details) } });
      stocksDone++;
    }
  }

  const orders = await prisma.order.findMany();
  for (const o of orders) {
    if (!isEncrypted(o.details)) {
      await prisma.order.update({ where: { id: o.id }, data: { details: encrypt(o.details) } });
      ordersDone++;
    }
  }

  console.log(`✅ Migration terminée — ${stocksDone} compte(s) de stock et ${ordersDone} commande(s) chiffré(s).`);
}

main()
  .catch((e) => { console.error('❌ Erreur migration :', e); process.exit(1); })
  .finally(() => prisma.$disconnect());

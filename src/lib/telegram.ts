/**
 * StreamMalin V2 — Notifications Telegram Admin
 *
 * Envoie des alertes à l'admin via le Bot Telegram configuré.
 * Variables requises: TELEGRAM_BOT_TOKEN, TELEGRAM_ADMIN_CHAT_ID
 */

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000';

/**
 * Envoie un message au chat admin via l'API Telegram
 */
async function sendTelegramMessage(text: string): Promise<boolean> {
  // Lire les variables au moment de l'appel (pas au chargement du module)
  const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
  const ADMIN_CHAT_ID = process.env.TELEGRAM_ADMIN_CHAT_ID;

  console.log(`[Telegram] TELEGRAM_BOT_TOKEN présent : ${Boolean(BOT_TOKEN)}`);
  console.log(`[Telegram] TELEGRAM_ADMIN_CHAT_ID présent : ${Boolean(ADMIN_CHAT_ID)}`);

  if (!BOT_TOKEN || !ADMIN_CHAT_ID) {
    console.error('[Telegram] ❌ TELEGRAM_BOT_TOKEN ou TELEGRAM_ADMIN_CHAT_ID manquant — vérifiez les variables Vercel');
    return false;
  }

  try {
    const response = await fetch(
      `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: ADMIN_CHAT_ID,
          text,
          parse_mode: 'HTML',
          disable_web_page_preview: true,
        }),
      }
    );

    if (!response.ok) {
      const err = await response.text();
      console.error('[Telegram] Erreur API:', err);
      return false;
    }

    return true;
  } catch (error) {
    console.error('[Telegram] Erreur réseau:', error);
    return false;
  }
}

// ══════════════════════════════════════
// TEMPLATES DE NOTIFICATIONS
// ══════════════════════════════════════

/**
 * Alerte : nouveau paiement déclaré par un client
 */
export async function notifyPaymentDeclared(data: {
  orderId: string;
  email: string;
  service: 'YOUTUBE' | 'DISNEY' | 'SURFSHARK';
  amount: number;
  paymentMethod: string;
  paymentTxId: string;
  gmail?: string;
}) {
  const serviceEmoji = data.service === 'YOUTUBE' ? '🔴 YouTube Premium' : data.service === 'DISNEY' ? '🟣 Disney+ 4K' : '🔵 Surfshark VPN One';
  const methodLabel: Record<string, string> = {
    PAYPAL: '💙 PayPal',
    SOL: '🌐 Solana (SOL)',
    XRP: '🔷 XRP',
    USDT_TRC20: '💚 USDT TRC-20',
  };

  const adminToken = process.env.ADMIN_SECRET_TOKEN ?? 'TOKEN_MANQUANT';
  const confirmUrl = `${BASE_URL}/api/admin/confirm?orderId=${data.orderId}&token=${adminToken}`;

  const lines = [
    `🔔 <b>NOUVEAU PAIEMENT DÉCLARÉ</b>`,
    ``,
    `📦 Service : <b>${serviceEmoji}</b>`,
    `💶 Montant : <b>${data.amount}€/mois</b>`,
    `💳 Méthode : ${methodLabel[data.paymentMethod] ?? data.paymentMethod}`,
    `🔑 TxID/Hash : <code>${data.paymentTxId || 'non fourni'}</code>`,
    ``,
    `👤 Client : <code>${data.email}</code>`,
    data.gmail ? `📧 Gmail YouTube : <code>${data.gmail}</code>` : '',
    ``,
    `🆔 Order ID : <code>${data.orderId}</code>`,
    ``,
    `✅ <b>CONFIRMER</b> : <a href="${confirmUrl}">Cliquer ici</a>`,
    ``,
    data.service === 'YOUTUBE'
      ? `⚠️ Action requise : Envoyer l'invitation YouTube Premium au Gmail ci-dessus.`
      : `⚙️ Le slot Disney+ sera attribué automatiquement après confirmation.`,
  ].filter((l) => l !== '');

  return sendTelegramMessage(lines.join('\n'));
}

/**
 * Alerte : commande confirmée et slot Disney+ assigné
 */
export async function notifyOrderConfirmed(data: {
  orderId: string;
  email: string;
  service: 'YOUTUBE' | 'DISNEY' | 'SURFSHARK';
  amount?: number;
  durationMonths?: number;
  slotInfo?: {
    masterEmail: string;
    masterPassword: string;
    profileNumber: number;
    pinCode?: string;
  };
}) {
  const serviceEmoji =
    data.service === 'YOUTUBE' ? '🔴 YouTube Premium' :
    data.service === 'DISNEY'  ? '🟣 Disney+ 4K'      :
                                 '🔵 Surfshark VPN One';

  const slotLines =
    data.service === 'DISNEY' && data.slotInfo
      ? [
          ``,
          `🎬 <b>Slot Disney+ assigné :</b>`,
          `  Email : <code>${data.slotInfo.masterEmail}</code>`,
          `  Pass  : <code>${data.slotInfo.masterPassword}</code>`,
          `  Profil #${data.slotInfo.profileNumber}`,
          data.slotInfo.pinCode ? `  PIN   : <code>${data.slotInfo.pinCode}</code>` : '',
        ].filter(Boolean)
      : [];

  const lines = [
    `✅ <b>COMMANDE ACTIVÉE</b>`,
    ``,
    `📦 Service  : <b>${serviceEmoji}</b>`,
    data.durationMonths ? `📅 Durée    : <b>${data.durationMonths} mois</b>` : '',
    data.amount         ? `💶 Montant  : <b>${data.amount.toFixed(2).replace('.', ',')}€/mois</b>` : '',
    ``,
    `👤 Client   : <code>${data.email}</code>`,
    `🆔 Order ID : <code>${data.orderId}</code>`,
    ...slotLines,
  ].filter((l) => l !== '');

  return sendTelegramMessage(lines.join('\n'));
}

/**
 * Alerte : client a signalé un problème sur sa commande
 */
export async function notifyOrderReport(data: {
  orderId: string;
  email: string;
  service: string;
  issue: string;
  message?: string;
}) {
  const issueLabel: Record<string, string> = {
    ACCESS:  '🔑 Accès impossible',
    BILLING: '💳 Problème de facturation',
    OTHER:   '❓ Autre',
  };

  const lines = [
    `🚨 <b>SIGNALEMENT CLIENT</b>`,
    ``,
    `📦 Service  : <b>${data.service}</b>`,
    `⚠️ Problème : <b>${issueLabel[data.issue] ?? data.issue}</b>`,
    ``,
    `👤 Client   : <code>${data.email}</code>`,
    `🆔 Order ID : <code>${data.orderId}</code>`,
    data.message ? `\n💬 Message :\n<i>${data.message}</i>` : '',
    ``,
    `👉 Vérifiez dans l'admin : ${BASE_URL}/admin`,
  ].filter((l) => l !== '');

  return sendTelegramMessage(lines.join('\n'));
}

/**
 * Alerte : stock bas (moins de 5 slots disponibles)
 */
export async function notifyLowStock(service: string, availableSlots: number) {
  const emoji = service === 'YOUTUBE' ? '🔴' : '🟣';
  const text = [
    `⚠️ <b>STOCK BAS — ${emoji} ${service}</b>`,
    ``,
    `Il ne reste que <b>${availableSlots} slot(s)</b> disponible(s).`,
    `Ajoutez de nouveaux comptes maîtres via Prisma Studio !`,
  ].join('\n');

  return sendTelegramMessage(text);
}

/**
 * StreamMalin V2 — Service Email via Resend
 *
 * Expéditeur : StreamMalin <contact@streammalin.fr>
 * Variable requise : RESEND_API_KEY
 *
 * Fonctions disponibles :
 *  - sendAdminNewOrder()     → alerte patron : nouvelle commande reçue
 *  - sendOrderReceived()     → confirmation client : commande en cours de vérification
 *  - sendOrderConfirmed()    → livraison : accès Disney+ ou invitation YouTube envoyée
 *  - sendExpiryReminder()    → relance 3 jours avant expiration
 *  - sendExpiryNotice()      → notification le jour J d'expiration
 */

import { Resend } from 'resend';

const FROM = 'StreamMalin <contact@streammalin.fr>';
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? 'https://streammalin.fr';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? 'oub9493@gmail.com';

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  PAYPAL: 'PayPal (Entre proches)',
  SOL: 'Solana (SOL)',
  XRP: 'XRP (Ripple)',
  USDT_TRC20: 'USDT TRC-20 (TRON)',
};

// ──────────────────────────────────────
// Helper : envoie un email et log l'erreur sans crasher
// ──────────────────────────────────────
async function send(options: {
  to: string;
  subject: string;
  html: string;
}): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;

  console.log(`[Email] Tentative envoi → "${options.subject}" à ${options.to}`);
  console.log(`[Email] RESEND_API_KEY présente : ${Boolean(apiKey)} | Longueur : ${apiKey?.length ?? 0}`);
  console.log(`[Email] ADMIN_EMAIL : ${ADMIN_EMAIL}`);
  console.log(`[Email] FROM : ${FROM}`);

  if (!apiKey) {
    console.error('[Email] ❌ RESEND_API_KEY absente — email non envoyé. Vérifiez les variables Vercel.');
    return false;
  }

  // Instanciation au moment de l'appel pour garantir la lecture de la clé
  const resend = new Resend(apiKey);

  try {
    console.log(`[Email] → resend.emails.send() | from: ${FROM} | to: ${options.to}`);
    const { data, error } = await resend.emails.send({
      from: FROM,
      to: options.to,
      subject: options.subject,
      html: options.html,
    });

    if (error) {
      // Log the full error object as JSON for diagnosis in Vercel logs
      console.error('[Email] ❌ Erreur API Resend:', JSON.stringify(error, null, 2));
      console.error('[Email] Détail — name:', (error as { name?: string }).name, '| message:', (error as { message?: string }).message);
      return false;
    }

    console.log(`[Email] ✅ Envoyé ! ID Resend : ${data?.id} | to : ${options.to}`);
    return true;
  } catch (err) {
    console.error('[Email] ❌ Exception réseau/SDK:', err instanceof Error ? `${err.name}: ${err.message}` : JSON.stringify(err));
    return false;
  }
}

// ══════════════════════════════════════
// 1. ALERTE PATRON — Nouvelle commande
// ══════════════════════════════════════

/**
 * Envoyé à l'admin dès qu'un client déclare son paiement.
 * Destinataire : ADMIN_EMAIL (oub9493@gmail.com par défaut)
 */
export async function sendAdminNewOrder(data: {
  orderId: string;
  customerEmail: string;
  service: 'YOUTUBE' | 'DISNEY';
  amount: number;
  paymentMethod: string;
  paymentTxId: string;
  gmail?: string;
}) {
  const serviceLabel = data.service === 'YOUTUBE' ? 'YouTube Premium' : 'Disney+ 4K';
  const accentColor = data.service === 'YOUTUBE' ? '#ff3b3b' : '#7c3aed';
  const adminUrl = `${BASE_URL}/admin`;
  const confirmUrl = `${BASE_URL}/api/admin/confirm?orderId=${data.orderId}&token=${process.env.ADMIN_SECRET_TOKEN ?? 'TOKEN'}`;

  const html = baseTemplate({
    title: `🔔 Nouvelle commande ${serviceLabel}`,
    accentColor,
    body: `
      <p style="margin:0 0 16px;font-size:15px;color:#f0f0f5;">
        Un client vient de déclarer un paiement. Vérifiez et validez la commande.
      </p>

      <table style="width:100%;border-collapse:collapse;margin:0 0 20px;">
        <tr style="border-bottom:1px solid #1e1e2e;">
          <td style="padding:8px 0;font-size:13px;color:#8888aa;width:140px;">Commande</td>
          <td style="padding:8px 0;font-size:13px;color:#f0f0f5;font-family:monospace;">#${data.orderId.slice(0, 12).toUpperCase()}</td>
        </tr>
        <tr style="border-bottom:1px solid #1e1e2e;">
          <td style="padding:8px 0;font-size:13px;color:#8888aa;">Client</td>
          <td style="padding:8px 0;font-size:13px;color:#f0f0f5;">${data.customerEmail}</td>
        </tr>
        <tr style="border-bottom:1px solid #1e1e2e;">
          <td style="padding:8px 0;font-size:13px;color:#8888aa;">Service</td>
          <td style="padding:8px 0;font-size:13px;color:${accentColor};font-weight:700;">${serviceLabel}</td>
        </tr>
        <tr style="border-bottom:1px solid #1e1e2e;">
          <td style="padding:8px 0;font-size:13px;color:#8888aa;">Montant</td>
          <td style="padding:8px 0;font-size:13px;color:#00ffaa;font-weight:700;">${data.amount.toFixed(2).replace('.', ',')}€</td>
        </tr>
        <tr style="border-bottom:1px solid #1e1e2e;">
          <td style="padding:8px 0;font-size:13px;color:#8888aa;">Méthode</td>
          <td style="padding:8px 0;font-size:13px;color:#f0f0f5;">${PAYMENT_METHOD_LABELS[data.paymentMethod] ?? data.paymentMethod}</td>
        </tr>
        <tr style="border-bottom:1px solid #1e1e2e;">
          <td style="padding:8px 0;font-size:13px;color:#8888aa;">TxID / Référence</td>
          <td style="padding:8px 0;font-size:13px;color:#f0f0f5;font-family:monospace;word-break:break-all;">${data.paymentTxId}</td>
        </tr>
        ${data.gmail ? `
        <tr>
          <td style="padding:8px 0;font-size:13px;color:#8888aa;">Gmail client</td>
          <td style="padding:8px 0;font-size:13px;color:#f0f0f5;">${data.gmail}</td>
        </tr>` : ''}
      </table>

      <table cellpadding="0" cellspacing="0">
        <tr>
          <td style="padding-right:12px;">
            <a href="${confirmUrl}" style="display:inline-block;padding:12px 22px;background:#00ffaa;color:#000;text-decoration:none;border-radius:10px;font-weight:700;font-size:14px;">
              ✅ Valider la commande
            </a>
          </td>
          <td>
            <a href="${adminUrl}" style="display:inline-block;padding:12px 22px;background:#1e1e2e;border:1px solid #2a2a3a;color:#f0f0f5;text-decoration:none;border-radius:10px;font-weight:700;font-size:14px;">
              🔧 Ouvrir l'admin
            </a>
          </td>
        </tr>
      </table>`,
  });

  return send({
    to: ADMIN_EMAIL,
    subject: `🔔 Nouvelle commande ${serviceLabel} — #${data.orderId.slice(0, 8).toUpperCase()}`,
    html,
  });
}

// ══════════════════════════════════════
// 2. CONFIRMATION CLIENT — Commande reçue
// ══════════════════════════════════════

/**
 * Envoyé au client dès qu'il soumet sa commande.
 * Confirme que la commande est bien reçue et en cours de vérification.
 */
export async function sendOrderReceived(data: {
  to: string;
  orderId: string;
  service: 'YOUTUBE' | 'DISNEY';
  amount: number;
  paymentMethod: string;
}) {
  const isYoutube = data.service === 'YOUTUBE';
  const serviceLabel = isYoutube ? 'YouTube Premium' : 'Disney+ 4K';
  const accentColor = isYoutube ? '#ff3b3b' : '#7c3aed';
  const dashboardUrl = `${BASE_URL}/dashboard?email=${encodeURIComponent(data.to)}`;

  const html = baseTemplate({
    title: `📬 Commande reçue — ${serviceLabel}`,
    accentColor,
    body: `
      <p style="margin:0 0 16px;font-size:15px;color:#f0f0f5;">
        Merci ! Votre commande a bien été enregistrée. Notre équipe vérifie votre paiement et activera votre accès sous peu.
      </p>

      <div style="background:#1a1a24;border:1px solid #2a2a3a;border-radius:10px;padding:16px;margin:0 0 20px;">
        <table style="width:100%;border-collapse:collapse;">
          <tr style="border-bottom:1px solid #2a2a3a;">
            <td style="padding:6px 0;font-size:13px;color:#8888aa;width:130px;">Commande</td>
            <td style="padding:6px 0;font-size:13px;color:#f0f0f5;font-family:monospace;">#${data.orderId.slice(0, 12).toUpperCase()}</td>
          </tr>
          <tr style="border-bottom:1px solid #2a2a3a;">
            <td style="padding:6px 0;font-size:13px;color:#8888aa;">Service</td>
            <td style="padding:6px 0;font-size:13px;color:${accentColor};font-weight:700;">${serviceLabel}</td>
          </tr>
          <tr style="border-bottom:1px solid #2a2a3a;">
            <td style="padding:6px 0;font-size:13px;color:#8888aa;">Montant</td>
            <td style="padding:6px 0;font-size:13px;color:#f0f0f5;">${data.amount.toFixed(2).replace('.', ',')}€/mois</td>
          </tr>
          <tr>
            <td style="padding:6px 0;font-size:13px;color:#8888aa;">Statut</td>
            <td style="padding:6px 0;font-size:13px;color:#f59e0b;font-weight:700;">⏳ En cours de vérification</td>
          </tr>
        </table>
      </div>

      <p style="margin:0 0 20px;font-size:14px;color:#8888aa;line-height:1.6;">
        Délai de traitement habituel : <strong style="color:#f0f0f5;">moins de 30 minutes</strong>.<br/>
        Vous recevrez un second email dès que votre accès sera activé.
      </p>

      <a href="${dashboardUrl}" style="display:inline-block;margin:0 0 16px;padding:12px 24px;background:linear-gradient(135deg,#2563eb,#7c3aed);color:#fff;text-decoration:none;border-radius:10px;font-weight:700;font-size:14px;">
        Suivre ma commande →
      </a>

      <p style="margin:0;font-size:13px;color:#8888aa;">
        Une question ? <a href="https://t.me/abonnementpro_bot" style="color:#3b82f6;">Contactez le support sur Telegram</a>
      </p>`,
  });

  return send({
    to: data.to,
    subject: `📬 Commande reçue — ${serviceLabel} en cours de vérification`,
    html,
  });
}

/**
 * Envoyé quand l'admin valide le paiement.
 * - Disney+ : affiche les accès en clair
 * - YouTube  : confirme l'envoi de l'invitation
 */
export async function sendOrderConfirmed(data: {
  to: string;
  orderId: string;
  service: 'YOUTUBE' | 'DISNEY';
  expiresAt?: Date;
  disneyAccess?: {
    email: string;
    password: string;
    profileNumber: number;
    pinCode?: string;
  };
}) {
  const isYoutube = data.service === 'YOUTUBE';
  const serviceLabel = isYoutube ? 'YouTube Premium' : 'Disney+ 4K';
  const accentColor = isYoutube ? '#ff3b3b' : '#7c3aed';
  const dashboardUrl = `${BASE_URL}/dashboard?email=${encodeURIComponent(data.to)}`;

  const expiryLine = data.expiresAt
    ? `<p style="margin:0 0 8px;font-size:14px;color:#8888aa;">
        Valable jusqu'au <strong style="color:#f0f0f5;">
          ${data.expiresAt.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
        </strong>
       </p>`
    : '';

  const accessBlock = isYoutube
    ? `
      <div style="background:#1a1a24;border:1px solid #2a2a3a;border-left:3px solid #ff3b3b;border-radius:10px;padding:16px;margin:16px 0;">
        <p style="margin:0 0 8px;font-size:13px;color:#ff3b3b;font-weight:700;">
          ▶ Invitation YouTube Premium
        </p>
        <p style="margin:0;font-size:14px;color:#8888aa;line-height:1.6;">
          Une invitation a été envoyée sur votre compte Google.<br/>
          Acceptez-la depuis <strong style="color:#f0f0f5;">Gmail → "Rejoindre YouTube Premium"</strong>.
        </p>
      </div>`
    : data.disneyAccess
    ? `
      <div style="background:#1a1a24;border:1px solid #2a2a3a;border-left:3px solid #7c3aed;border-radius:10px;padding:16px;margin:16px 0;">
        <p style="margin:0 0 12px;font-size:13px;color:#a78bfa;font-weight:700;">
          ✦ Vos accès Disney+
        </p>
        <table style="width:100%;border-collapse:collapse;">
          <tr>
            <td style="padding:4px 0;font-size:13px;color:#8888aa;width:120px;">Email</td>
            <td style="padding:4px 0;font-size:13px;color:#f0f0f5;font-family:monospace;">${data.disneyAccess.email}</td>
          </tr>
          <tr>
            <td style="padding:4px 0;font-size:13px;color:#8888aa;">Mot de passe</td>
            <td style="padding:4px 0;font-size:13px;color:#f0f0f5;font-family:monospace;">${data.disneyAccess.password}</td>
          </tr>
          <tr>
            <td style="padding:4px 0;font-size:13px;color:#8888aa;">Votre profil</td>
            <td style="padding:4px 0;font-size:13px;color:#f0f0f5;">Profil <strong>${data.disneyAccess.profileNumber}</strong></td>
          </tr>
          ${data.disneyAccess.pinCode ? `
          <tr>
            <td style="padding:4px 0;font-size:13px;color:#8888aa;">Code PIN</td>
            <td style="padding:4px 0;font-size:13px;color:#f0f0f5;font-family:monospace;">${data.disneyAccess.pinCode}</td>
          </tr>` : ''}
        </table>
        <p style="margin:12px 0 0;font-size:12px;color:#8888aa;">
          ⚠️ Connectez-vous sur disneyplus.com et utilisez uniquement le Profil ${data.disneyAccess.profileNumber}. Ne modifiez pas le mot de passe.
        </p>
      </div>`
    : '';

  const html = baseTemplate({
    title: `🎉 Votre accès ${serviceLabel} est activé !`,
    accentColor,
    body: `
      <p style="margin:0 0 16px;font-size:15px;color:#f0f0f5;">Bonne nouvelle ! Votre paiement a été validé.</p>
      ${expiryLine}
      ${accessBlock}
      <a href="${dashboardUrl}" style="display:inline-block;margin:16px 0;padding:12px 24px;background:linear-gradient(135deg,#2563eb,#7c3aed);color:#fff;text-decoration:none;border-radius:10px;font-weight:700;font-size:14px;">
        Accéder à mon espace client →
      </a>
      <p style="margin:16px 0 0;font-size:13px;color:#8888aa;">
        Commande #${data.orderId.slice(0, 12).toUpperCase()}<br/>
        Une question ? Contactez-nous sur Telegram : <a href="https://t.me/abonnementpro_bot" style="color:#3b82f6;">@abonnementpro_bot</a>
      </p>`,
  });

  return send({
    to: data.to,
    subject: `✅ Votre accès ${serviceLabel} est activé — StreamMalin`,
    html,
  });
}

// ══════════════════════════════════════
// 2. RELANCE 3 JOURS AVANT EXPIRATION
// ══════════════════════════════════════

export async function sendExpiryReminder(data: {
  to: string;
  service: 'YOUTUBE' | 'DISNEY';
  expiresAt: Date;
  daysLeft: number;
}) {
  const isYoutube = data.service === 'YOUTUBE';
  const serviceLabel = isYoutube ? 'YouTube Premium' : 'Disney+ 4K';
  const price = isYoutube ? '5,99€' : '4,99€';
  const accentColor = '#f59e0b';
  const dashboardUrl = `${BASE_URL}/dashboard?email=${encodeURIComponent(data.to)}`;

  const html = baseTemplate({
    title: `⏰ Votre ${serviceLabel} expire dans ${data.daysLeft} jour${data.daysLeft > 1 ? 's' : ''}`,
    accentColor,
    body: `
      <p style="margin:0 0 12px;font-size:15px;color:#f0f0f5;">
        Votre abonnement <strong>${serviceLabel}</strong> expire le
        <strong style="color:#f59e0b;">
          ${data.expiresAt.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
        </strong>.
      </p>
      <p style="margin:0 0 20px;font-size:14px;color:#8888aa;">
        Pour continuer à profiter du service sans interruption, renouvelez dès maintenant à <strong style="color:#00ffaa;">${price}/mois</strong>.
      </p>
      <a href="${BASE_URL}/#offres" style="display:inline-block;margin:0 0 20px;padding:13px 28px;background:linear-gradient(135deg,#2563eb,#7c3aed);color:#fff;text-decoration:none;border-radius:10px;font-weight:700;font-size:15px;">
        🔄 Se réabonner maintenant
      </a>
      <p style="margin:0;font-size:13px;color:#8888aa;">
        Ou consultez votre espace client : <a href="${dashboardUrl}" style="color:#3b82f6;">Mon dashboard</a>
      </p>`,
  });

  return send({
    to: data.to,
    subject: `⏰ Votre ${serviceLabel} expire dans ${data.daysLeft} jour${data.daysLeft > 1 ? 's' : ''} — StreamMalin`,
    html,
  });
}

// ══════════════════════════════════════
// 3. NOTIFICATION D'EXPIRATION (JOUR J)
// ══════════════════════════════════════

export async function sendExpiryNotice(data: {
  to: string;
  service: 'YOUTUBE' | 'DISNEY';
}) {
  const isYoutube = data.service === 'YOUTUBE';
  const serviceLabel = isYoutube ? 'YouTube Premium' : 'Disney+ 4K';
  const price = isYoutube ? '5,99€' : '4,99€';

  const html = baseTemplate({
    title: `🔴 Votre ${serviceLabel} a expiré`,
    accentColor: '#ff3b3b',
    body: `
      <p style="margin:0 0 12px;font-size:15px;color:#f0f0f5;">
        Votre abonnement <strong>${serviceLabel}</strong> est arrivé à échéance aujourd'hui.
      </p>
      <p style="margin:0 0 20px;font-size:14px;color:#8888aa;">
        Votre accès a été désactivé. Renouvelez en quelques secondes pour retrouver votre service à <strong style="color:#00ffaa;">${price}/mois</strong>.
      </p>
      <a href="${BASE_URL}/#offres" style="display:inline-block;margin:0 0 20px;padding:13px 28px;background:linear-gradient(135deg,#2563eb,#7c3aed);color:#fff;text-decoration:none;border-radius:10px;font-weight:700;font-size:15px;">
        ⚡ Réactiver mon accès
      </a>`,
  });

  return send({
    to: data.to,
    subject: `🔴 Votre ${serviceLabel} a expiré — Réactivez en 1 clic`,
    html,
  });
}

// ══════════════════════════════════════
// Template HTML de base
// ══════════════════════════════════════
function baseTemplate({
  title,
  accentColor,
  body,
}: {
  title: string;
  accentColor: string;
  body: string;
}): string {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background:#0a0a0f;font-family:'Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0f;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">

          <!-- Logo -->
          <tr>
            <td style="padding:0 0 24px;">
              <table cellpadding="0" cellspacing="0">
                <tr>
                  <td style="background:#fff;border-radius:8px;width:28px;height:28px;text-align:center;vertical-align:middle;">
                    <span style="font-size:14px;">⚡</span>
                  </td>
                  <td style="padding-left:10px;font-size:16px;font-weight:700;color:#f0f0f5;letter-spacing:-0.02em;">
                    StreamMalin
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Card -->
          <tr>
            <td style="background:#12121a;border:1px solid #1e1e2e;border-top:3px solid ${accentColor};border-radius:16px;padding:28px 28px 24px;">

              <h1 style="margin:0 0 20px;font-size:20px;font-weight:800;color:#f0f0f5;line-height:1.3;">
                ${title}
              </h1>

              ${body}

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:20px 0 0;text-align:center;">
              <p style="margin:0 0 6px;font-size:12px;color:#8888aa;">
                StreamMalin · <a href="${BASE_URL}" style="color:#8888aa;">streammalin.fr</a>
              </p>
              <p style="margin:0;font-size:11px;color:#555566;">
                Vous recevez cet email car vous êtes client StreamMalin.<br/>
                Ce service propose des accès partagés légaux à des abonnements familiaux.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

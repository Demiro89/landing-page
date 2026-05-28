import { Resend } from 'resend';

// Le fallback évite une erreur au build quand la clé est absente (mode simulation) ;
// chaque fonction vérifie RESEND_API_KEY avant tout envoi réel.
const resend = new Resend(process.env.RESEND_API_KEY || 're_placeholder');

const FROM_EMAIL = 'StreamMalin <noreply@streammalin.fr>';
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://streammalin.fr';

export async function sendOrderDetailsEmail(
  toEmail: string,
  serviceName: string,
  details: string,
  orderId: string,
  youtubeEmail?: string,
  meta?: { amount?: number; invoiceId?: string; invoiceNumber?: string }
) {
  if (!process.env.RESEND_API_KEY) {
    console.log('--- [SIMULATION EMAIL] ---');
    console.log(`To: ${toEmail} | Service: ${serviceName} | Order: ${orderId}${youtubeEmail ? ` | YouTube: ${youtubeEmail}` : ''}`);
    console.log(details);
    return { success: true, simulated: true };
  }

  const isYoutube = !!youtubeEmail;
  const credentialsBlock = isYoutube
    ? `<p>Votre accès à <strong>${serviceName}</strong> fonctionne par <strong style="color:#fff">invitation famille</strong>. Sous quelques minutes, vous recevrez une invitation à rejoindre notre groupe à l'adresse suivante&nbsp;:</p>
       <div class="creds">📧 ${youtubeEmail}</div>
       <p style="font-size:0.9rem;color:#9ca3af">Vérifiez votre boîte de réception (et vos spams) et acceptez l'invitation depuis votre compte Google. Aucun identifiant à saisir — vous gardez votre propre compte.</p>`
    : `<p>Vos identifiants d'accès :</p>
       <div class="creds">${details}</div>`;

  const recapBlock = `
    <div style="background:rgba(15,23,42,.8);border:1px solid rgba(168,85,247,.2);border-radius:12px;padding:16px 20px;margin:22px 0">
      <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid rgba(255,255,255,.06)"><span style="color:#9ca3af;font-size:13px">Commande</span><span style="color:#e5e7eb;font-size:13px;font-weight:600">${orderId}</span></div>
      <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid rgba(255,255,255,.06)"><span style="color:#9ca3af;font-size:13px">Offre</span><span style="color:#e5e7eb;font-size:13px;font-weight:600">${serviceName}</span></div>
      <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid rgba(255,255,255,.06)"><span style="color:#9ca3af;font-size:13px">Durée</span><span style="color:#e5e7eb;font-size:13px;font-weight:600">1 mois</span></div>
      ${meta?.amount != null ? `<div style="display:flex;justify-content:space-between;padding:6px 0"><span style="color:#9ca3af;font-size:13px">Montant payé</span><span style="color:#e5e7eb;font-size:13px;font-weight:700">${meta.amount.toFixed(2)} €</span></div>` : ''}
    </div>`;

  const invoiceBlock = meta?.invoiceId
    ? `<p style="font-size:0.9rem">📄 Votre facture${meta.invoiceNumber ? ` <strong style="color:#fff">${meta.invoiceNumber}</strong>` : ''} est disponible :
       <a href="${APP_URL}/facture/${meta.invoiceId}" style="color:#a855f7">Consulter / télécharger ma facture</a>.</p>`
    : '';

  try {
    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: toEmail,
      subject: `⚡ Vos accès à ${serviceName} sont prêts ! - StreamMalin`,
      html: `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body{font-family:'Outfit','Inter',sans-serif;background:#0b0c10;color:#e5e7eb;margin:0;padding:20px}
    .container{max-width:600px;margin:0 auto;background:linear-gradient(135deg,rgba(20,24,33,.95),rgba(10,12,16,.95));border:1px solid rgba(168,85,247,.2);border-radius:16px;padding:30px;box-shadow:0 10px 30px rgba(168,85,247,.1)}
    .logo{font-size:28px;font-weight:800;letter-spacing:-.5px;background:linear-gradient(135deg,#a855f7 0%,#3b82f6 100%);-webkit-background-clip:text;-webkit-text-fill-color:transparent}
    .title{font-size:22px;margin-top:10px;font-weight:700;color:#fff}
    .badge{display:inline-block;background:rgba(168,85,247,.15);border:1px solid #a855f7;color:#e9d5ff;padding:6px 12px;border-radius:9999px;font-size:14px;font-weight:600;margin-bottom:20px}
    .creds{background:rgba(15,23,42,.8);border:1px dashed rgba(59,130,246,.4);border-radius:12px;padding:20px;margin:25px 0;font-family:'Courier New',monospace;font-size:15px;color:#3b82f6;white-space:pre-wrap;word-break:break-all}
    .btn{display:inline-block;background:linear-gradient(135deg,#a855f7 0%,#3b82f6 100%);color:#fff!important;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:700;margin-top:15px;box-shadow:0 4px 14px rgba(168,85,247,.3)}
    .footer{margin-top:30px;border-top:1px solid rgba(255,255,255,.05);padding-top:20px;text-align:center;font-size:12px;color:#6b7280}
  </style>
</head>
<body>
  <div class="container">
    <div style="text-align:center;border-bottom:1px solid rgba(168,85,247,.15);padding-bottom:20px;margin-bottom:25px">
      <div class="logo">StreamMalin</div>
      <div class="title">Merci pour votre confiance !</div>
    </div>
    <p>Bonjour,</p>
    <p>Votre paiement a bien été validé. Votre accès à <strong>${serviceName}</strong> est actif dès maintenant.</p>
    ${recapBlock}
    ${credentialsBlock}
    ${invoiceBlock}
    <p><strong>Besoin d'aide ?</strong> Connectez-vous à votre Espace Client pour utiliser le chat support, ou écrivez-nous à <a href="mailto:hello@streammalin.fr" style="color:#a855f7">hello@streammalin.fr</a>.</p>
    <div style="text-align:center;margin-top:25px">
      <a href="${APP_URL}" class="btn">Accéder à mon Espace Client</a>
    </div>
    <div class="footer">
      <p>&copy; ${new Date().getFullYear()} StreamMalin — Service indépendant édité en micro-entreprise.</p>
      <p>StreamMalin n'est ni affilié, ni partenaire, ni revendeur officiel des plateformes citées.</p>
      <p>Support : hello@streammalin.fr</p>
    </div>
  </div>
</body>
</html>`,
    });

    if (error) {
      console.error('Resend error:', error);
      return { success: false, error };
    }

    console.log(`Email envoyé via Resend: ${data?.id}`);
    return { success: true, messageId: data?.id };
  } catch (err) {
    console.error('Erreur envoi email:', err);
    return { success: false, error: err };
  }
}

export async function sendResetPasswordEmail(toEmail: string, token: string) {
  const resetUrl = `${APP_URL}/?reset=${token}`;

  if (!process.env.RESEND_API_KEY) {
    console.log(`--- [SIMULATION RESET] ${toEmail} -> ${resetUrl}`);
    return { success: true, simulated: true };
  }

  try {
    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: toEmail,
      subject: '🔑 Réinitialisation de votre mot de passe StreamMalin',
      html: `<!DOCTYPE html>
<html>
<head><meta charset="utf-8">
<style>
  body{font-family:'Outfit','Inter',sans-serif;background:#0b0c10;color:#e5e7eb;margin:0;padding:20px}
  .container{max-width:600px;margin:0 auto;background:linear-gradient(135deg,rgba(20,24,33,.95),rgba(10,12,16,.95));border:1px solid rgba(168,85,247,.2);border-radius:16px;padding:30px}
  .logo{font-size:28px;font-weight:800;background:linear-gradient(135deg,#a855f7,#3b82f6);-webkit-background-clip:text;-webkit-text-fill-color:transparent}
  .btn{display:inline-block;background:linear-gradient(135deg,#a855f7,#3b82f6);color:#fff!important;text-decoration:none;padding:14px 28px;border-radius:8px;font-weight:700}
</style></head>
<body>
  <div class="container">
    <div style="text-align:center;margin-bottom:25px"><div class="logo">StreamMalin</div></div>
    <h2 style="color:#fff">Réinitialisation de mot de passe</h2>
    <p>Une demande de réinitialisation a été reçue pour votre compte. Cliquez sur le bouton ci-dessous pour choisir un nouveau mot de passe :</p>
    <div style="text-align:center;margin:30px 0">
      <a href="${resetUrl}" class="btn">🔑 Réinitialiser mon mot de passe</a>
    </div>
    <p style="font-size:13px;color:#9ca3af">Ou copiez ce lien : <br>${resetUrl}</p>
    <p style="font-size:12px;color:#6b7280;margin-top:25px">⏱️ Ce lien expire dans 1 heure. Si vous n'avez pas fait cette demande, ignorez cet email — votre mot de passe ne sera pas modifié.</p>
  </div>
</body>
</html>`,
    });

    if (error) {
      console.error('Resend reset error:', error);
      return { success: false, error };
    }
    return { success: true, messageId: data?.id };
  } catch (err) {
    return { success: false, error: err };
  }
}

export async function sendCancellationEmail(
  toEmail: string,
  serviceName: string,
  orderId: string,
  effectiveAt: Date
) {
  const formattedDate = effectiveAt.toLocaleDateString('fr-FR', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  if (!process.env.RESEND_API_KEY) {
    console.log('--- [SIMULATION EMAIL RÉSILIATION] ---');
    console.log(`To: ${toEmail} | Service: ${serviceName} | Order: ${orderId} | Effective: ${formattedDate}`);
    return { success: true, simulated: true };
  }

  try {
    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: toEmail,
      subject: `🔴 Résiliation de votre abonnement ${serviceName} - StreamMalin`,
      html: `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body{font-family:'Outfit','Inter',sans-serif;background:#0b0c10;color:#e5e7eb;margin:0;padding:20px}
    .container{max-width:600px;margin:0 auto;background:linear-gradient(135deg,rgba(20,24,33,.95),rgba(10,12,16,.95));border:1px solid rgba(168,85,247,.2);border-radius:16px;padding:30px;box-shadow:0 10px 30px rgba(168,85,247,.1)}
    .logo{font-size:28px;font-weight:800;letter-spacing:-.5px;background:linear-gradient(135deg,#a855f7 0%,#3b82f6 100%);-webkit-background-clip:text;-webkit-text-fill-color:transparent}
    .title{font-size:22px;margin-top:10px;font-weight:700;color:#fff}
    .badge{display:inline-block;background:rgba(239,68,68,.15);border:1px solid #ef4444;color:#fca5a5;padding:6px 12px;border-radius:9999px;font-size:14px;font-weight:600;margin-bottom:20px}
    .info-box{background:rgba(15,23,42,.8);border:1px solid rgba(168,85,247,.2);border-radius:12px;padding:20px;margin:25px 0}
    .info-row{display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid rgba(255,255,255,.05)}
    .info-row:last-child{border-bottom:none}
    .info-label{color:#9ca3af;font-size:14px}
    .info-value{color:#e5e7eb;font-size:14px;font-weight:600}
    .date-highlight{background:rgba(239,68,68,.1);border:1px solid rgba(239,68,68,.3);border-radius:8px;padding:12px 16px;margin:20px 0;text-align:center;color:#fca5a5;font-weight:700}
    .notice{background:rgba(59,130,246,.08);border-left:3px solid #3b82f6;padding:12px 16px;border-radius:0 8px 8px 0;margin:20px 0;font-size:14px;color:#93c5fd}
    .btn{display:inline-block;background:linear-gradient(135deg,#a855f7 0%,#3b82f6 100%);color:#fff!important;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:700;margin-top:15px;box-shadow:0 4px 14px rgba(168,85,247,.3)}
    .footer{margin-top:30px;border-top:1px solid rgba(255,255,255,.05);padding-top:20px;text-align:center;font-size:12px;color:#6b7280}
  </style>
</head>
<body>
  <div class="container">
    <div style="text-align:center;border-bottom:1px solid rgba(168,85,247,.15);padding-bottom:20px;margin-bottom:25px">
      <div class="logo">StreamMalin</div>
      <div class="title">Résiliation confirmée</div>
    </div>
    <p>Bonjour,</p>
    <p>Nous avons bien reçu votre demande de résiliation pour votre abonnement <strong>${serviceName}</strong>. Cette résiliation a été prise en compte sans aucun engagement ni frais supplémentaires.</p>
    <div style="text-align:center"><span class="badge">🔴 Résiliation en cours</span></div>
    <div class="date-highlight">
      Date effective de résiliation : ${formattedDate}
    </div>
    <div class="notice">
      ℹ️ <strong>Bon à savoir :</strong> Votre accès à <strong>${serviceName}</strong> reste entièrement actif jusqu'à cette date. Vous pouvez continuer à profiter de votre abonnement normalement.
    </div>
    <div class="info-box">
      <div class="info-row">
        <span class="info-label">Service résilié</span>
        <span class="info-value">${serviceName}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Numéro de commande</span>
        <span class="info-value">${orderId}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Date effective de résiliation</span>
        <span class="info-value">${formattedDate}</span>
      </div>
    </div>
    <p>Si vous avez des questions concernant votre résiliation, connectez-vous à votre Espace Client et contactez notre support.</p>
    <div style="text-align:center;margin-top:25px">
      <a href="${APP_URL}" class="btn">Accéder à mon Espace Client</a>
    </div>
    <div class="footer">
      <p>&copy; ${new Date().getFullYear()} StreamMalin. Tous droits réservés.</p>
      <p>Email automatique — merci de ne pas répondre directement.</p>
    </div>
  </div>
</body>
</html>`,
    });

    if (error) {
      console.error('Resend cancellation error:', error);
      return { success: false, error };
    }

    console.log(`Email résiliation envoyé via Resend: ${data?.id}`);
    return { success: true, messageId: data?.id };
  } catch (err) {
    console.error('Erreur envoi email résiliation:', err);
    return { success: false, error: err };
  }
}

// reminderLevel: 1 = premier rappel, 2 = rappel urgent, 3 = dernier avertissement (24h)
export async function sendUnpaidReminderEmail(
  toEmail: string,
  serviceName: string,
  orderId: string,
  reminderLevel: 1 | 2 | 3
) {
  const subjects: Record<number, string> = {
    1: `⚠️ Paiement en attente pour ${serviceName} - StreamMalin`,
    2: `🔔 Rappel urgent : régularisez votre abonnement ${serviceName}`,
    3: `🔴 DERNIER AVERTISSEMENT — résiliation dans 24h (${serviceName})`,
  };
  const colors: Record<number, string> = { 1: '#f59e0b', 2: '#f97316', 3: '#ef4444' };
  const icons: Record<number, string> = { 1: '⚠️', 2: '🔔', 3: '🔴' };
  const bodies: Record<number, string> = {
    1: `Nous n'avons pas encore reçu votre paiement pour <strong>${serviceName}</strong>. Merci de régulariser votre situation dans les meilleurs délais pour conserver votre accès.`,
    2: `Votre paiement pour <strong>${serviceName}</strong> est toujours en attente. Sans régularisation rapide, votre abonnement risque d'être suspendu.`,
    3: `C'est votre dernier avertissement. Si le paiement pour <strong>${serviceName}</strong> n'est pas régularisé dans les <strong>24 heures</strong>, votre abonnement sera automatiquement <strong>résilié</strong> et votre accès révoqué.`,
  };

  if (!process.env.RESEND_API_KEY) {
    console.log(`--- [SIMULATION RAPPEL ${reminderLevel}] ${toEmail} | ${serviceName}`);
    return { success: true, simulated: true };
  }

  try {
    const color = colors[reminderLevel];
    const icon = icons[reminderLevel];
    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: toEmail,
      subject: subjects[reminderLevel],
      html: `<!DOCTYPE html>
<html>
<head><meta charset="utf-8">
<style>
  body{font-family:'Outfit','Inter',sans-serif;background:#0b0c10;color:#e5e7eb;margin:0;padding:20px}
  .container{max-width:600px;margin:0 auto;background:linear-gradient(135deg,rgba(20,24,33,.95),rgba(10,12,16,.95));border:1px solid ${color}44;border-radius:16px;padding:30px}
  .logo{font-size:28px;font-weight:800;background:linear-gradient(135deg,#a855f7,#3b82f6);-webkit-background-clip:text;-webkit-text-fill-color:transparent}
  .alert{background:${color}18;border:1px solid ${color}55;border-radius:12px;padding:18px 20px;margin:20px 0;font-size:15px;line-height:1.7}
  .btn{display:inline-block;background:${color};color:#fff!important;text-decoration:none;padding:14px 28px;border-radius:8px;font-weight:700;margin-top:8px}
  .footer{margin-top:28px;border-top:1px solid rgba(255,255,255,.05);padding-top:18px;text-align:center;font-size:12px;color:#6b7280}
</style></head>
<body>
  <div class="container">
    <div style="text-align:center;margin-bottom:22px"><div class="logo">StreamMalin</div></div>
    <h2 style="color:#fff;font-size:20px">${icon} ${reminderLevel === 3 ? 'Dernier avertissement' : 'Paiement en attente'}</h2>
    <div class="alert">${bodies[reminderLevel]}</div>
    <p style="font-size:0.88rem;color:#9ca3af">Commande : <code style="color:#e5e7eb">${orderId}</code></p>
    <p style="font-size:0.9rem;line-height:1.7">Pour régulariser, effectuez votre paiement via PayPal (Biens et Services) à l'adresse <strong style="color:#e5e7eb">novateurlabeille@gmail.com</strong> en indiquant votre numéro de commande.</p>
    <div style="text-align:center;margin-top:22px">
      <a href="${APP_URL}" class="btn">Accéder à mon Espace Client</a>
    </div>
    <div class="footer">
      <p>&copy; ${new Date().getFullYear()} StreamMalin. Tous droits réservés.</p>
    </div>
  </div>
</body>
</html>`,
    });
    if (error) return { success: false, error };
    return { success: true, messageId: data?.id };
  } catch (err) {
    console.error('Erreur envoi email rappel impayé:', err);
    return { success: false, error: err };
  }
}

export async function sendVerificationEmail(toEmail: string, token: string) {
  const verifyUrl = `${APP_URL}/api/client/verify?token=${token}`;

  if (!process.env.RESEND_API_KEY) {
    console.log(`--- [SIMULATION VERIFICATION] ${toEmail} -> ${verifyUrl}`);
    return { success: true, simulated: true };
  }

  try {
    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: toEmail,
      subject: '✅ Confirmez votre compte StreamMalin',
      html: `<!DOCTYPE html>
<html>
<head><meta charset="utf-8">
<style>
  body{font-family:'Outfit','Inter',sans-serif;background:#0b0c10;color:#e5e7eb;margin:0;padding:20px}
  .container{max-width:600px;margin:0 auto;background:linear-gradient(135deg,rgba(20,24,33,.95),rgba(10,12,16,.95));border:1px solid rgba(168,85,247,.2);border-radius:16px;padding:30px}
  .logo{font-size:28px;font-weight:800;background:linear-gradient(135deg,#a855f7,#3b82f6);-webkit-background-clip:text;-webkit-text-fill-color:transparent}
  .btn{display:inline-block;background:linear-gradient(135deg,#a855f7,#3b82f6);color:#fff!important;text-decoration:none;padding:14px 28px;border-radius:8px;font-weight:700}
</style></head>
<body>
  <div class="container">
    <div style="text-align:center;margin-bottom:25px"><div class="logo">StreamMalin</div></div>
    <h2 style="color:#fff">Bienvenue sur StreamMalin !</h2>
    <p>Pour activer votre compte client et accéder à vos abonnements, cliquez sur le bouton ci-dessous :</p>
    <div style="text-align:center;margin:30px 0">
      <a href="${verifyUrl}" class="btn">✅ Confirmer mon adresse email</a>
    </div>
    <p style="font-size:13px;color:#9ca3af">Ou copiez ce lien : <br>${verifyUrl}</p>
    <p style="font-size:12px;color:#6b7280;margin-top:25px">Si vous n'avez pas créé de compte StreamMalin, ignorez cet email.</p>
  </div>
</body>
</html>`,
    });

    if (error) {
      console.error('Resend verify error:', error);
      return { success: false, error };
    }
    return { success: true, messageId: data?.id };
  } catch (err) {
    return { success: false, error: err };
  }
}

export async function sendEmailChangeVerificationEmail(toEmail: string, token: string) {
  const verifyUrl = `${APP_URL}/api/client/verify-email-change?token=${token}`;

  if (!process.env.RESEND_API_KEY) {
    console.log(`--- [SIMULATION EMAIL CHANGE] ${toEmail} -> ${verifyUrl}`);
    return { success: true, simulated: true };
  }

  try {
    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: toEmail,
      subject: '📧 Confirmez votre nouvelle adresse email — StreamMalin',
      html: `<!DOCTYPE html>
<html>
<head><meta charset="utf-8">
<style>
  body{font-family:'Outfit','Inter',sans-serif;background:#0b0c10;color:#e5e7eb;margin:0;padding:20px}
  .container{max-width:600px;margin:0 auto;background:linear-gradient(135deg,rgba(20,24,33,.95),rgba(10,12,16,.95));border:1px solid rgba(168,85,247,.2);border-radius:16px;padding:30px}
  .logo{font-size:28px;font-weight:800;background:linear-gradient(135deg,#a855f7,#3b82f6);-webkit-background-clip:text;-webkit-text-fill-color:transparent}
  .btn{display:inline-block;background:linear-gradient(135deg,#a855f7,#3b82f6);color:#fff!important;text-decoration:none;padding:14px 28px;border-radius:8px;font-weight:700}
</style></head>
<body>
  <div class="container">
    <div style="text-align:center;margin-bottom:25px"><div class="logo">StreamMalin</div></div>
    <h2 style="color:#fff">Confirmez votre nouvelle adresse email</h2>
    <p>Pour finaliser le changement d&apos;adresse email de votre compte StreamMalin, cliquez sur le bouton ci-dessous. Ce lien est valable <strong style="color:#fff">24 heures</strong>.</p>
    <div style="text-align:center;margin:30px 0">
      <a href="${verifyUrl}" class="btn">✅ Confirmer mon nouvel email</a>
    </div>
    <p style="font-size:13px;color:#9ca3af">Ou copiez ce lien : <br>${verifyUrl}</p>
    <p style="font-size:12px;color:#6b7280;margin-top:25px">Si vous n&apos;avez pas demandé ce changement, ignorez cet email. Votre adresse actuelle reste inchangée.</p>
  </div>
</body>
</html>`,
    });
    if (error) return { success: false, error };
    return { success: true, messageId: data?.id };
  } catch (err) {
    return { success: false, error: err };
  }
}

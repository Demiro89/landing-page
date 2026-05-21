import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM_EMAIL = 'StreamMalin <noreply@streammalin.fr>';
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://streammalin.fr';

export async function sendOrderDetailsEmail(
  toEmail: string,
  serviceName: string,
  details: string,
  orderId: string
) {
  if (!process.env.RESEND_API_KEY) {
    console.log('--- [SIMULATION EMAIL] ---');
    console.log(`To: ${toEmail} | Service: ${serviceName} | Order: ${orderId}`);
    console.log(details);
    return { success: true, simulated: true };
  }

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
    <p>Votre paiement a été validé. Votre abonnement à <strong>${serviceName}</strong> est actif dès maintenant.</p>
    <div style="text-align:center"><span class="badge">Commande : ${orderId}</span></div>
    <p>Vos identifiants d'accès :</p>
    <div class="creds">${details}</div>
    <p><strong>Besoin d'aide ?</strong> Connectez-vous à votre Espace Client et utilisez le chat support.</p>
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

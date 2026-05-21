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

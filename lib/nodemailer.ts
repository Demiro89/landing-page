import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: process.env.SMTP_PORT === '465', // true for 465, false for other ports
  auth: {
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
  },
});

/**
 * Envoie un email transactionnel premium contenant les identifiants d'accès au client.
 */
export async function sendOrderDetailsEmail(
  toEmail: string,
  serviceName: string,
  details: string,
  orderId: string
) {
  const fromEmail = process.env.SMTP_FROM || '"StreamMalin" <noreply@streammalin.com>';

  const mailOptions = {
    from: fromEmail,
    to: toEmail,
    subject: `⚡ Vos accès à ${serviceName} sont prêts ! - StreamMalin`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body {
            font-family: 'Outfit', 'Inter', sans-serif;
            background-color: #0b0c10;
            color: #e5e7eb;
            margin: 0;
            padding: 20px;
          }
          .container {
            max-width: 600px;
            margin: 0 auto;
            background: linear-gradient(135deg, rgba(20, 24, 33, 0.95), rgba(10, 12, 16, 0.95));
            border: 1px solid rgba(168, 85, 247, 0.2);
            border-radius: 16px;
            padding: 30px;
            box-shadow: 0 10px 30px rgba(168, 85, 247, 0.1);
          }
          .header {
            text-align: center;
            border-bottom: 1px solid rgba(168, 85, 247, 0.15);
            padding-bottom: 20px;
            margin-bottom: 25px;
          }
          .logo {
            font-size: 28px;
            font-weight: 800;
            letter-spacing: -0.5px;
            background: linear-gradient(135deg, #a855f7 0%, #3b82f6 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
          }
          .title {
            font-size: 22px;
            margin-top: 10px;
            font-weight: 700;
            color: #ffffff;
          }
          .badge {
            display: inline-block;
            background: rgba(168, 85, 247, 0.15);
            border: 1px solid #a855f7;
            color: #e9d5ff;
            padding: 6px 12px;
            border-radius: 9999px;
            font-size: 14px;
            font-weight: 600;
            margin-bottom: 20px;
          }
          .content {
            line-height: 1.6;
            font-size: 16px;
          }
          .credentials-box {
            background: rgba(15, 23, 42, 0.8);
            border: 1px dashed rgba(59, 130, 246, 0.4);
            border-radius: 12px;
            padding: 20px;
            margin: 25px 0;
            font-family: 'Courier New', Courier, monospace;
            font-size: 15px;
            color: #3b82f6;
            white-space: pre-wrap;
            word-break: break-all;
          }
          .footer {
            margin-top: 30px;
            border-top: 1px solid rgba(255, 255, 255, 0.05);
            padding-top: 20px;
            text-align: center;
            font-size: 12px;
            color: #6b7280;
          }
          .btn {
            display: inline-block;
            background: linear-gradient(135deg, #a855f7 0%, #3b82f6 100%);
            color: #ffffff !important;
            text-decoration: none;
            padding: 12px 24px;
            border-radius: 8px;
            font-weight: 700;
            text-align: center;
            margin-top: 15px;
            box-shadow: 0 4px 14px rgba(168, 85, 247, 0.3);
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="logo">StreamMalin</div>
            <div class="title">Merci pour votre confiance !</div>
          </div>
          <div class="content">
            <p>Bonjour,</p>
            <p>Votre paiement a été validé avec succès. Votre abonnement à <strong>${serviceName}</strong> est actif dès maintenant.</p>
            
            <div style="text-align: center;">
              <span class="badge">Numéro de Commande : ${orderId}</span>
            </div>

            <p>Voici vos identifiants d'accès ou les instructions de connexion :</p>
            
            <div class="credentials-box">${details}</div>

            <p><strong>Des questions ou besoin d'assistance ?</strong></p>
            <p>Vous pouvez vous connecter à votre Espace Client sur StreamMalin en utilisant votre adresse email et échanger en temps réel avec notre équipe support via le chat intégré.</p>
            
            <div style="text-align: center; margin-top: 25px;">
              <a href="${process.env.NEXT_PUBLIC_APP_URL || 'https://streammalin.com'}" class="btn">Accéder à mon Espace Client</a>
            </div>
          </div>
          <div class="footer">
            <p>&copy; ${new Date().getFullYear()} StreamMalin. Tous droits réservés.</p>
            <p>Cet e-mail est généré automatiquement, merci de ne pas y répondre directement.</p>
          </div>
        </div>
      </body>
      </html>
    `,
  };

  try {
    // Si aucun SMTP_USER n'est défini, on simule l'envoi en log pour faciliter les tests hors prod.
    if (!process.env.SMTP_USER) {
      console.log('--- [SIMULATION NODEMAILER EMAIL ENVOYÉ] ---');
      console.log(`To: ${toEmail}`);
      console.log(`Subject: ${mailOptions.subject}`);
      console.log(`Content:\n${details}`);
      console.log('---------------------------------------------');
      return { success: true, simulated: true };
    }

    const info = await transporter.sendMail(mailOptions);
    console.log(`Email de commande envoyé avec succès: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error("Erreur lors de l'envoi de l'email transactionnel:", error);
    // On ne bloque pas tout le flux si l'e-mail échoue, mais on l'enregistre
    return { success: false, error };
  }
}

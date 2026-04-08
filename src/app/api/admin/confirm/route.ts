/**
 * GET /api/admin/confirm?orderId=XXX&token=YYY
 *
 * Confirme une commande manuellement (appelé par l'admin via le lien Telegram).
 * - Vérifie le token admin
 * - Dispatch un slot Disney+ si applicable
 * - Met le statut à ACTIVE
 * - Notifie l'admin via Telegram
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { dispatchSlot } from '@/lib/dispatch';
import { notifyOrderConfirmed } from '@/lib/telegram';
import { sendOrderConfirmed } from '@/lib/email';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const orderId = searchParams.get('orderId');
  const token = searchParams.get('token');
  const adminToken = process.env.ADMIN_SECRET_TOKEN;

  // ── Auth ──
  if (!adminToken || token !== adminToken) {
    return new Response(renderHtml('❌ Non autorisé', 'Token invalide.', '#ff3b3b'), {
      status: 401,
      headers: { 'Content-Type': 'text/html' },
    });
  }

  if (!orderId) {
    return new Response(renderHtml('❌ Erreur', 'orderId manquant.', '#ff3b3b'), {
      status: 400,
      headers: { 'Content-Type': 'text/html' },
    });
  }

  try {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { user: true, slot: { include: { masterAccount: true } } },
    });

    if (!order) {
      return new Response(renderHtml('❌ Introuvable', 'Commande inexistante.', '#ff3b3b'), {
        status: 404,
        headers: { 'Content-Type': 'text/html' },
      });
    }

    if (order.status === 'ACTIVE') {
      return new Response(
        renderHtml('ℹ️ Déjà confirmé', `La commande ${orderId.slice(0, 12)} est déjà active.`, '#f59e0b'),
        { status: 200, headers: { 'Content-Type': 'text/html' } }
      );
    }

    if (!['PENDING', 'PAYMENT_DECLARED', 'CONFIRMED'].includes(order.status)) {
      return new Response(
        renderHtml(
          '❌ Statut invalide',
          `Impossible de confirmer une commande avec le statut "${order.status}".`,
          '#ff3b3b'
        ),
        { status: 400, headers: { 'Content-Type': 'text/html' } }
      );
    }

    let slotInfo: {
      masterEmail: string;
      masterPassword: string;
      profileNumber: number;
      pinCode?: string;
    } | undefined;

    // ── Dispatch slot (tous les services) ──
    // Pour les services avec slots (Disney+, YouTube avec comptes maîtres, etc.)
    if (!order.slotId) {
      const slot = await dispatchSlot(orderId, order.service);

      if (!slot) {
        return new Response(
          renderHtml(
            '⚠️ Stock épuisé',
            `Aucun slot disponible pour ${order.service}. Ajoutez des comptes maîtres !`,
            '#f59e0b'
          ),
          { status: 409, headers: { 'Content-Type': 'text/html' } }
        );
      }

      // slotInfo uniquement pour les services nécessitant des identifiants (Disney+)
      const isDisney = order.service.toUpperCase().startsWith('DISNEY');
      if (isDisney) {
        slotInfo = {
          masterEmail: slot.masterAccount.email,
          masterPassword: slot.masterAccount.password ?? '',
          profileNumber: slot.profileNumber,
          pinCode: slot.pinCode ?? undefined,
        };
      }
    } else if (order.service.toUpperCase().startsWith('DISNEY') && order.slot) {
      // Slot déjà assigné — récupérer les infos pour l'email
      slotInfo = {
        masterEmail: order.slot.masterAccount.email,
        masterPassword: order.slot.masterAccount.password ?? '',
        profileNumber: order.slot.profileNumber,
        pinCode: order.slot.pinCode ?? undefined,
      };
    }

    // ── Update order status ──
    await prisma.order.update({
      where: { id: orderId },
      data: { status: 'ACTIVE' },
    });

    // ── Telegram notification ──
    await notifyOrderConfirmed({
      orderId,
      email: order.user.email,
      service: order.service as 'YOUTUBE' | 'DISNEY',
      slotInfo,
    });

    // ── Email confirmation ──
    await sendOrderConfirmed({
      to: order.user.email,
      orderId,
      service: order.service as 'YOUTUBE' | 'DISNEY',
      expiresAt: order.expiresAt ?? undefined,
      disneyAccess: slotInfo
        ? {
            email: slotInfo.masterEmail,
            password: slotInfo.masterPassword,
            profileNumber: slotInfo.profileNumber,
            pinCode: slotInfo.pinCode,
          }
        : undefined,
    });

    const isDisney = order.service.toUpperCase().startsWith('DISNEY');
    const successMsg = isDisney
      ? `Slot attribué : ${slotInfo?.masterEmail} / Profil ${slotInfo?.profileNumber}`
      : `Commande ${order.service} activée · Gmail : ${order.gmail ?? 'N/A'}`;

    return new Response(
      renderHtml(
        '✅ Commande activée !',
        `${successMsg}<br/><br/>Order ID: ${orderId}`,
        '#00ffaa'
      ),
      { status: 200, headers: { 'Content-Type': 'text/html' } }
    );
  } catch (error) {
    console.error('[GET /api/admin/confirm]', error);
    return new Response(
      renderHtml('❌ Erreur serveur', 'Une erreur interne est survenue.', '#ff3b3b'),
      { status: 500, headers: { 'Content-Type': 'text/html' } }
    );
  }
}

// ── Simple HTML response for admin actions ──
function renderHtml(title: string, message: string, color: string): string {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>StreamMalin Admin — ${title}</title>
  <style>
    body { font-family: system-ui, sans-serif; background: #0a0a0f; color: #f0f0f5; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; }
    .box { background: #12121a; border: 1px solid #1e1e2e; border-radius: 16px; padding: 32px; max-width: 480px; text-align: center; }
    h1 { font-size: 1.5rem; margin-bottom: 12px; color: ${color}; }
    p { color: #8888aa; line-height: 1.6; font-size: 0.9rem; }
    a { color: #3b82f6; text-decoration: none; }
  </style>
</head>
<body>
  <div class="box">
    <h1>${title}</h1>
    <p>${message}</p>
    <p style="margin-top:20px"><a href="/">← Retour à StreamMalin</a></p>
  </div>
</body>
</html>`;
}

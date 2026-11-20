import React from 'react';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { COMPANY, CURRENT_VAT_EXEMPTION_TEXT } from '@/lib/legalConfig';
import { getCurrentCustomer } from '@/lib/clientAuth';
import { isAdminAuthenticated } from '@/lib/adminAuth';
import PrintButton from '@/components/PrintButton';
import { ownsOrder } from '@/lib/orderAccess';
import { formatEuro } from '@/lib/offerPresentation';

export const dynamic = 'force-dynamic';

const fmt = formatEuro;
const fmtDate = (d: Date) =>
  new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });

export default async function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  // Contrôle d'accès AVANT toute requête : on n'interroge la base que si le
  // demandeur est admin ou un client authentifié. Cela évite tout oracle
  // d'existence (timing / différence de réponse) sur des IDs de factures énumérables.
  const isAdmin = await isAdminAuthenticated();
  const customer = isAdmin ? null : await getCurrentCustomer();
  if (!isAdmin && !customer) redirect('/espace-client');

  const invoice = await prisma.invoice.findUnique({
    where: { id },
    include: { order: true },
  });
  if (!invoice) notFound();

  // Contrôle de propriété : seul l'admin ou le client propriétaire peut voir la facture.
  if (!isAdmin && customer) {
    const owns = ownsOrder(invoice.order, customer);
    // On renvoie un 404 plutôt qu'un 403 pour ne pas révéler l'existence de la facture.
    if (!owns) notFound();
  }

  return (
    <main className="invoice-screen">
      <style>{`
        .invoice-screen { background: #f6f2ea; min-height: 100vh; padding: 34px 16px; color: #161412; }
        .invoice-toolbar { max-width: 800px; margin: 0 auto 18px; display: flex; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
        .invoice-print-btn, .invoice-home-link {
          font-family: var(--font-sans), system-ui, sans-serif; font-size: 14px; font-weight: 600;
          padding: 10px 18px; border-radius: 10px; cursor: pointer; border: none; text-decoration: none;
          min-height: 44px; display: inline-flex; align-items: center;
        }
        .invoice-print-btn { background: #161412; color: #fffdf9; }
        .invoice-print-btn:hover { background: #c4452b; }
        .invoice-home-link { background: #fffdf9; color: #161412; border: 1px solid #c9c0b1; }
        .invoice-sheet {
          max-width: 800px; margin: 0 auto; background: #fffdf9; color: #161412;
          font-family: var(--font-sans), 'Helvetica Neue', Arial, sans-serif; padding: 48px 52px;
          box-shadow: 0 8px 30px rgba(22, 20, 18, 0.07); border: 1px solid #dfd8cb; border-radius: 16px;
        }
        .invoice-sheet h1 { font-family: var(--font-display), system-ui, sans-serif; font-size: 26px; margin: 0; letter-spacing: -0.02em; }
        .inv-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; flex-wrap: wrap; border-bottom: 2px solid #161412; padding-bottom: 20px; margin-bottom: 24px; }
        .inv-brand { font-family: var(--font-display), system-ui, sans-serif; font-size: 22px; font-weight: 800; color: #c4452b; letter-spacing: -0.02em; }
        .inv-meta { text-align: right; font-size: 13px; color: #5c564e; line-height: 1.6; }
        .inv-parties { display: flex; gap: 32px; flex-wrap: wrap; margin-bottom: 28px; }
        .inv-party { flex: 1 1 240px; min-width: 0; }
        .inv-party-label { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: #5c564e; margin-bottom: 6px; }
        .inv-party p { margin: 2px 0; font-size: 13px; line-height: 1.55; color: #161412; overflow-wrap: anywhere; }
        .inv-table-wrap { width: 100%; overflow-x: auto; margin-bottom: 22px; }
        .inv-table { width: 100%; min-width: 480px; border-collapse: collapse; }
        .inv-table th { background: #161412; color: #fffdf9; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; padding: 10px 12px; text-align: left; }
        .inv-table th.num, .inv-table td.num { text-align: right; }
        .inv-table td { padding: 12px; font-size: 13px; border-bottom: 1px solid #dfd8cb; color: #161412; }
        .inv-totals { margin-left: auto; width: 280px; max-width: 100%; }
        .inv-totals .row { display: flex; justify-content: space-between; padding: 7px 0; font-size: 13px; color: #38332d; }
        .inv-totals .row.grand { border-top: 2px solid #161412; margin-top: 6px; padding-top: 12px; font-size: 16px; font-weight: 800; }
        .inv-note { margin-top: 26px; padding: 14px 16px; background: #fbeee9; border-left: 3px solid #c4452b; border-radius: 0 10px 10px 0; font-size: 12px; color: #38332d; line-height: 1.6; }
        .inv-footer { margin-top: 28px; border-top: 1px solid #dfd8cb; padding-top: 16px; font-size: 11px; color: #5c564e; line-height: 1.6; text-align: center; }
        .inv-status { display: inline-block; background: #e9f4ee; color: #1e5c42; font-size: 12px; font-weight: 700; padding: 4px 12px; border-radius: 999px; }
        @media (max-width: 640px) {
          .invoice-screen { padding: 16px 12px; }
          .invoice-sheet { padding: 22px 18px; }
          .inv-meta { text-align: left; }
          .inv-totals { width: 100%; }
        }
        @media print {
          .invoice-screen { background: #fff; padding: 0; }
          .invoice-toolbar { display: none; }
          .invoice-sheet { box-shadow: none; border: none; max-width: 100%; padding: 24px; background: #fff; }
        }
      `}</style>

      <div className="invoice-toolbar">
        <Link href="/" className="invoice-home-link">← Retour à StreamMalin</Link>
        <PrintButton />
      </div>

      <div className="invoice-sheet">
        <div className="inv-head">
          <div>
            <div className="inv-brand">StreamMalin</div>
            <h1 style={{ marginTop: 8, fontSize: 20 }}>Facture</h1>
          </div>
          <div className="inv-meta">
            <div><strong>N° {invoice.number}</strong></div>
            <div>Date d&apos;émission : {fmtDate(invoice.issuedAt)}</div>
            <div>Date de paiement : {fmtDate(invoice.paidAt)}</div>
            <div style={{ marginTop: 6 }}><span className="inv-status">✓ {invoice.status}</span></div>
          </div>
        </div>

        <div className="inv-parties">
          <div className="inv-party">
            <div className="inv-party-label">Vendeur</div>
            <p><strong>{COMPANY.legalName}</strong></p>
            <p>Nom commercial : {COMPANY.brandName}</p>
            <p>{COMPANY.status}</p>
            <p>SIREN : {COMPANY.siren}{COMPANY.siret ? ` — SIRET : ${COMPANY.siret}` : ''}</p>
            <p>{COMPANY.rcs}</p>
            <p>{COMPANY.address}</p>
            <p>{COMPANY.email}</p>
          </div>
          <div className="inv-party">
            <div className="inv-party-label">Client</div>
            {invoice.clientName && <p><strong>{invoice.clientName}</strong></p>}
            <p>{invoice.clientEmail}</p>
            {invoice.clientAddress && <p>{invoice.clientAddress}</p>}
          </div>
        </div>

        <div className="inv-table-wrap">
          <table className="inv-table">
            <thead>
              <tr>
                <th>Description</th>
                <th className="num">Qté</th>
                <th className="num">Prix unitaire HT</th>
                <th className="num">Total HT</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>{invoice.description}</td>
                <td className="num">{invoice.quantity}</td>
                <td className="num">{fmt(invoice.unitPriceHT)}</td>
                <td className="num">{fmt(invoice.totalHT)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="inv-totals">
          <div className="row"><span>Total HT</span><span>{fmt(invoice.totalHT)}</span></div>
          <div className="row"><span>TVA</span><span>{fmt(invoice.vatAmount)}</span></div>
          <div className="row grand"><span>Total à payer</span><span>{fmt(invoice.totalTTC)}</span></div>
        </div>

        <div className="inv-note">
          <div><strong>{CURRENT_VAT_EXEMPTION_TEXT}.</strong></div>
          <div>Mode de paiement : {invoice.paymentMethod}.</div>
          <div>
            Prestation : mise à disposition temporaire d&apos;un accès numérique pour la durée indiquée.
            Le présent document ne constitue pas la vente d&apos;un abonnement, d&apos;un compte ou
            d&apos;un droit de propriété.
          </div>
        </div>

        <div className="inv-footer">
          <div>StreamMalin — {COMPANY.legalName} — {COMPANY.email}</div>
          <div>StreamMalin est un service indépendant, non affilié aux plateformes citées.</div>
        </div>
      </div>
    </main>
  );
}

import React from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { COMPANY, CURRENT_VAT_EXEMPTION_TEXT } from '@/lib/legalConfig';
import PrintButton from '@/components/PrintButton';

export const dynamic = 'force-dynamic';

const fmt = (n: number) => `${n.toFixed(2)} €`;
const fmtDate = (d: Date) =>
  new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });

export default async function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const invoice = await prisma.invoice.findUnique({ where: { id } });
  if (!invoice) notFound();

  return (
    <div className="invoice-screen">
      <style>{`
        .invoice-screen { background: #f1f1f4; min-height: 100vh; padding: 32px 16px; }
        .invoice-toolbar { max-width: 800px; margin: 0 auto 18px; display: flex; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
        .invoice-print-btn, .invoice-home-link {
          font-family: system-ui, sans-serif; font-size: 14px; font-weight: 600;
          padding: 10px 18px; border-radius: 8px; cursor: pointer; border: none; text-decoration: none;
        }
        .invoice-print-btn { background: #7c3aed; color: #fff; }
        .invoice-home-link { background: #fff; color: #333; border: 1px solid #ddd; display: inline-flex; align-items: center; }
        .invoice-sheet {
          max-width: 800px; margin: 0 auto; background: #fff; color: #1a1a1a;
          font-family: 'Helvetica Neue', Arial, sans-serif; padding: 48px 52px;
          box-shadow: 0 8px 30px rgba(0,0,0,0.12); border-radius: 4px;
        }
        .invoice-sheet h1 { font-size: 26px; margin: 0; letter-spacing: -0.5px; }
        .inv-head { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #1a1a1a; padding-bottom: 20px; margin-bottom: 24px; }
        .inv-brand { font-size: 22px; font-weight: 800; color: #7c3aed; }
        .inv-meta { text-align: right; font-size: 13px; color: #444; line-height: 1.6; }
        .inv-parties { display: flex; gap: 32px; margin-bottom: 28px; }
        .inv-party { flex: 1; }
        .inv-party-label { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: #888; margin-bottom: 6px; }
        .inv-party p { margin: 2px 0; font-size: 13px; line-height: 1.55; color: #222; }
        .inv-table { width: 100%; border-collapse: collapse; margin-bottom: 22px; }
        .inv-table th { background: #1a1a1a; color: #fff; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; padding: 10px 12px; text-align: left; }
        .inv-table th.num, .inv-table td.num { text-align: right; }
        .inv-table td { padding: 12px; font-size: 13px; border-bottom: 1px solid #eee; color: #222; }
        .inv-totals { margin-left: auto; width: 280px; }
        .inv-totals .row { display: flex; justify-content: space-between; padding: 7px 0; font-size: 13px; color: #333; }
        .inv-totals .row.grand { border-top: 2px solid #1a1a1a; margin-top: 6px; padding-top: 12px; font-size: 16px; font-weight: 800; }
        .inv-note { margin-top: 26px; padding: 14px 16px; background: #f6f4ff; border-left: 3px solid #7c3aed; font-size: 12px; color: #444; line-height: 1.6; }
        .inv-footer { margin-top: 28px; border-top: 1px solid #eee; padding-top: 16px; font-size: 11px; color: #888; line-height: 1.6; text-align: center; }
        .inv-status { display: inline-block; background: #dcfce7; color: #15803d; font-size: 12px; font-weight: 700; padding: 4px 12px; border-radius: 50px; }
        @media print {
          .invoice-screen { background: #fff; padding: 0; }
          .invoice-toolbar { display: none; }
          .invoice-sheet { box-shadow: none; max-width: 100%; padding: 24px; }
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
            <p>SIREN / SIRET : {COMPANY.siren} / {COMPANY.siret}</p>
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
    </div>
  );
}

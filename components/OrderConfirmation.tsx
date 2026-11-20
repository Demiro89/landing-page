'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { AlertTriangle, CheckCircle2, Clock, Mail, RefreshCw, UserRound } from 'lucide-react';
import { formatEuro } from '@/lib/offerPresentation';

type Receipt = { status: string; orderId?: string; offer?: string; amount?: number };
const MESSAGES: Record<string, string> = {
  awaiting_payment: 'Le paiement n’est pas encore confirmé. Aucun accès n’est transmis avant sa validation.',
  processing: 'Votre paiement est confirmé. La commande et la transmission de vos accès sont en cours de traitement.',
  sent: 'Votre paiement est confirmé. Le prestataire d’e-mail a accepté le message contenant le suivi de votre accès. Vérifiez votre boîte de réception et vos courriers indésirables.',
  needs_review: 'Votre paiement a été reçu, mais l’accès n’a pas pu être attribué. Le support doit résoudre la situation et vérifier le remboursement ; ne repassez pas de commande.',
  cancelled: 'Cette commande a été annulée. Contactez le support pour vérifier son suivi.',
};

const BADGE_META: Record<string, { label: string; tone: string }> = {
  sent: { label: 'Commande confirmée', tone: 'is-success' },
  processing: { label: 'Traitement en cours', tone: '' },
  awaiting_payment: { label: 'En attente de confirmation', tone: 'is-warning' },
  needs_review: { label: 'Vérification requise', tone: 'is-danger' },
  cancelled: { label: 'Commande annulée', tone: 'is-danger' },
};

export default function OrderConfirmation() {
  const params = useSearchParams();
  const [sessionId] = useState(params.get('session_id') || '');
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [error, setError] = useState('');
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    window.history.replaceState(null, '', '/commande/confirmee');
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    let tries = 0;
    const check = async () => {
      try {
        if (!sessionId) throw new Error('Cette confirmation ne contient pas de référence Stripe. Consultez votre e-mail ou votre espace client.');
        const response = await fetch('/api/checkout/confirmation', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sessionId }), signal: controller.signal });
        const data = await response.json();
        if (!response.ok || !data.success) throw new Error(data.error || 'La confirmation n’a pas pu être chargée.');
        setReceipt(data); setError('');
        if (data.status === 'processing' && ++tries < 6) timer = setTimeout(check, 5000);
      } catch (failure) { if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : 'Connexion indisponible.'); }
    };
    void check();
    return () => { controller.abort(); clearTimeout(timer); };
  }, [sessionId, refresh]);

  const meta = receipt ? (BADGE_META[receipt.status] || { label: 'Suivi de commande', tone: '' }) : { label: 'Vérification en cours', tone: '' };
  const toneClass = error ? 'is-danger' : meta.tone;

  return (
    <div className="confirmation-card">
      <span className={`confirmation-badge ${toneClass}`}>
        {error || receipt?.status === 'needs_review' || receipt?.status === 'cancelled'
          ? <AlertTriangle size={15} aria-hidden="true" />
          : receipt?.status === 'sent'
            ? <CheckCircle2 size={15} aria-hidden="true" />
            : <Clock size={15} aria-hidden="true" />}
        {error ? 'Vérification impossible' : meta.label}
      </span>

      <h1>Suivi de votre commande</h1>

      {error ? (
        <p className="confirmation-status-copy" role="alert">{error}</p>
      ) : (
        <p className="confirmation-status-copy" role="status">{receipt ? MESSAGES[receipt.status] : 'Vérification de votre paiement…'}</p>
      )}

      {receipt?.orderId && (
        <dl className="confirmation-dl">
          <div>
            <dt>Référence de commande</dt>
            <dd>{receipt.orderId}</dd>
          </div>
          {receipt.offer && (
            <div>
              <dt>Offre</dt>
              <dd>{receipt.offer}</dd>
            </div>
          )}
          {typeof receipt.amount === 'number' && (
            <div>
              <dt>Montant payé</dt>
              <dd>{formatEuro(receipt.amount)}</dd>
            </div>
          )}
        </dl>
      )}

      <div className="confirmation-actions">
        <Link href="/espace-client" className="btn btn-primary">
          <UserRound size={16} aria-hidden="true" /> Mon espace client
        </Link>
        <button className="btn btn-ghost" onClick={() => setRefresh(value => value + 1)}>
          <RefreshCw size={16} aria-hidden="true" /> Actualiser
        </button>
        <Link href="/contact" className="btn btn-ghost">
          <Mail size={16} aria-hidden="true" /> Contacter le support
        </Link>
      </div>
    </div>
  );
}

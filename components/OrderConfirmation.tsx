'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Mail, RefreshCw } from 'lucide-react';
import { formatEuro } from '@/lib/offerPresentation';

type Receipt = { status: string; orderId?: string; offer?: string; amount?: number };
const MESSAGES: Record<string, string> = {
  awaiting_payment: 'Le paiement n’est pas encore confirmé. Aucun accès n’est transmis avant sa validation.',
  processing: 'Votre paiement est confirmé. La commande et la transmission de vos accès sont en cours de traitement.',
  sent: 'Votre paiement est confirmé. Le prestataire d’e-mail a accepté le message contenant le suivi de votre accès. Vérifiez votre boîte de réception et vos courriers indésirables.',
  needs_review: 'Votre paiement a été reçu, mais l’accès n’a pas pu être attribué. Le support doit résoudre la situation et vérifier le remboursement ; ne repassez pas de commande.',
  cancelled: 'Cette commande a été annulée. Contactez le support pour vérifier son suivi.',
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
  return <div>
    {error ? <p role="alert">{error}</p> : <p role="status">{receipt ? MESSAGES[receipt.status] : 'Vérification de votre paiement…'}</p>}
    {receipt?.orderId && <dl><dt>Référence de commande</dt><dd>{receipt.orderId}</dd><dt>Offre</dt><dd>{receipt.offer}</dd><dt>Montant payé</dt><dd>{formatEuro(receipt.amount!)}</dd></dl>}
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 24 }}>
      <button className="btn btn-ghost" onClick={() => setRefresh(value => value + 1)}><RefreshCw size={16} /> Actualiser</button>
      <Link href="/espace-client" className="btn btn-primary">Mon espace client</Link>
      <a href="mailto:hello@streammalin.fr" className="btn btn-ghost"><Mail size={16} /> Contacter le support</a>
    </div>
  </div>;
}

'use client';

import { useCallback, useEffect, useState } from 'react';
import { RefreshCw, ShieldCheck, Save, Send } from 'lucide-react';
import type { CommercialReview } from '@/lib/commerce';
import { formatEuro } from '@/lib/offerPresentation';

type ReviewItem = { id: string; name: string; review: CommercialReview };
type Operations = { schemaEnabled: boolean; jobs: { id: string; orderId: string; kind: string; status: string; attempts: number; lastError: string | null }[];
  payments: { id: string; orderId: string; amountMinor: number; paidAt: string; provider: string; providerPaymentId: string; status: string }[];
  sessions: { createdAt: string; expiresAt: string }[]; withdrawals: { id: string; orderId: string; receivedAt: string; email: string }[]; withdrawalsNextCursor?: string | null };

export default function OperationsPanel() {
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [operations, setOperations] = useState<Operations | null>(null);
  const [commerceOpen, setCommerceOpen] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    try {
      const reviewsResponse = await fetch('/api/admin/commercial-review', { cache: 'no-store' });
      const operationsResponse = await fetch('/api/admin/operations', { cache: 'no-store' });
      const a = await reviewsResponse.json(); const b = await operationsResponse.json();
      if (!reviewsResponse.ok || !operationsResponse.ok || !a.success || !b.success) throw new Error('Le suivi n’a pas pu être chargé.');
      setReviews(a.services); setCommerceOpen(a.commerceEnabled); setOperations(b); setError('');
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'Connexion indisponible.'); }
  }, []);
  useEffect(() => { void Promise.resolve().then(load); }, [load]);
  async function loadOlderWithdrawals() {
    if (busy || !operations?.withdrawalsNextCursor) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/admin/operations?withdrawalsBefore=${encodeURIComponent(operations.withdrawalsNextCursor)}`, { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error('Les demandes précédentes n’ont pas pu être chargées.');
      setOperations(current => current && ({ ...current, withdrawals: [...current.withdrawals, ...data.withdrawals], withdrawalsNextCursor: data.withdrawalsNextCursor }));
    } catch { setError('Les demandes précédentes n’ont pas pu être chargées.'); }
    finally { setBusy(false); }
  }
  async function action(body: Record<string, unknown>) {
    if (busy) return;
    setBusy(true); setMessage('');
    try {
      const response = await fetch('/api/admin/operations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || 'Action refusée.');
      setMessage(data.delivery ? data.delivery.enabled ? `Transmissions confirmées : ${data.delivery.completed}. À vérifier : ${data.delivery.failed}.${data.delivery.configurationMissing ? ' Prestataire e-mail non configuré.' : ''}` : 'Le traitement des transmissions n’est pas activé.' : 'Action enregistrée.');
      await load();
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'Connexion indisponible.'); }
    finally { setBusy(false); }
  }
  async function save(item: ReviewItem) {
    if (busy) return;
    if (item.review.status === 'approved' && !window.confirm('Confirmez-vous avoir vérifié une autorisation écrite de distribution et les conditions affichées pour cette offre ?')) return;
    setBusy(true); setMessage('');
    try {
      const response = await fetch('/api/admin/commercial-review', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ serviceId: item.id, review: item.review, authorizationConfirmed: item.review.status === 'approved' }) });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || 'Enregistrement refusé.');
      await load(); setMessage('Vérification enregistrée. L’ouverture générale des paiements dépend aussi de la validation de la migration.');
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'Connexion indisponible.'); }
    finally { setBusy(false); }
  }
  const update = (id: string, key: keyof CommercialReview, value: string | boolean | number | null) => setReviews(items => items.map(item => item.id === id ? { ...item, review: { ...item.review, [key]: value } } : item));
  return <div className="operations-panel">
    <div className="admin-section-head"><h2>Vérifications et suivi</h2><button className="btn btn-ghost btn-sm" disabled={busy} onClick={load} title="Actualiser le suivi"><RefreshCw size={16} /></button></div>
    {error && <p role="alert">{error}</p>}{message && <p role="status">{message}</p>}
    <p>Paiements {commerceOpen ? 'ouverts' : 'fermés'} · Migration {operations?.schemaEnabled ? 'activée' : 'non activée'}.</p>
    <h3>Vérification des offres</h3>
    {reviews.map(item => <details key={item.id} className="commercial-review"><summary>{item.name} · {item.id} · {item.review.status === 'approved' ? 'Vérifiée' : 'Indisponible : à vérifier'}</summary>
      <label htmlFor={`review-status-${item.id}`}>Statut</label><select id={`review-status-${item.id}`} className="dash-input" value={item.review.status} onChange={event => update(item.id, 'status', event.target.value)}><option value="unverified">Non vérifiée : vente bloquée</option><option value="approved">Autorisation et conditions vérifiées</option></select>
      {([['authorizationReference', 'Référence privée de l’autorisation écrite'], ['accessType', 'Type d’accès fourni'], ['eligibility', 'Conditions d’éligibilité affichées au client'], ['privacyNote', 'Données visibles par les autres membres'], ['referenceUrl', 'Source HTTPS du tarif de référence'], ['referenceCheckedAt', 'Date de vérification du tarif']] as const).map(([key, label]) => <div key={key}><label htmlFor={`review-${key}-${item.id}`}>{label}</label><input id={`review-${key}-${item.id}`} className="dash-input" maxLength={2000} type={key === 'referenceCheckedAt' ? 'date' : key === 'referenceUrl' ? 'url' : 'text'} value={item.review[key]} onChange={event => update(item.id, key, event.target.value)} /></div>)}
      <label htmlFor={`reference-price-${item.id}`}>Tarif de référence mensuel (€)</label><input id={`reference-price-${item.id}`} className="dash-input" type="number" min="0.01" step="0.01" value={item.review.referencePrice ?? ''} onChange={event => update(item.id, 'referencePrice', event.target.value ? Number(event.target.value) : null)} />
      <label><input type="checkbox" checked={item.review.comparableReference} onChange={event => update(item.id, 'comparableReference', event.target.checked)} /> Je confirme que les prestations comparées sont équivalentes.</label>
      <button className="btn btn-primary btn-sm" disabled={busy} onClick={() => save(item)}><Save size={16} /> Enregistrer la vérification</button>
    </details>)}
    <h3>Transmissions et accès à traiter</h3>
    {!operations?.schemaEnabled ? <p>Les nouvelles files de suivi restent inactives jusqu’à la validation de la migration.</p> : <>
      <button className="btn btn-ghost" disabled={busy} onClick={() => action({ action: 'process_deliveries' })}><Send size={16} /> Traiter les transmissions en attente</button>
      {operations.jobs.length === 0 ? <p>Aucune tâche en attente.</p> : <div className="operations-table"><table className="admin-table"><thead><tr><th>Commande</th><th>Tâche</th><th>Statut</th><th>Essais</th><th>Action</th></tr></thead><tbody>{operations.jobs.map(job => <tr key={job.id}><td>{job.orderId}</td><td>{job.kind}</td><td>{job.status}{job.lastError && ` · ${job.lastError}`}</td><td>{job.attempts}</td><td>{job.kind === 'access_revocation' && job.status === 'needs_review' ? <button disabled={busy} className="btn btn-ghost btn-sm" onClick={() => { if (confirm('L’accès a-t-il été effectivement retiré chez le fournisseur ? La place ne doit pas être revendue avant cette opération.')) void action({ action: 'confirm_access_revoked', jobId: job.id, confirmed: true }); }}>Confirmer l’accès retiré</button> : job.kind === 'payment_review' ? 'Vérifier et résoudre le paiement chez le prestataire. Ne pas livrer ni revendre automatiquement.' : 'Suivre la transmission'}</td></tr>)}</tbody></table></div>}
      <h3>Historique des paiements</h3><div className="operations-table"><table className="admin-table"><thead><tr><th>Date</th><th>Commande</th><th>Montant</th><th>Prestataire</th><th>Statut</th></tr></thead><tbody>{operations.payments.map(payment => <tr key={payment.id}><td>{new Date(payment.paidAt).toLocaleString('fr-FR')}</td><td>{payment.orderId}<br />{payment.providerPaymentId}</td><td>{formatEuro(payment.amountMinor / 100)}</td><td>{payment.provider}</td><td>{payment.status}</td></tr>)}</tbody></table></div>
      <h3>Sessions administrateur</h3><p>{operations.sessions.length} session(s) actuellement ouverte(s).</p><button className="btn btn-ghost" disabled={busy} onClick={() => { if (confirm('Déconnecter toutes les autres sessions administrateur ?')) void action({ action: 'revoke_other_sessions' }); }}><ShieldCheck size={16} /> Révoquer les autres sessions</button>
    </>}
    <h3>Demandes de rétractation</h3>{operations?.withdrawals.length ? <div className="operations-table"><table className="admin-table"><thead><tr><th>Réception</th><th>Commande</th><th>Contact</th></tr></thead><tbody>{operations.withdrawals.map(item => <tr key={item.id}><td>{new Date(item.receivedAt).toLocaleString('fr-FR')}</td><td>{item.orderId}</td><td>{item.email}</td></tr>)}</tbody></table></div> : <p>Aucune déclaration enregistrée.</p>}
    {operations?.withdrawalsNextCursor && <button className="btn btn-ghost" disabled={busy} onClick={loadOlderWithdrawals}>Demandes précédentes</button>}
  </div>;
}

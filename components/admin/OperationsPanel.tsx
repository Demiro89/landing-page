'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { RefreshCw, ShieldCheck, Save, Send, CircleAlert } from 'lucide-react';
import type { CommercialReview } from '@/lib/commerce';
import { formatEuro } from '@/lib/offerPresentation';
import { adminResponse } from '@/lib/adminResponse';

type ReviewItem = { id: string; name: string; review: CommercialReview };
type Operations = {
  schemaEnabled: boolean;
  jobs: { id: string; orderId: string; kind: string; status: string; attempts: number; lastError: string | null }[];
  payments: { id: string; orderId: string; amountMinor: number; paidAt: string; provider: string; providerPaymentId: string; status: string }[];
  sessions: { createdAt: string; expiresAt: string }[];
  withdrawals: { id: string; orderId: string; receivedAt: string; email: string }[];
  withdrawalsNextCursor?: string | null;
};
const TABS = ['Offres', 'Transmissions', 'Paiements', 'Sessions', 'Rétractations'] as const;
const JOB_LABELS: Record<string, string> = { delivery: 'Transmission des accès', unpaid_reminder: 'Relance de paiement', access_revocation: 'Retrait de l’accès', payment_review: 'Paiement à vérifier', renewal: 'Renouvellement' };
const JOB_STATUSES: Record<string, string> = { pending: 'En attente', processing: 'En cours', needs_review: 'À vérifier' };

export type OperationsTab = (typeof TABS)[number];

export default function OperationsPanel({ initialTab = 'Offres' }: { initialTab?: OperationsTab }) {
  const [tab, setTab] = useState<OperationsTab>(initialTab);
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [operations, setOperations] = useState<Operations | null>(null);
  const [commerceOpen, setCommerceOpen] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const lock = useRef(false);
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const reviewsResponse = await adminResponse('/api/admin/commercial-review');
      const operationsResponse = await adminResponse('/api/admin/operations');
      const a = await reviewsResponse.json();
      const b = await operationsResponse.json();
      if (!reviewsResponse.ok || !operationsResponse.ok || !a.success || !b.success) throw new Error('Le suivi n’a pas pu être chargé. Actualisez avant toute modification.');
      setReviews(a.services); setCommerceOpen(a.commerceEnabled); setOperations(b); setError('');
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'Connexion indisponible.'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void Promise.resolve().then(load); }, [load]);

  async function loadOlderWithdrawals() {
    if (lock.current || !operations?.withdrawalsNextCursor) return;
    lock.current = true; setBusy(true);
    try {
      const response = await adminResponse(`/api/admin/operations?withdrawalsBefore=${encodeURIComponent(operations.withdrawalsNextCursor)}`);
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error();
      setOperations(current => current && ({ ...current, withdrawals: [...current.withdrawals, ...data.withdrawals], withdrawalsNextCursor: data.withdrawalsNextCursor }));
    } catch { setError('Les demandes précédentes n’ont pas pu être chargées.'); }
    finally { lock.current = false; setBusy(false); }
  }
  async function action(body: Record<string, unknown>) {
    if (lock.current || loading || error || !operations) return;
    lock.current = true; setBusy(true); setMessage('');
    try {
      const response = await adminResponse('/api/admin/operations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || 'Action refusée.');
      setMessage(data.delivery ? data.delivery.enabled ? `Tâches terminées : ${data.delivery.completed}. En échec : ${data.delivery.failed}. La réception des e-mails et l’accès fournisseur restent à vérifier.${data.delivery.configurationMissing ? ' Prestataire e-mail non configuré.' : ''}` : 'Le traitement des transmissions n’est pas activé.' : 'Action enregistrée.');
      await load();
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'Résultat incertain. Actualisez avant de réessayer.'); }
    finally { lock.current = false; setBusy(false); }
  }
  async function save(item: ReviewItem) {
    if (lock.current || loading || error || !operations) return;
    if (item.review.status === 'approved' && !window.confirm('Confirmez-vous avoir vérifié une autorisation écrite de distribution et les conditions affichées pour cette offre ?')) return;
    lock.current = true; setBusy(true); setMessage('');
    try {
      const response = await adminResponse('/api/admin/commercial-review', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ serviceId: item.id, review: item.review, authorizationConfirmed: item.review.status === 'approved' }) });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || 'Enregistrement refusé.');
      await load(); setMessage('Vérification enregistrée. L’ouverture générale des ventes reste un réglage distinct.');
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'Résultat incertain. Actualisez avant de réessayer.'); }
    finally { lock.current = false; setBusy(false); }
  }
  const update = (id: string, key: keyof CommercialReview, value: string | boolean | number | null) => setReviews(items => items.map(item => item.id === id ? { ...item, review: { ...item.review, [key]: value } } : item));
  const disabled = busy || loading || Boolean(error) || !operations;
  return <div className="operations-panel">
    <div className="admin-section-head operations-heading"><div><h2>Vérifications et suivi</h2><p>Autorisations, transmissions et preuves de paiement.</p></div><button className="btn btn-ghost btn-sm" disabled={busy || loading} onClick={load} title="Actualiser le suivi" aria-label="Actualiser le suivi"><RefreshCw size={16} /></button></div>
    {error && <div className="error-box" role="alert">{error}<button className="btn btn-ghost btn-sm" onClick={load} disabled={busy || loading}>Réessayer</button></div>}
    {message && <p className="operations-message" role="status">{message}</p>}
    <div className="operations-gates"><span className={`admin-status ${operations ? commerceOpen ? 'admin-status-success' : 'admin-status-warning' : 'admin-status-neutral'}`}>{operations ? commerceOpen ? 'Ventes ouvertes' : 'Ventes fermées' : 'Ventes : état indisponible'}</span><span className="admin-status admin-status-neutral">{operations ? operations.schemaEnabled ? 'Suivi durable activé' : 'Suivi durable non activé' : 'Suivi : chargement…'}</span></div>
    <div className="operations-tabs" role="group" aria-label="Catégorie de vérification">{TABS.map(label => <button key={label} className="btn btn-ghost btn-sm" aria-pressed={tab === label} onClick={() => setTab(label)}>{label}</button>)}</div>
    {loading && !operations ? <p role="status">Chargement du suivi…</p> : !operations ? <p>Le suivi est indisponible. Aucune modification n’est possible.</p> : <>
      {tab === 'Offres' && <>
        <h3>Autorisations commerciales</h3>
        {reviews.length === 0 && <p>Aucune offre enregistrée.</p>}
        {reviews.map(item => <details key={item.id} className="commercial-review"><summary>{item.name}<span className={`admin-status ${item.review.status === 'approved' ? 'admin-status-success' : 'admin-status-warning'}`}>{item.review.status === 'approved' ? 'Vérifiée' : 'Vente bloquée'}</span></summary>
          <fieldset className="admin-workspace" disabled={disabled}>
            <div className="operations-review-grid">
              <div><label htmlFor={`review-status-${item.id}`}>Statut</label><select id={`review-status-${item.id}`} className="dash-input" value={item.review.status} onChange={event => update(item.id, 'status', event.target.value)}><option value="unverified">Non vérifiée : vente bloquée</option><option value="approved">Autorisation et conditions vérifiées</option></select></div>
              {([['authorizationReference', 'Référence privée de l’autorisation écrite'], ['accessType', 'Type d’accès fourni'], ['eligibility', 'Conditions d’éligibilité affichées au client'], ['privacyNote', 'Données visibles par les autres membres'], ['referenceUrl', 'Source HTTPS du tarif de référence'], ['referenceCheckedAt', 'Date de vérification du tarif']] as const).map(([key, label]) => <div key={key}><label htmlFor={`review-${key}-${item.id}`}>{label}</label><input id={`review-${key}-${item.id}`} className="dash-input" maxLength={2000} type={key === 'referenceCheckedAt' ? 'date' : key === 'referenceUrl' ? 'url' : 'text'} value={item.review[key]} onChange={event => update(item.id, key, event.target.value)} /></div>)}
              <div><label htmlFor={`reference-price-${item.id}`}>Tarif de référence mensuel (€)</label><input id={`reference-price-${item.id}`} className="dash-input" type="number" min="0.01" step="0.01" value={item.review.referencePrice ?? ''} onChange={event => update(item.id, 'referencePrice', event.target.value ? Number(event.target.value) : null)} /></div>
            </div>
            <label><input type="checkbox" checked={item.review.comparableReference} onChange={event => update(item.id, 'comparableReference', event.target.checked)} /> Je confirme que les prestations comparées sont équivalentes.</label>
            <button className="btn btn-primary btn-sm" onClick={() => save(item)}><Save size={16} /> Enregistrer la vérification</button>
          </fieldset>
        </details>)}
      </>}
      {tab === 'Transmissions' && <>
        <h3>Accès et transmissions à traiter</h3>
        {!operations.schemaEnabled ? <p>Le suivi durable reste inactif jusqu’à sa validation. Aucun traitement n’est lancé.</p> : <>
          <button className="btn btn-ghost" disabled={disabled} onClick={() => action({ action: 'process_deliveries' })}><Send size={16} /> Traiter les transmissions en attente</button>
          <p>Au maximum 100 tâches anciennes à traiter. Une tâche terminée ne prouve pas la réception en boîte ou l’activation d’une invitation fournisseur.</p>
          {operations.jobs.length === 0 ? <p>Aucune tâche en attente.</p> : <div className="operations-table"><table className="admin-table"><thead><tr><th scope="col">Commande</th><th scope="col">Tâche</th><th scope="col">Statut</th><th scope="col">Essais</th><th scope="col">Action</th></tr></thead><tbody>{operations.jobs.map(job => <tr key={job.id}><td><code>{job.orderId}</code></td><td>{JOB_LABELS[job.kind] || job.kind}</td><td><span className={`admin-status ${job.status === 'needs_review' ? 'admin-status-danger' : 'admin-status-warning'}`}>{JOB_STATUSES[job.status] || 'À vérifier'}</span>{job.lastError && <p>{job.lastError}</p>}</td><td>{job.attempts}</td><td>{job.kind === 'access_revocation' && job.status === 'needs_review' ? <button disabled={disabled} className="btn btn-ghost btn-sm" onClick={() => { if (confirm('L’accès a-t-il été effectivement retiré chez le fournisseur ? La place ne doit pas être revendue avant cette opération.')) void action({ action: 'confirm_access_revoked', jobId: job.id, confirmed: true }); }}>Confirmer l’accès retiré</button> : job.kind === 'payment_review' ? <span className="admin-action-note"><CircleAlert size={15} /> Vérifier et résoudre chez le prestataire ; ne pas livrer automatiquement.</span> : 'Suivre la transmission'}</td></tr>)}</tbody></table></div>}
        </>}
      </>}
      {tab === 'Paiements' && <><h3>Derniers paiements enregistrés</h3><p>100 dernières preuves au maximum. Cet historique ne remplace pas les relevés des prestataires ni une comptabilité.</p>{!operations.schemaEnabled ? <p>Suivi durable non activé.</p> : operations.payments.length === 0 ? <p>Aucun paiement enregistré dans le suivi durable.</p> : <div className="operations-table"><table className="admin-table"><thead><tr><th scope="col">Date</th><th scope="col">Commande / référence</th><th scope="col">Montant</th><th scope="col">Prestataire</th><th scope="col">Statut</th></tr></thead><tbody>{operations.payments.map(payment => <tr key={payment.id}><td>{new Date(payment.paidAt).toLocaleString('fr-FR')}</td><td><code>{payment.orderId}</code><br /><small>{payment.providerPaymentId}</small></td><td>{formatEuro(payment.amountMinor / 100)}</td><td>{payment.provider}</td><td><span className={`admin-status ${payment.status === 'paid' ? 'admin-status-success' : 'admin-status-warning'}`}>{payment.status === 'paid' ? 'Payé' : 'À vérifier'}</span></td></tr>)}</tbody></table></div>}</>}
      {tab === 'Sessions' && <><h3>Sessions administrateur</h3>{!operations.schemaEnabled ? <p>La révocation centralisée des sessions reste inactive tant que le suivi durable n’est pas validé.</p> : <><p>{operations.sessions.length} session(s) ouverte(s).</p><button className="btn btn-ghost" disabled={disabled} onClick={() => { if (confirm('Déconnecter toutes les autres sessions administrateur ?')) void action({ action: 'revoke_other_sessions' }); }}><ShieldCheck size={16} /> Révoquer les autres sessions</button><div className="operations-table"><table className="admin-table"><thead><tr><th scope="col">Ouverte le</th><th scope="col">Expiration</th></tr></thead><tbody>{operations.sessions.map((session, index) => <tr key={index}><td>{new Date(session.createdAt).toLocaleString('fr-FR')}</td><td>{new Date(session.expiresAt).toLocaleString('fr-FR')}</td></tr>)}</tbody></table></div></>}</>}
      {tab === 'Rétractations' && <><h3>Demandes de rétractation</h3>{operations.withdrawals.length ? <div className="operations-table"><table className="admin-table"><thead><tr><th scope="col">Réception</th><th scope="col">Commande</th><th scope="col">Contact</th></tr></thead><tbody>{operations.withdrawals.map(item => <tr key={item.id}><td>{new Date(item.receivedAt).toLocaleString('fr-FR')}</td><td>{item.orderId}</td><td>{item.email}</td></tr>)}</tbody></table></div> : <p>Aucune déclaration enregistrée.</p>}{operations.withdrawalsNextCursor && <button className="btn btn-ghost" disabled={busy || loading} onClick={loadOlderWithdrawals}>Demandes précédentes</button>}</>}
    </>}
  </div>;
}

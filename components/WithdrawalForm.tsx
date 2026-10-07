'use client';

import { useState } from 'react';
import { Download, Send, ArrowLeft } from 'lucide-react';

export default function WithdrawalForm() {
  const [form, setForm] = useState({ name: '', email: '', orderId: '' });
  const [step, setStep] = useState<'form' | 'confirm'>('form');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [receipt, setReceipt] = useState<{ declaration: string; emailed: boolean } | null>(null);
  async function submit() {
    if (busy) return;
    setBusy(true); setError('');
    try {
      const response = await fetch('/api/retractation', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, confirmed: true }) });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || 'Enregistrement indisponible.');
      setReceipt(data);
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'Connexion indisponible.'); }
    finally { setBusy(false); }
  }
  function download() {
    if (!receipt) return;
    const url = URL.createObjectURL(new Blob([receipt.declaration], { type: 'text/plain;charset=utf-8' }));
    const link = document.createElement('a'); link.href = url; link.download = 'accuse-retractation-streammalin.txt'; link.click(); URL.revokeObjectURL(url);
  }
  if (receipt) return <div role="status"><h2>Déclaration enregistrée</h2><p>{receipt.emailed ? 'Un accusé de réception vous a été envoyé par e-mail.' : 'L’envoi par e-mail n’a pas pu être confirmé. Votre déclaration est enregistrée : téléchargez l’accusé de réception ci-dessous.'}</p><pre style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{receipt.declaration}</pre><button className="btn btn-primary" onClick={download}><Download size={16} /> Télécharger mon accusé de réception</button><p>Le support vérifiera votre commande et les droits applicables. Cet accusé ne confirme pas encore un remboursement.</p></div>;
  return <div><h2>Se rétracter du contrat ici</h2>{error && <p role="alert">{error}</p>}
    {step === 'form' ? <form onSubmit={event => { event.preventDefault(); setStep('confirm'); }}>
      <label htmlFor="withdrawal-name">Nom</label><input id="withdrawal-name" className="dash-input" autoComplete="name" maxLength={150} required value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} />
      <label htmlFor="withdrawal-email">E-mail utilisé pour la commande</label><input id="withdrawal-email" className="dash-input" type="email" autoComplete="email" maxLength={254} required value={form.email} onChange={event => setForm({ ...form, email: event.target.value })} />
      <label htmlFor="withdrawal-order">Référence de commande</label><input id="withdrawal-order" className="dash-input" maxLength={100} pattern="[A-Za-z0-9_-]+" required value={form.orderId} onChange={event => setForm({ ...form, orderId: event.target.value })} />
      <button type="submit" className="btn btn-primary" style={{ marginTop: 16 }}>Vérifier ma déclaration</button>
    </form> : <div><p>Je déclare me rétracter du contrat relatif à la commande <strong>{form.orderId}</strong>.</p><p>{form.name} · {form.email}</p><div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}><button className="btn btn-ghost" disabled={busy} onClick={() => setStep('form')}><ArrowLeft size={16} /> Modifier</button><button className="btn btn-primary" disabled={busy} onClick={submit}><Send size={16} />{busy ? 'Enregistrement…' : 'Confirmer ma rétractation'}</button></div></div>}
  </div>;
}

'use client';

import { useEffect, useRef, useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import AdminDialog from './AdminDialog';
import { registerAdminReauthentication } from '@/lib/adminReauthentication';
import { adminResponse } from '@/lib/adminResponse';

export default function AdminReauthentication() {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [totp, setTotp] = useState('');
  const [needsTotp, setNeedsTotp] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const passwordInput = useRef<HTMLInputElement>(null);
  const totpInput = useRef<HTMLInputElement>(null);
  const resolve = useRef<((accepted: boolean) => void) | null>(null);
  useEffect(() => {
    if (open) (needsTotp ? totpInput : passwordInput).current?.focus();
  }, [open, needsTotp]);
  useEffect(() => {
    const unregister = registerAdminReauthentication(() => new Promise<boolean>(done => {
      resolve.current = done;
      setPassword(''); setTotp(''); setNeedsTotp(false); setError(''); setOpen(true);
    }));
    return () => { unregister(); resolve.current?.(false); resolve.current = null; };
  }, []);
  const finish = (accepted: boolean) => {
    setPassword(''); setTotp(''); setOpen(false);
    resolve.current?.(accepted); resolve.current = null;
  };
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setError('');
    try {
      const response = await adminResponse('/api/admin/auth', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reauth', password, ...(needsTotp ? { totp } : {}) }),
      });
      const data = await response.json();
      if (response.ok && data.success) finish(true);
      else {
        if (data.needsTotp) { setNeedsTotp(true); setTotp(''); }
        setError(data.error || (data.needsTotp ? 'Saisissez le code de votre application d’authentification.' : 'Confirmation refusée. Reconnectez-vous si votre session a expiré.'));
      }
    } finally { setBusy(false); }
  };
  if (!open) return null;
  return <AdminDialog title="Confirmer votre identité" onClose={() => { if (!busy) finish(false); }}>
    <div className="modal-content">
    <h2 style={{ paddingRight: 28 }}>Confirmer votre identité</h2>
    <form onSubmit={submit} style={{ display: 'grid', gap: 12, marginTop: 20 }}>
      <label htmlFor="admin-reauth-password">Mot de passe administrateur</label>
      <input ref={passwordInput} id="admin-reauth-password" className="dash-input" type="password" autoComplete="current-password" maxLength={128} required value={password} onChange={event => setPassword(event.target.value)} disabled={busy} />
      {needsTotp && <>
        <label htmlFor="admin-reauth-totp">Code de double authentification</label>
        <input ref={totpInput} id="admin-reauth-totp" className="dash-input" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required value={totp} onChange={event => setTotp(event.target.value.replace(/\D/g, ''))} disabled={busy} />
      </>}
      {error && <p role="alert" className="error-box">{error}</p>}
      <div className="admin-form-actions">
        <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => finish(false)}>Annuler</button>
        <button type="submit" className="btn btn-primary" disabled={busy || !password || (needsTotp && totp.length !== 6)}><ShieldCheck size={16} />{busy ? 'Vérification…' : 'Confirmer et poursuivre'}</button>
      </div>
    </form>
    </div>
  </AdminDialog>;
}

'use client';

import { useState } from 'react';
import { Eye, EyeOff, Copy } from 'lucide-react';
import { readStockCredentials } from '@/lib/adminCredentials';

export default function StockCredentials({ stockId }: { stockId: string }) {
  const [details, setDetails] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  const act = async (copy: boolean) => {
    if (busy) return;
    if (!copy && details !== null) { setDetails(null); setMessage(''); return; }
    setBusy(true); setMessage('');
    try {
      const value = (await readStockCredentials(stockId)).details;
      if (copy) { await navigator.clipboard.writeText(value); setMessage('Identifiants copiés.'); }
      else setDetails(value);
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Consultation indisponible.'); }
    finally { setBusy(false); }
  };

  return <div style={{ minWidth: 0, maxWidth: '100%' }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
      <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={() => void act(false)} aria-expanded={details !== null}>
        {details === null ? <Eye size={16} aria-hidden="true" /> : <EyeOff size={16} aria-hidden="true" />}
        {busy ? 'Chargement…' : details === null ? 'Consulter les identifiants' : 'Masquer'}
      </button>
      <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={() => void act(true)} aria-label="Copier les identifiants" title="Copier les identifiants">
        <Copy size={16} aria-hidden="true" />
      </button>
    </div>
    {details !== null && <pre style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', margin: '8px 0', fontSize: 12 }}>{details}</pre>}
    {message && <p role="status" style={{ fontSize: 12, margin: '8px 0' }}>{message}</p>}
  </div>;
}

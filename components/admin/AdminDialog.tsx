'use client';

import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

export default function AdminDialog({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    const previous = document.activeElement as HTMLElement | null;
    dialog?.showModal();
    return () => { dialog?.close(); previous?.focus(); };
  }, []);
  return <dialog ref={ref} className="admin-dialog" aria-label={title} onCancel={event => { event.preventDefault(); onClose(); }}>
    <button type="button" className="admin-dialog-close btn btn-ghost btn-sm" onClick={onClose} title="Fermer" aria-label="Fermer"><X size={18} /></button>
    {children}
  </dialog>;
}

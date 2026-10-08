'use client';

import { useCallback, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { adminResponse } from '@/lib/adminResponse';

export function useAdminActions(loading: boolean, loadError: string, reportError: (message: string) => void, notify: (message: string) => void) {
  const router = useRouter();
  const lock = useRef(false);
  const [busy, setBusy] = useState(false);
  const request = useCallback(async (url: string, init?: RequestInit) => {
    const writing = Boolean(init?.method && !['GET', 'HEAD'].includes(init.method));
    const logout = url === '/api/admin/auth';
    if (writing && !logout && (loading || loadError || lock.current)) {
      return Response.json({ success: false, error: 'Actualisez les données ou attendez la fin de l’action en cours.' }, { status: 409 });
    }
    if (writing) { lock.current = true; setBusy(true); }
    try {
      const response = await adminResponse(url, init);
      if (response.status === 401) router.replace('/admin/login');
      if (!response.ok) {
        const data = await response.clone().json();
        notify(data.error);
        if (writing && !logout && response.status >= 500) reportError('Résultat de l’action incertain. Actualisez les données avant toute nouvelle modification.');
      }
      return response;
    } finally { if (writing) { lock.current = false; setBusy(false); } }
  }, [loading, loadError, router, reportError, notify]);
  return { request, busy };
}

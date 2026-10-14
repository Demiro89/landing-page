import { requestAdminReauthentication } from './adminReauthentication';

// Only a pre-mutation authentication refusal is eligible for one explicit retry.
export async function adminResponse(input: string, init?: RequestInit, transport: typeof fetch = fetch): Promise<Response> {
  try {
    let response = await transport(input, { ...init, cache: 'no-store' });
    let data = await response.json();
    if (response.status === 403 && data?.code === 'ADMIN_REAUTH_REQUIRED' && input.startsWith('/api/admin/') && input !== '/api/admin/auth' && await requestAdminReauthentication()) {
      response = await transport(input, { ...init, cache: 'no-store' });
      data = await response.json();
    }
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error();
    const error = typeof data.error === 'string' && data.error.trim() ? data.error.slice(0, 1000) : 'Action refusée. Actualisez les données avant de réessayer.';
    return Response.json(response.ok ? data : { ...data, success: false, error }, { status: response.status });
  } catch {
    return Response.json({ success: false, error: 'Réponse indisponible. Le résultat est incertain : actualisez avant de réessayer.' }, { status: 503 });
  }
}

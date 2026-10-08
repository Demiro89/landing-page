// Preserve the existing Response contract while making network/HTML errors explicit.
// Never retry a mutation automatically: it may already have been committed.
export async function adminResponse(input: string, init?: RequestInit, transport: typeof fetch = fetch): Promise<Response> {
  try {
    const response = await transport(input, { ...init, cache: 'no-store' });
    const data = await response.json();
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error();
    const error = typeof data.error === 'string' && data.error.trim() ? data.error.slice(0, 1000) : 'Action refusée. Actualisez les données avant de réessayer.';
    return Response.json(response.ok ? data : { ...data, success: false, error }, { status: response.status });
  } catch {
    return Response.json({ success: false, error: 'Réponse indisponible. Le résultat est incertain : actualisez avant de réessayer.' }, { status: 503 });
  }
}

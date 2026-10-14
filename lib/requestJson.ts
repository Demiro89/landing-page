import 'server-only';
import { NextResponse } from 'next/server';

type JsonResult =
  | { ok: true; value: Record<string, unknown> }
  | { ok: false; response: NextResponse };

/** Bound actual streamed bytes before parsing; Content-Length alone is untrusted. */
export async function readJsonObject(request: Request, maxBytes = 8192): Promise<JsonResult> {
  const reject = (status: number, error: string): JsonResult => ({
    ok: false, response: NextResponse.json({ error }, { status }),
  });
  if (request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json') {
    return reject(415, 'Format JSON requis.');
  }
  const length = request.headers.get('content-length');
  if (length !== null && !/^\d+$/.test(length)) return reject(400, 'Longueur de requête invalide.');
  if (length !== null && Number(length) > maxBytes) return reject(413, 'Requête trop volumineuse.');
  const reader = request.body?.getReader();
  if (!reader) return reject(400, 'Objet JSON requis.');
  try {
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) {
        await reader.cancel();
        return reject(413, 'Requête trop volumineuse.');
      }
      chunks.push(value);
    }
    const value: unknown = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks)));
    if (!value || typeof value !== 'object' || Array.isArray(value)) return reject(400, 'Objet JSON requis.');
    return { ok: true, value: value as Record<string, unknown> };
  } catch {
    return reject(400, 'Objet JSON invalide.');
  } finally {
    reader.releaseLock();
  }
}

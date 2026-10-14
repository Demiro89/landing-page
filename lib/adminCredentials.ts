import { adminResponse } from './adminResponse';

export async function readStockCredentials(stockId: string): Promise<{ details: string; updatedAt: string }> {
  const response = await adminResponse('/api/admin/credentials', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ stockId }),
  });
  const data = await response.json();
  if (!response.ok || data.success !== true || typeof data.details !== 'string' || typeof data.updatedAt !== 'string') {
    throw new Error(typeof data.error === 'string' ? data.error : 'Consultation impossible. Reconnectez-vous si nécessaire.');
  }
  return { details: data.details, updatedAt: data.updatedAt };
}

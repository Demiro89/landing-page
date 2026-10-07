import { NextResponse } from 'next/server';
import { isCronAuthorized } from '@/lib/cronAuth';
import { runDeliveryJobs } from '@/lib/deliveryWorker';
import { alertDeliveryIssues } from '@/lib/deliveryAlerts';

export const dynamic = 'force-dynamic';

// This route only handles delivery; it never runs account or audit-log cleanup.
export async function GET(request: Request) {
  if (!isCronAuthorized(request)) return NextResponse.json({ error: 'Non autorise' }, { status: 401 });
  try {
    const delivery = await runDeliveryJobs(20);
    const health = delivery.enabled ? await alertDeliveryIssues('configurationMissing' in delivery && delivery.configurationMissing) : null;
    return NextResponse.json({ success: !('configurationMissing' in delivery && delivery.configurationMissing), delivery, health }, {
      status: 'configurationMissing' in delivery && delivery.configurationMissing ? 503 : 200,
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch {
    console.error('[delivery] Runner failed; inspect the protected operations panel.');
    return NextResponse.json({ error: 'Traitement temporairement indisponible' }, { status: 503 });
  }
}

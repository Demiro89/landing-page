/**
 * GET /api/settings — paramètres publics (prix + PayPal)
 * Pas d'authentification — utilisé par le checkout modal côté client.
 */

import { NextResponse } from 'next/server';
import { getSettings } from '@/lib/settings';

export async function GET() {
  const s = await getSettings();

  // N'expose que les champs nécessaires côté client
  return NextResponse.json({
    price_youtube:        s.price_youtube,
    price_disney:         s.price_disney,
    price_surfshark:      s.price_surfshark,
    paypal_link:          s.paypal_link,
    paypal_instruction_1: s.paypal_instruction_1,
    paypal_instruction_2: s.paypal_instruction_2,
    paypal_instruction_3: s.paypal_instruction_3,
  });
}

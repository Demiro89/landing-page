/**
 * StreamMalin — Paramètres dynamiques
 *
 * Clés disponibles et valeurs par défaut.
 * Toute clé manquante en DB retourne sa valeur par défaut.
 */

import { prisma } from '@/lib/prisma';

export const SETTING_KEYS = [
  'price_youtube',
  'price_disney',
  'price_surfshark',
  'paypal_link',
  'paypal_admin_email',
  'paypal_instruction_1',
  'paypal_instruction_2',
  'paypal_instruction_3',
] as const;

export type SettingKey = (typeof SETTING_KEYS)[number];

export const SETTING_DEFAULTS: Record<SettingKey, string> = {
  price_youtube:        '5.99',
  price_disney:         '4.99',
  price_surfshark:      '2.49',
  paypal_link:          'https://paypal.me/AccesPremium89',
  paypal_admin_email:   'oub9493@gmail.com',
  paypal_instruction_1: 'Envoyez en mode "À un proche" — jamais "Biens ou services".',
  paypal_instruction_2: 'Indiquez votre adresse email dans la note du paiement.',
  paypal_instruction_3: 'Activation sous 12h après réception.',
};

export type Settings = Record<SettingKey, string>;

/** Récupère tous les paramètres, en comblant les valeurs manquantes par les défauts. */
export async function getSettings(): Promise<Settings> {
  try {
    const rows = await prisma.setting.findMany();
    const map = Object.fromEntries(rows.map((r) => [r.key, r.value])) as Partial<Settings>;
    const result = {} as Settings;
    for (const key of SETTING_KEYS) {
      result[key] = map[key] ?? SETTING_DEFAULTS[key];
    }
    return result;
  } catch {
    return { ...SETTING_DEFAULTS };
  }
}

/** Récupère une seule clé. */
export async function getSetting(key: SettingKey): Promise<string> {
  try {
    const row = await prisma.setting.findUnique({ where: { key } });
    return row?.value ?? SETTING_DEFAULTS[key];
  } catch {
    return SETTING_DEFAULTS[key];
  }
}

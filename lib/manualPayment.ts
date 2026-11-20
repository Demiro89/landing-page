export const CRYPTO_COINS = ['btc', 'eth', 'usdt', 'ltc'] as const;
export type CryptoCoin = (typeof CRYPTO_COINS)[number];

export function isCryptoCoin(value: unknown): value is CryptoCoin {
  return CRYPTO_COINS.some(coin => coin === value);
}

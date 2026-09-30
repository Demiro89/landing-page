import crypto from 'crypto';

/**
 * Chiffrement symétrique des données sensibles au repos (identifiants de comptes).
 * Algorithme : AES-256-GCM (chiffrement authentifié).
 *
 * Format courant : "enc:v2:<iv_hex>:<tag_hex>:<ciphertext_hex>" (scrypt).
 * v1 a historiquement utilisé SHA-256 puis scrypt avec le même préfixe.
 * Les anciennes valeurs en clair (sans préfixe) restent lisibles : decrypt()
 * les renvoie telles quelles, ce qui permet une migration progressive.
 */

const ALGO = 'aes-256-gcm';
const PREFIX = 'enc:v2:';
const LEGACY_PREFIX = 'enc:v1:';

let cachedKey: Buffer | null = null;

/** Dérive une clé AES-256 (32 octets) à partir du secret d'environnement. */
function getKey(): Buffer {
  if (cachedKey) return cachedKey;
  const raw = process.env.ENCRYPTION_KEY;
  if (!raw || raw.length < 32) {
    throw new Error(
      'ENCRYPTION_KEY manquant ou trop court : définissez une valeur secrète aléatoire ' +
      "d'au moins 32 caractères dans vos variables d'environnement (ex. openssl rand -hex 32)."
    );
  }
  // scrypt : résistant au brute-force même si ENCRYPTION_KEY a une faible entropie.
  // Salt fixe d'application — la rotation de clé nécessite une migration explicite des données.
  cachedKey = crypto.scryptSync(raw, 'streammalin-enc-v1', 32);
  return cachedKey;
}

/** Vrai si la valeur a déjà été chiffrée par ce module. */
export function isEncrypted(value: string): boolean {
  return typeof value === 'string' && (value.startsWith(PREFIX) || value.startsWith(LEGACY_PREFIX));
}

/**
 * Chiffre une chaîne. Idempotent : une valeur déjà chiffrée est renvoyée telle quelle
 * (évite tout double chiffrement lors d'une copie d'un champ déjà protégé).
 */
export function encrypt(plain: string): string {
  if (plain == null || plain === '') return plain;
  if (isEncrypted(plain)) {
    decrypt(plain);
    return plain;
  }
  if (plain.startsWith('enc:')) throw new Error('Unsupported encrypted format');
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, getKey(), iv);
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return PREFIX + iv.toString('hex') + ':' + tag.toString('hex') + ':' + enc.toString('hex');
}

/**
 * Déchiffre une valeur. Les anciennes données en clair (non préfixées) sont
 * renvoyées inchangées — la migration peut donc être progressive.
 */
export function decrypt(value: string): string {
  if (value == null) return value;
  if (!isEncrypted(value)) {
    if (value.startsWith('enc:')) throw new Error('Unsupported encrypted format');
    return value;
  }
  try {
    const legacy = value.startsWith(LEGACY_PREFIX);
    const parts = value.slice(legacy ? LEGACY_PREFIX.length : PREFIX.length).split(':');
    if (parts.length !== 3) throw new Error('Invalid encrypted format');
    const [ivHex, tagHex, dataHex] = parts;
    if (!/^[0-9a-f]{24}$/i.test(ivHex) || !/^[0-9a-f]{32}$/i.test(tagHex) || !/^(?:[0-9a-f]{2})*$/i.test(dataHex)) {
      throw new Error('Invalid encrypted format');
    }
    const raw = process.env.ENCRYPTION_KEY;
    if (!raw || raw.length < (legacy ? 16 : 32)) throw new Error('Encryption key unavailable');
    const keys = legacy
      ? [crypto.scryptSync(raw, 'streammalin-enc-v1', 32), crypto.createHash('sha256').update(raw).digest()]
      : [getKey()];
    for (const key of keys) {
      try {
        const decipher = crypto.createDecipheriv(ALGO, key, Buffer.from(ivHex, 'hex'));
        decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
        return Buffer.concat([decipher.update(Buffer.from(dataHex, 'hex')), decipher.final()]).toString('utf8');
      } catch {
        // Only the GCM authentication tag can select the correct legacy key.
      }
    }
    throw new Error('Encrypted value could not be authenticated');
  } catch (err) {
    console.error('[crypto] échec du déchiffrement :', (err as Error).message);
    throw new Error('Les accès chiffrés sont temporairement indisponibles.');
  }
}

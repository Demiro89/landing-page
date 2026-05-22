import crypto from 'crypto';

/**
 * Chiffrement symétrique des données sensibles au repos (identifiants de comptes).
 * Algorithme : AES-256-GCM (chiffrement authentifié).
 *
 * Format d'une valeur chiffrée : "enc:v1:<iv_hex>:<tag_hex>:<ciphertext_hex>"
 * Les anciennes valeurs en clair (sans préfixe) restent lisibles : decrypt()
 * les renvoie telles quelles, ce qui permet une migration progressive.
 */

const ALGO = 'aes-256-gcm';
const PREFIX = 'enc:v1:';

let cachedKey: Buffer | null = null;

/** Dérive une clé AES-256 (32 octets) à partir du secret d'environnement. */
function getKey(): Buffer {
  if (cachedKey) return cachedKey;
  const raw = process.env.ENCRYPTION_KEY;
  if (!raw || raw.length < 16) {
    throw new Error(
      'ENCRYPTION_KEY manquant ou trop court : définissez une valeur secrète aléatoire ' +
      "d'au moins 16 caractères dans vos variables d'environnement (ex. openssl rand -hex 32)."
    );
  }
  cachedKey = crypto.createHash('sha256').update(raw).digest();
  return cachedKey;
}

/** Vrai si la valeur a déjà été chiffrée par ce module. */
export function isEncrypted(value: string): boolean {
  return typeof value === 'string' && value.startsWith(PREFIX);
}

/**
 * Chiffre une chaîne. Idempotent : une valeur déjà chiffrée est renvoyée telle quelle
 * (évite tout double chiffrement lors d'une copie d'un champ déjà protégé).
 */
export function encrypt(plain: string): string {
  if (plain == null || plain === '') return plain;
  if (isEncrypted(plain)) return plain;
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
  if (value == null || !isEncrypted(value)) return value;
  try {
    const parts = value.slice(PREFIX.length).split(':');
    if (parts.length !== 3) return value;
    const [ivHex, tagHex, dataHex] = parts;
    const decipher = crypto.createDecipheriv(ALGO, getKey(), Buffer.from(ivHex, 'hex'));
    decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
    const dec = Buffer.concat([decipher.update(Buffer.from(dataHex, 'hex')), decipher.final()]);
    return dec.toString('utf8');
  } catch (err) {
    console.error('[crypto] échec du déchiffrement :', (err as Error).message);
    return value;
  }
}

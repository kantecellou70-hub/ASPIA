/**
 * crypto.ts — Chiffrement AES-256-GCM via Web Crypto API (Deno)
 *
 * Utilisé pour le chiffrement des PDFs au repos dans Supabase Storage.
 * La clé est stockée dans Supabase Vault (pgsodium).
 *
 * Format du payload chiffré (binaire) :
 *   [12 bytes IV][n bytes ciphertext (avec 16 bytes auth tag intégré)]
 */

const ALGORITHM = 'AES-GCM'
const IV_LENGTH = 12  // 96 bits — standard GCM

/** Génère une clé AES-256-GCM utilisable pour chiffrement/déchiffrement. */
export async function generateKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey(
    { name: ALGORITHM, length: 256 },
    true,   // extractable
    ['encrypt', 'decrypt'],
  )
}

/** Exporte une CryptoKey en Base64 (pour stockage dans Vault). */
export async function exportKeyB64(key: CryptoKey): Promise<string> {
  const raw = await crypto.subtle.exportKey('raw', key)
  return btoa(String.fromCharCode(...new Uint8Array(raw)))
}

/** Importe une clé depuis sa représentation Base64. */
export async function importKeyB64(b64: string): Promise<CryptoKey> {
  const raw = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))
  return crypto.subtle.importKey(
    'raw',
    raw,
    { name: ALGORITHM, length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

/**
 * Chiffre un ArrayBuffer avec AES-256-GCM.
 * Retourne un ArrayBuffer : [IV (12 bytes) | ciphertext+tag].
 */
export async function encryptBuffer(plaintext: ArrayBuffer, key: CryptoKey): Promise<ArrayBuffer> {
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH))
  const ciphertext = await crypto.subtle.encrypt({ name: ALGORITHM, iv }, key, plaintext)

  // Concatène IV + ciphertext
  const result = new Uint8Array(IV_LENGTH + ciphertext.byteLength)
  result.set(iv, 0)
  result.set(new Uint8Array(ciphertext), IV_LENGTH)
  return result.buffer
}

/**
 * Déchiffre un ArrayBuffer au format [IV | ciphertext+tag].
 */
export async function decryptBuffer(encrypted: ArrayBuffer, key: CryptoKey): Promise<ArrayBuffer> {
  const bytes = new Uint8Array(encrypted)
  const iv = bytes.slice(0, IV_LENGTH)
  const ciphertext = bytes.slice(IV_LENGTH)
  return crypto.subtle.decrypt({ name: ALGORITHM, iv }, key, ciphertext)
}

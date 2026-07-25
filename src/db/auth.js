/**
 * Hachage de mot de passe compatible werkzeug (backend desktop) :
 * - vérifie les formats « pbkdf2:sha256:ITER$sel$hex » et « scrypt:N:r:p$sel$hex »
 * - génère du « pbkdf2:sha256:600000$sel$hex »
 * Une base exportée depuis le mobile reste donc lisible par Viticole.exe et inversement.
 */
import scryptJs from 'scrypt-js'

const { scrypt } = scryptJs

const enc = new TextEncoder()

function toHex(bytes) {
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('')
}

async function pbkdf2Hex(password, salt, iterations, dkLen) {
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: enc.encode(salt), iterations },
    key,
    dkLen * 8
  )
  return toHex(new Uint8Array(bits))
}

async function scryptHex(password, salt, N, r, p, dkLen) {
  const out = await scrypt(enc.encode(password), enc.encode(salt), N, r, p, dkLen)
  return toHex(out)
}

export async function verifyPassword(hash, password) {
  if (!hash || typeof hash !== 'string') return false
  const [method, salt, digest] = hash.split('$')
  if (!method || !salt || !digest) return false
  try {
    if (method.startsWith('pbkdf2:sha256')) {
      const iterations = parseInt(method.split(':')[2] || '260000', 10)
      const computed = await pbkdf2Hex(password, salt, iterations, digest.length / 2)
      return computed === digest
    }
    if (method.startsWith('scrypt')) {
      const [, n, r, p] = method.split(':').map(Number)
      const computed = await scryptHex(password, salt, n, r, p, digest.length / 2)
      return computed === digest
    }
  } catch {
    return false
  }
  return false
}

const SALT_CHARS = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'

export async function hashPassword(password) {
  const rand = crypto.getRandomValues(new Uint8Array(16))
  const salt = Array.from(rand, b => SALT_CHARS[b % SALT_CHARS.length]).join('')
  const iterations = 600000
  const digest = await pbkdf2Hex(password, salt, iterations, 32)
  return `pbkdf2:sha256:${iterations}$${salt}$${digest}`
}

import { createHash, randomUUID, randomBytes } from 'crypto'

export function hashQrToken(rawToken: string): string {
  return createHash('sha256').update(rawToken).digest('hex')
}

export function generateQrToken(): string {
  return randomUUID()
}

// Kein 0/O, 1/I/L – leicht zu tippen und vorzulesen
const LOGIN_CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'

export function generateLoginCode(): string {
  const bytes = randomBytes(6)
  return Array.from(bytes)
    .map((b) => LOGIN_CODE_CHARS[b % LOGIN_CODE_CHARS.length])
    .join('')
}

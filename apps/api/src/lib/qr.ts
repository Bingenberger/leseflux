import { createHash, randomUUID } from 'crypto'

export function hashQrToken(rawToken: string): string {
  return createHash('sha256').update(rawToken).digest('hex')
}

export function generateQrToken(): string {
  return randomUUID()
}

// No look-alike characters (0/O, 1/l/I), so a password read off a screen is typed correctly.
const ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789'

/** Easy-to-type random password like "kp7r-m2xw-9qfa" (about 59 bits). */
export function generatePassword(groups = 3, groupLength = 4): string {
  const count = groups * groupLength
  const limit = 256 - (256 % ALPHABET.length) // reject biased bytes
  const chars: string[] = []
  while (chars.length < count) {
    const bytes = crypto.getRandomValues(new Uint8Array(count * 2))
    for (const b of bytes) {
      if (b < limit && chars.length < count) chars.push(ALPHABET[b % ALPHABET.length])
    }
  }
  const parts: string[] = []
  for (let i = 0; i < count; i += groupLength) parts.push(chars.slice(i, i + groupLength).join(''))
  return parts.join('-')
}

export const USERNAME_PATTERN = '[a-z0-9][a-z0-9._\\-]{0,31}'
export const USERNAME_HINT = 'Lowercase letters, digits, dot, dash or underscore'

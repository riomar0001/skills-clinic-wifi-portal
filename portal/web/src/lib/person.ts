export const ID_LABEL = 'Student ID / Faculty ID'
export const ID_HINT = 'This is their Wi-Fi username.'
export const EMAIL_DOMAIN = 'umindanao.edu.ph'
/** HTML pattern for a UMindanao address (the server checks the same rule). */
export const EMAIL_PATTERN = `[A-Za-z0-9][A-Za-z0-9._%+\\-]{0,63}@${EMAIL_DOMAIN.replaceAll('.', '\\.')}`
export const EMAIL_HINT = `Must end in @${EMAIL_DOMAIN}`

/** Device limit for new Wi-Fi accounts (admins can change it per person). */
export const DEFAULT_DEVICE_LIMIT = 2

export function fullName(p: { first_name: string; last_name: string }): string {
  return `${p.first_name} ${p.last_name}`.trim()
}

export const THIRDWEB_LOGIN_NONCE_COOKIE = 'pryv-thirdweb-login-nonce'
export const THIRDWEB_LOGIN_NONCE_TTL_SECONDS = 60 * 5
export const THIRDWEB_LOGIN_STATEMENT = 'Sign in to Pryv.'
export const THIRDWEB_LOGIN_VERSION = '1'

const MAX_THIRDWEB_LOGIN_NONCES = 5
const THIRDWEB_LOGIN_NONCE_SEPARATOR = '.'

export function parseThirdwebLoginNonceCookie(value?: string | null): string[] {
  if (!value) return []
  return value
    .split(THIRDWEB_LOGIN_NONCE_SEPARATOR)
    .map((nonce) => nonce.trim())
    .filter(Boolean)
    .slice(-MAX_THIRDWEB_LOGIN_NONCES)
}

export function appendThirdwebLoginNonceCookieValue(
  currentValue: string | null | undefined,
  nonce: string,
): string {
  const nonces = parseThirdwebLoginNonceCookie(currentValue).filter((item) => item !== nonce)
  nonces.push(nonce)
  return nonces.slice(-MAX_THIRDWEB_LOGIN_NONCES).join(THIRDWEB_LOGIN_NONCE_SEPARATOR)
}

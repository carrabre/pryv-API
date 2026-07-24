export function isLikelyWalletAddress(value?: string | null): boolean {
  if (typeof value !== 'string') return false
  const trimmed = value.trim()
  return /^0x[a-fA-F0-9]{40}$/.test(trimmed)
}

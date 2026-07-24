export type AllowedImageMimeType = 'image/png' | 'image/jpeg' | 'image/gif' | 'image/webp'

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
const JPEG_SIGNATURE = [0xff, 0xd8, 0xff]
const GIF87A_SIGNATURE = [0x47, 0x49, 0x46, 0x38, 0x37, 0x61] // GIF87a
const GIF89A_SIGNATURE = [0x47, 0x49, 0x46, 0x38, 0x39, 0x61] // GIF89a
const RIFF_SIGNATURE = [0x52, 0x49, 0x46, 0x46] // RIFF
const WEBP_BRAND_SIGNATURE = [0x57, 0x45, 0x42, 0x50] // WEBP

export function detectAllowedImageMimeType(buffer: ArrayBuffer): AllowedImageMimeType | null {
  const bytes = new Uint8Array(buffer)

  if (bytes.length >= PNG_SIGNATURE.length && hasPrefix(bytes, PNG_SIGNATURE)) {
    return 'image/png'
  }

  if (bytes.length >= JPEG_SIGNATURE.length && hasPrefix(bytes, JPEG_SIGNATURE)) {
    return 'image/jpeg'
  }

  if (bytes.length >= GIF87A_SIGNATURE.length) {
    if (hasPrefix(bytes, GIF87A_SIGNATURE) || hasPrefix(bytes, GIF89A_SIGNATURE)) {
      return 'image/gif'
    }
  }

  if (bytes.length >= 12 && hasPrefix(bytes, RIFF_SIGNATURE)) {
    const brand = bytes.subarray(8, 12)
    if (hasPrefix(brand, WEBP_BRAND_SIGNATURE)) {
      return 'image/webp'
    }
  }

  return null
}

export function extractBase64FromDataUrl(dataUrl: string): string | null {
  const commaIndex = dataUrl.indexOf(',')
  if (commaIndex === -1) return null
  return dataUrl.slice(commaIndex + 1)
}

export function stripDataUrlPrefix(rawBase64OrDataUrl: string | null | undefined): string {
  if (typeof rawBase64OrDataUrl !== 'string') return ''
  const base64Index = rawBase64OrDataUrl.indexOf('base64,')
  if (base64Index === -1) return rawBase64OrDataUrl.trim()
  return rawBase64OrDataUrl.slice(base64Index + 'base64,'.length).trim()
}

export function arrayBufferToDataUrl(buffer: ArrayBuffer, mimeType: AllowedImageMimeType): string {
  const base64 = arrayBufferToBase64(buffer)
  return `data:${mimeType};base64,${base64}`
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  const chunkSize = 0x8000

  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize)
    binary += String.fromCharCode(...chunk)
  }

  return typeof btoa === 'function'
    ? btoa(binary)
    : Buffer.from(binary, 'binary').toString('base64')
}

function hasPrefix(bytes: Uint8Array, signature: Array<number>): boolean {
  if (bytes.length < signature.length) return false
  for (let i = 0; i < signature.length; i++) {
    if (bytes[i] !== signature[i]) return false
  }
  return true
}

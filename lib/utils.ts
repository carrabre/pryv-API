import type {CoreAssistantMessage, CoreToolMessage, UIMessage} from 'ai'
import {type ClassValue, clsx} from 'clsx'
import {twMerge} from 'tailwind-merge'
import type {Document} from '@/lib/db/schema'
import {ChatSDKError, type ErrorCode} from './errors'

export {generateUuid} from './utils/uuid'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const fetcher = async (url: string) => {
  const response = await fetch(url)

  if (!response.ok) {
    const {code, cause} = await response.json()
    throw new ChatSDKError(code as ErrorCode, cause)
  }

  return response.json()
}

export async function fetchWithErrorHandlers(input: RequestInfo | URL, init?: RequestInit) {
  try {
    const response = await fetch(input, init)

    if (!response.ok) {
      const {code, cause} = await response.json()
      throw new ChatSDKError(code as ErrorCode, cause)
    }

    return response
  } catch (error: unknown) {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      throw new ChatSDKError('offline:chat')
    }

    throw error
  }
}

export interface StreamNdjsonOptions {
  onReader?: (reader: ReadableStreamDefaultReader<Uint8Array>) => void
}

export async function* streamNdjson(
  input: RequestInfo | URL,
  init?: RequestInit,
  options?: StreamNdjsonOptions,
): AsyncGenerator<{[key: string]: any}> {
  try {
    const res = await fetch(input, init)
    const contentType = res.headers.get('Content-Type') || ''

    if (contentType.includes('application/json')) {
      const data = await res.json()
      yield data
      return
    }

    // Allow for charset suffixes like "application/x-ndjson; charset=utf-8"
    const isNdjson = contentType.includes('application/x-ndjson') || contentType.includes('ndjson')
    if (!isNdjson) {
      console.error(`Expected an NDJSON response; received: ${contentType}`)
      // Try to continue anyway; some servers omit the header in dev
    }

    if (res.body == null) throw 'body issue'

    const reader = res.body.getReader()
    options?.onReader?.(reader)
    const decoder = new TextDecoder()
    let buffer = ''

    try {
      while (true) {
        const {done, value} = await reader.read()
        if (done) break

        buffer += decoder.decode(value, {stream: true})
        const lines = buffer.split('\n')

        buffer = lines.pop() ?? ''

        for (const line of lines) {
          if (!line.trim()) continue
          const obj = JSON.parse(line)
          yield obj
        }
      }

      // Flush any remaining decoded data and emit the last line if present
      buffer += decoder.decode()
      if (buffer.trim()) {
        const trailing = buffer.trim()
        try {
          const obj = JSON.parse(trailing)
          yield obj
        } catch {
          // If trailing is multiple lines without a newline at EOF
          for (const line of trailing.split('\n')) {
            const l = line.trim()
            if (!l) continue
            try {
              yield JSON.parse(l)
            } catch {
              console.error('Failed to parse a trailing NDJSON line')
            }
          }
        }
      }
    } finally {
      try {
        await reader.cancel()
      } catch {
        // Ignore cancellation errors triggered by early stream termination
      }
    }
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      // Stream has been forcefully stopped
      yield {forcestop: true}
    }
  }
}

export function isValidUuid(id: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
  return uuidRegex.test(id)
}

export function createRegexFromPiiParameters(piiParameters: {
  [placeholder: string]: string
}): RegExp | null {
  const keys = Object.keys(piiParameters)
  if (keys.length === 0) return null
  const pattern = keys.join('|')
  return new RegExp(pattern, 'g')
}

export function estimateDataUriBytes(dataUri: string): number {
  if (!dataUri.startsWith('data:')) return 0
  const commaIndex = dataUri.indexOf(',')
  if (commaIndex < 0) return 0
  const header = dataUri.slice(5, commaIndex).toLowerCase()
  const payload = dataUri.slice(commaIndex + 1)

  if (header.includes(';base64')) {
    const normalized = payload.replace(/\s+/g, '')
    const pad = normalized.endsWith('==') ? 2 : normalized.endsWith('=') ? 1 : 0
    return Math.max(0, Math.floor((normalized.length * 3) / 4) - pad)
  }

  try {
    return new TextEncoder().encode(decodeURIComponent(payload)).length
  } catch {
    return new TextEncoder().encode(payload).length
  }
}

type ResponseMessageWithoutId = CoreToolMessage | CoreAssistantMessage
type ResponseMessage = ResponseMessageWithoutId & {id: string}

export function getMostRecentUserMessage(messages: Array<UIMessage>) {
  const userMessages = messages.filter((message) => message.role === 'user')
  return userMessages.at(-1)
}

export function getDocumentTimestampByIndex(documents: Array<Document>, index: number) {
  if (!documents) return new Date()
  if (index > documents.length) return new Date()

  return documents[index].createdAt
}

export function getTrailingMessageId({
  messages,
}: {
  messages: Array<ResponseMessage>
}): string | null {
  const trailingMessage = messages.at(-1)

  if (!trailingMessage) return null

  return trailingMessage.id
}

export const sessionStorage = {
  setItem(storageKey: string, value: string) {
    try {
      if (typeof globalThis.sessionStorage === 'undefined') return
      globalThis.sessionStorage.setItem(storageKey, value)
    } catch (err) {}
  },
  getItem(storageKey: string) {
    try {
      if (typeof globalThis.sessionStorage === 'undefined') return
      return globalThis.sessionStorage.getItem(storageKey)
    } catch (err) {
      return null
    }
  },
}

// Currency formatters standardized to at most 4 decimal places
export function formatCurrency4(amountMajorUnits: number, currency = 'USD'): string {
  const rounded = Math.round((amountMajorUnits || 0) * 10000) / 10000
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
    minimumFractionDigits: 0,
    maximumFractionDigits: 4,
  }).format(rounded)
}

export function formatUnitAmount4(unitAmountMinorUnits: number, currency = 'USD'): string {
  const major = (unitAmountMinorUnits || 0) / 100
  return formatCurrency4(major, currency)
}

export function formatUsd4(amountUsd: number): string {
  return formatCurrency4(amountUsd, 'USD')
}

/**
 * Calculate usage percentage from spent and max amounts
 * @param spent - Amount spent in the current period
 * @param max - Maximum amount allowed in the period
 * @returns Formatted percentage string (e.g., "45%" or "0%")
 */
export function calculateUsagePercentage(spent: number, max: number): string {
  if (!max || max <= 0) return '0%'
  const percentage = Math.min(100, Math.max(0, (spent / max) * 100))
  return `${Math.round(percentage)}%`
}

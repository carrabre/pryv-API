'use client'

import {memo, useMemo} from 'react'

import type {GeminiMetadata} from '@/hooks/use-chat'
import {cn} from '@/lib/utils'

interface GeminiCitationsProps {
  metadata: GeminiMetadata
  className?: string
}

type Citation = {
  id: string
  url: string | null
  title: string | null
  snippet: string | null
  summary: string | null
}

const MAX_SUMMARY_LENGTH = 280

function truncate(value: string | null | undefined, limit = MAX_SUMMARY_LENGTH): string | null {
  if (!value) return null
  if (value.length <= limit) return value
  return `${value.slice(0, limit).trimEnd()}…`
}

function buildCitations(metadata: GeminiMetadata): Citation[] {
  const citations: Citation[] = []
  const chunkMap = new Map(
    (metadata.groundingMetadata?.groundingChunks ?? []).map((chunk) => [chunk.chunkId, chunk]),
  )
  const seenChunkIds = new Set<string>()

  const supports = metadata.groundingMetadata?.groundingSupports ?? []
  supports.forEach((support) => {
    const chunkIds = support.chunkIds ?? []
    chunkIds.forEach((chunkId) => {
      if (seenChunkIds.has(chunkId)) return
      seenChunkIds.add(chunkId)
      const chunk = chunkMap.get(chunkId)
      if (!chunk) return

      citations.push({
        id: chunkId,
        url: chunk.web?.sourceUrl ?? null,
        title: chunk.web?.title ?? null,
        snippet: truncate(chunk.text),
        summary: truncate(support.summaryText ?? null, 160),
      })
    })
  })

  const anchors = new Map(
    (metadata.urlContextMetadata?.anchors ?? []).map((anchor) => [anchor.url, anchor.chunkId]),
  )

  const resolvedUrls = metadata.urlContextMetadata?.resolvedUrls ?? []
  resolvedUrls.forEach(({url, title}) => {
    if (!url) return
    const chunkId = anchors.get(url)
    if (chunkId && seenChunkIds.has(chunkId)) {
      return
    }
    const exists = citations.some((citation) => citation.url === url)
    if (exists) return
    citations.push({
      id: chunkId ?? url,
      url,
      title: title ?? null,
      snippet: null,
      summary: null,
    })
  })

  return citations
}

function formatLinkText(title: string | null, url: string | null): string {
  if (title && title.trim().length > 0) return title.trim()
  if (!url) return 'Source'
  try {
    const parsed = new URL(url)
    return parsed.hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

function Queries({queries}: {queries: Array<string>}) {
  if (!queries.length) return null

  return (
    <div className='flex flex-wrap gap-2 text-[10px] uppercase tracking-wide text-muted-foreground'>
      {queries.map((query) => (
        <a
          key={query}
          href={`https://www.google.com/search?q=${encodeURIComponent(query)}`}
          target='_blank'
          rel='noopener noreferrer'
          className='rounded-full border border-muted-foreground/30 px-2 py-0.5 hover:bg-muted-foreground/10 hover:border-muted-foreground/50 transition-all duration-150 cursor-pointer'
        >
          {query}
        </a>
      ))}
    </div>
  )
}

function PureGeminiCitations({metadata, className}: GeminiCitationsProps) {
  const citations = useMemo(() => buildCitations(metadata), [metadata])
  const queries = metadata.groundingMetadata?.webSearchQueries ?? []
  const hasRequestId = typeof metadata.requestId === 'string' && metadata.requestId.length > 0

  if (citations.length === 0 && queries.length === 0) {
    return null
  }

  return (
    <div
      className={cn(
        'mt-2 rounded-lg border border-border/70 bg-muted/30 p-3 text-xs text-muted-foreground space-y-3',
        className,
      )}
      data-testid='gemini-citations'
    >
      <div className='flex flex-wrap items-center justify-between gap-2 text-[11px] font-semibold uppercase text-foreground/70'>
        <span>Sources</span>
        {hasRequestId && (
          <span className='font-normal text-[10px] tracking-normal text-muted-foreground'>
            request: {metadata.requestId}
          </span>
        )}
      </div>

      {citations.length > 0 && (
        <ol className='space-y-2 text-foreground/90'>
          {citations.map((citation, index) => (
            <li key={`${citation.id}-${index}`} className='flex gap-2'>
              <span className='mt-[2px] text-[11px] font-semibold text-muted-foreground'>
                [{index + 1}]
              </span>
              <div className='flex-1 space-y-1 break-words'>
                {citation.url ? (
                  <a
                    href={citation.url}
                    target='_blank'
                    rel='noopener noreferrer'
                    className='font-medium text-foreground hover:underline'
                  >
                    {formatLinkText(citation.title, citation.url)}
                  </a>
                ) : (
                  <span className='font-medium text-foreground'>
                    {formatLinkText(citation.title, citation.url)}
                  </span>
                )}
                {citation.snippet && (
                  <p className='text-xs leading-snug text-muted-foreground'>{citation.snippet}</p>
                )}
                {citation.summary && (
                  <p className='text-xs leading-snug text-muted-foreground/80 italic'>
                    {citation.summary}
                  </p>
                )}
              </div>
            </li>
          ))}
        </ol>
      )}

      <Queries queries={queries} />
    </div>
  )
}

export const GeminiCitations = memo(
  PureGeminiCitations,
  (prev, next) => prev.metadata === next.metadata && prev.className === next.className,
)

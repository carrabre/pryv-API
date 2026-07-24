'use client'

import {memo} from 'react'
import type {XaiMetadata} from '@/hooks/use-chat'

interface XaiCitationsProps {
  metadata: XaiMetadata
  className?: string
}

function formatLinkText(title: string | null | undefined, url: string): string {
  if (title && title.trim().length > 0) return title.trim()
  try {
    const parsed = new URL(url)
    return parsed.hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

function PureXaiCitations({metadata, className}: XaiCitationsProps) {
  const sources = metadata.sources ?? []
  const queries = metadata.searchQueries ?? []

  if (sources.length === 0 && queries.length === 0) return null

  return (
    <div className={`space-y-3 text-xs ${className ?? ''}`}>
      <div className='flex items-center gap-2'>
        <span className='text-[10px] uppercase tracking-wide text-muted-foreground font-medium'>
          Web Search Sources
        </span>
      </div>

      {sources.length > 0 && (
        <ol className='space-y-2 text-foreground/90'>
          {sources.map((source, index) => (
            <li key={`${source.url}-${index}`} className='flex gap-2'>
              <span className='mt-[2px] text-[11px] font-semibold text-muted-foreground'>
                [{index + 1}]
              </span>
              <div className='flex-1 space-y-1 break-words'>
                <a
                  href={source.url}
                  target='_blank'
                  rel='noopener noreferrer'
                  className='font-medium text-foreground hover:underline'
                >
                  {formatLinkText(source.title, source.url)}
                </a>
                {source.snippet && (
                  <p className='text-xs leading-snug text-muted-foreground'>{source.snippet}</p>
                )}
              </div>
            </li>
          ))}
        </ol>
      )}

      {queries.length > 0 && (
        <div className='flex flex-wrap gap-2 text-[10px] uppercase tracking-wide text-muted-foreground'>
          {queries.map((query) => (
            <a
              key={query}
              href={`https://www.google.com/search?q=${encodeURIComponent(query)}`}
              target='_blank'
              rel='noopener noreferrer'
              className='rounded-full border border-muted-foreground/30 px-2 py-0.5 hover:bg-muted-foreground/10 hover:border-muted-foreground/50 transition-colors cursor-pointer'
            >
              {query}
            </a>
          ))}
        </div>
      )}
    </div>
  )
}

export const XaiCitations = memo(
  PureXaiCitations,
  (prevProps, nextProps) => prevProps.metadata === nextProps.metadata,
)

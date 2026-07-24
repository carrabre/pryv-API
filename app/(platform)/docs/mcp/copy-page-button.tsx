'use client'

import type {MouseEvent} from 'react'
import {useState} from 'react'

function getPageText(button: HTMLButtonElement) {
  const root = button.closest('[data-copy-root]') as HTMLElement | null
  return (root?.innerText ?? '').replace(/\n{3,}/g, '\n\n').trim()
}

export function CopyPageButton() {
  const [copied, setCopied] = useState(false)

  async function handleCopy(event: MouseEvent<HTMLButtonElement>) {
    const text = getPageText(event.currentTarget)
    if (!text) return

    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    } catch {}
  }

  return (
    <button
      type='button'
      onClick={handleCopy}
      className='inline-flex items-center gap-2 rounded-md border border-border bg-background px-5 py-2 text-sm font-semibold text-foreground transition hover:bg-muted'
      aria-label='Copy page'
    >
      <svg className='h-3.5 w-3.5' viewBox='0 0 24 24' aria-hidden='true' focusable='false'>
        <use href='/platform-icons.svg#copy' />
      </svg>
      {copied ? 'Copied page' : 'Copy page'}
    </button>
  )
}

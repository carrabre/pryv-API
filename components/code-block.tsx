'use client'

import type {Element} from 'hast'
import {useState} from 'react'
import type {ReactNode} from 'react'

interface CodeBlockProps {
  node?: Element
  inline?: boolean
  className?: string
  children?: ReactNode
}

export function CodeBlock({inline = false, className = '', children, ...props}: CodeBlockProps) {
  if (inline) {
    return (
      <code
        className={`${className} text-sm bg-zinc-100 dark:bg-zinc-800 py-0.5 px-1 rounded-md`}
        {...props}
      >
        {children}
      </code>
    )
  }

  const lang = (className || '').replace('language-', '')
  const code = String(children ?? '')
  const [copied, setCopied] = useState(false)

  async function onCopy() {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {}
  }

  return (
    <div className='not-prose relative my-4'>
      {lang && (
        <span className='absolute left-2 top-2 text-[10px] md:text-xs opacity-70 select-none'>
          {lang}
        </span>
      )}
      <button
        type='button'
        onClick={onCopy}
        className='absolute right-2 top-2 rounded-md border border-border bg-background px-2 py-1 text-[10px] md:text-xs opacity-80 hover:opacity-100'
        aria-label='Copy code'
      >
        {copied ? 'Copied' : 'Copy'}
      </button>
      <pre
        {...props}
        className={`text-sm w-full overflow-x-auto dark:bg-zinc-900 p-4 pt-8 border border-zinc-200 dark:border-zinc-700 rounded-xl dark:text-zinc-50 text-zinc-900 ${className}`}
      >
        <code className='whitespace-pre-wrap break-words'>{children}</code>
      </pre>
    </div>
  )
}

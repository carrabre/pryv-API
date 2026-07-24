'use client'

import {cn} from '@/lib/utils'
import {memo, useEffect, useState, type ReactNode} from 'react'
import type {Plugin} from 'unified'
import type {Literal, Parent} from 'unist'
import {visit} from 'unist-util-visit'

export interface PiiRevealTextProps {
  piiPlaceholderText: string
  children: ReactNode
}

const PurePiiRevealText = ({piiPlaceholderText, children}: PiiRevealTextProps) => {
  const DURATION_TILL_REVEAL = 1350

  const [isRevealed, setIsRevealed] = useState(false)
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setIsRevealed(true)
    }, DURATION_TILL_REVEAL)

    return () => clearTimeout(timeoutId)
  }, [])

  return (
    <span className='relative text-center z-0'>
      <span
        className={cn(
          'italic whitespace-pre select-none -z-10 transition-opacity',
          isRevealed ? 'absolute left-0 top-0' : '',
          isRevealed ? 'opacity-0' : 'opacity-100',
        )}
      >
        {piiPlaceholderText}
      </span>

      <span
        className={cn(
          'whitespace-pre transition-opacity',
          isRevealed ? '' : 'absolute left-0 top-0',
          isRevealed ? 'opacity-100' : 'opacity-0',
        )}
      >
        {children}
      </span>
    </span>
  )
}

export const PiiRevealText = memo(PurePiiRevealText, (prevProps, nextProps) => {
  if (prevProps.piiPlaceholderText !== nextProps.piiPlaceholderText) return false
  return true
})

interface PiiTextNode extends Literal {
  type: 'piitext'
  data: {
    hName: 'piitext'
    hProperties: {
      piiPlaceholderText: string
      piiText: string
    }
  }
  value: ''
}

const SPLIT_CHAR = '='
const piiPlaceholderRegexGlobal = /<([A-Z]+(?:_[A-Z]+)*)_(\d+)=[^>]+>/g

/** Function for matching the required PII pattern inside `<ReactMarkdown />` */
export const remarkPiiTexts: Plugin = () => {
  return (tree) => {
    visit(tree, 'text', (node: Literal, index: number | null, parent: Parent | null) => {
      if (parent == null || typeof node.value !== 'string') return

      const children: Literal[] = []
      const text = node.value
      let lastIndex = 0

      const matches = text.matchAll(piiPlaceholderRegexGlobal)
      for (const match of matches) {
        const [fullMatch] = match
        let [piiPlaceholderText, piiText] = fullMatch.split(SPLIT_CHAR)

        // Remove "<" and ">"
        piiPlaceholderText = piiPlaceholderText.slice(1)
        piiText = piiText.slice(0, -1)

        const startIndex = match.index

        if (startIndex > lastIndex) {
          children.push({
            type: 'text',
            value: text.slice(lastIndex, startIndex),
          })
        }

        const piiTextNode: PiiTextNode = {
          type: 'piitext',
          data: {
            hName: 'piitext',
            hProperties: {
              piiPlaceholderText,
              piiText,
            },
          },
          value: '',
        }

        children.push(piiTextNode)
        lastIndex = startIndex + fullMatch.length
      }

      if (lastIndex < text.length) {
        children.push({
          type: 'text',
          value: text.slice(lastIndex),
        })
      }

      if (children.length > 0 && index !== null) {
        parent.children.splice(index, 1, ...children)
      }
    })
  }
}

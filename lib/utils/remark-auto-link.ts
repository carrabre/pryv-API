import {visit} from 'unist-util-visit'
import type {Root, Text, Link} from 'mdast'

/**
 * Remark plugin to automatically convert bare URLs to clickable links
 * This handles URLs that are not already wrapped in markdown link syntax
 */
export function remarkAutoLink() {
  return (tree: Root) => {
    visit(tree, 'text', (node: Text, index, parent) => {
      if (!parent || typeof index !== 'number') return

      // Skip if parent is already a link
      if (parent.type === 'link') return

      const text = node.value

      // Regex to match URLs (http, https)
      // This is a simplified regex - matches most common URLs
      const urlRegex = /(https?:\/\/[^\s<>"\]]+)/g

      const matches = [...text.matchAll(urlRegex)]

      if (matches.length === 0) return

      const newNodes: Array<Text | Link> = []
      let lastIndex = 0

      for (const match of matches) {
        const url = match[0]
        const startIndex = match.index ?? 0

        // Add text before the URL
        if (startIndex > lastIndex) {
          newNodes.push({
            type: 'text',
            value: text.slice(lastIndex, startIndex),
          })
        }

        // Add the URL as a link
        newNodes.push({
          type: 'link',
          url: url,
          children: [
            {
              type: 'text',
              value: url,
            },
          ],
        })

        lastIndex = startIndex + url.length
      }

      // Add remaining text after the last URL
      if (lastIndex < text.length) {
        newNodes.push({
          type: 'text',
          value: text.slice(lastIndex),
        })
      }

      // Replace the text node with the new nodes
      if (newNodes.length > 0) {
        parent.children.splice(index, 1, ...newNodes)
      }
    })
  }
}

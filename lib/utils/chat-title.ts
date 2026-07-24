/**
 * Utility functions for generating chat titles
 */

/**
 * Generates a concise title from a message
 * Truncates to a reasonable length and ensures it ends at a word boundary
 */
export function generateTitleFromMessage(message: string): string {
  if (!message || message.trim().length === 0) {
    return 'New Chat'
  }

  const cleaned = message.trim()
  const maxLength = 50

  // If message is short enough, use it as-is
  if (cleaned.length <= maxLength) {
    return cleaned
  }

  // Truncate at word boundary
  const truncated = cleaned.substring(0, maxLength)
  const lastSpace = truncated.lastIndexOf(' ')

  if (lastSpace > maxLength * 0.6) {
    // If we found a space in the latter part, use it
    return `${truncated.substring(0, lastSpace)}...`
  }

  // Otherwise just truncate with ellipsis
  return `${truncated}...`
}

/**
 * Checks if a title is a default/placeholder title
 */
export function isDefaultTitle(title: string): boolean {
  return title === 'New Chat' || title === 'Untitled' || !title || title.trim().length === 0
}

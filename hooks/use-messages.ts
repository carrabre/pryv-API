import {useState, useEffect} from 'react'
import {useScrollToBottom} from './use-scroll-to-bottom'
import {chatLoadCountAtom, chatRequestCountAtom, type UseChatHelpers} from './use-chat'
import {useAtomValue} from 'jotai'

export function useMessages({
  chatId,
  status,
  messages,
}: {
  chatId: string
  status: UseChatHelpers['status']
  messages: UseChatHelpers['messages']
}) {
  const {containerRef, endRef, isAtBottom, scrollToBottom, onViewportEnter, onViewportLeave} =
    useScrollToBottom()

  const [hasSentMessage, setHasSentMessage] = useState(false)
  const chatRequestCount = useAtomValue(chatRequestCountAtom)
  const chatLoadCount = useAtomValue(chatLoadCountAtom)

  useEffect(() => {
    if (chatId) {
      scrollToBottom('instant')
      setHasSentMessage(false)
    }
  }, [chatLoadCount, scrollToBottom])

  useEffect(() => {
    if (status === 'submitted') {
      setHasSentMessage(true)
    }
  }, [status])

  useEffect(() => {
    if (hasSentMessage) scrollToBottom('smooth')
  }, [chatRequestCount, scrollToBottom])

  useEffect(() => {
    if (hasSentMessage && messages.length > 0) scrollToBottom('smooth')
  }, [messages.length])

  return {
    containerRef,
    endRef,
    isAtBottom,
    scrollToBottom,
    onViewportEnter,
    onViewportLeave,
    hasSentMessage,
  }
}

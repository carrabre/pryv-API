'use client'

import type {ChatMessage, UseChatHelpers} from '@/hooks/use-chat'
import {type Dispatch, type SetStateAction, useEffect, useRef, useState} from 'react'
import {Button} from './ui/button'
import {Textarea} from './ui/textarea'

export type MessageEditorProps = {
  message: ChatMessage
  onCreateBranchFromEdit?: UseChatHelpers['createBranchFromEdit']
  setMode: Dispatch<SetStateAction<'view' | 'edit'>>
  reload: UseChatHelpers['reload']
}

export function MessageEditor({
  message,
  onCreateBranchFromEdit = async () => {},
  setMode,
  reload,
}: MessageEditorProps) {
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false)

  const [draftContent, setDraftContent] = useState<string>(message.content)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (textareaRef.current) {
      adjustHeight()
    }
  }, [])

  const adjustHeight = () => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight + 2}px`
    }
  }

  const handleInput = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setDraftContent(event.target.value)
    adjustHeight()
  }

  return (
    <div className='flex flex-col gap-2 w-full'>
      <Textarea
        data-testid='message-editor'
        ref={textareaRef}
        className='bg-transparent outline-none overflow-hidden resize-none !text-base rounded-xl w-full'
        value={draftContent}
        onChange={handleInput}
      />

      <div className='flex flex-row gap-2 justify-end'>
        <Button
          variant='outline'
          className='h-fit py-2 px-3'
          onClick={() => {
            setMode('view')
          }}
        >
          Cancel
        </Button>
        <Button
          data-testid='message-editor-send-button'
          variant='default'
          className='h-fit py-2 px-3'
          disabled={isSubmitting}
          onClick={async () => {
            setIsSubmitting(true)
            try {
              await onCreateBranchFromEdit({
                originalMessageId: message.id,
                newContent: draftContent,
              })
              setMode('view')
              reload()
            } finally {
              setIsSubmitting(false)
            }
          }}
        >
          {isSubmitting ? 'Sending...' : 'Send'}
        </Button>
      </div>
    </div>
  )
}

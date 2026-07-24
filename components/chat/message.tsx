'use client'

import type {ChatMessage, UseChatHelpers} from '@/hooks/use-chat'
import type {Vote} from '@/lib/db/schema'
import {cn} from '@/lib/utils'
import cx from 'classnames'
import equal from 'fast-deep-equal'
import {motion} from 'framer-motion'
import {memo, useState} from 'react'
import {getModel} from '@/lib/ai/models'
import {toast} from 'sonner'
import {useCopyToClipboard} from 'usehooks-ts'
import {MoreHorizontal} from 'lucide-react'
import {Markdown} from '../markdown'
import {GeminiCitations} from './message-citations'
import {XaiCitations} from './xai-citations'
import {MessageEditor} from '../message-editor'
import {MessageActions} from '../message-actions'
import {LottieLoader} from '../lottie-loader'
import {CopyIcon} from '../icons'
import {Button} from '../ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu'

const PureMessage = ({
  message,
  dataStream,
  onCreateBranchFromEdit,
  onOpenVersions,
  hasVersions,
  vote,
  isLoading,
  reload,
  isReadonly,
}: {
  message: ChatMessage | null
  dataStream: UseChatHelpers['dataStream']
  onCreateBranchFromEdit?: UseChatHelpers['createBranchFromEdit']
  onOpenVersions?: (messageId: string) => void
  hasVersions?: boolean
  vote?: Vote | undefined
  isLoading: boolean
  reload: UseChatHelpers['reload']
  isReadonly: boolean
}) => {
  const [mode, setMode] = useState<'view' | 'edit'>('view')
  const [_, copyToClipboard] = useCopyToClipboard()

  const messageContent: ChatMessage['content'] = message?.content ?? ''
  const messageRole: ChatMessage['role'] = message?.role ?? 'assistant'

  return (
    <motion.div
      data-testid={`message-${messageRole}`}
      className='w-full mx-auto max-w-3xl px-3 md:px-4 group/message'
      initial={{y: 5, opacity: 0}}
      animate={{y: 0, opacity: 1}}
      transition={{duration: 0.2}}
      data-role={messageRole}
    >
      <div
        className={cn(
          'flex gap-3 md:gap-4 w-full group-data-[role=user]/message:ml-auto group-data-[role=user]/message:max-w-2xl',
          {
            'w-full': mode === 'edit',
            'group-data-[role=user]/message:w-fit': mode !== 'edit',
          },
        )}
      >
        {messageRole === 'assistant' && <div className='size-7 md:size-8' />}

        <div className='flex flex-col gap-3 md:gap-4 w-full'>
          {mode === 'view' ? (
            <div className='flex flex-row gap-2 items-start'>
              {messageRole === 'user' && !isReadonly && message != null && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      data-testid='message-actions-menu'
                      variant='ghost'
                      className='px-2 h-fit rounded-full text-muted-foreground opacity-0 group-hover/message:opacity-100'
                      aria-label='Message actions'
                    >
                      <MoreHorizontal className='h-4 w-4' />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align='start' className='w-48'>
                    <DropdownMenuItem
                      data-testid='message-copy-button'
                      className='cursor-pointer'
                      onClick={async () => {
                        if (!message.content) {
                          toast.error("There's no text to copy!")
                          return
                        }
                        await copyToClipboard(message.content)
                        toast.success('Copied to clipboard!')
                      }}
                    >
                      <span className='mr-2 inline-flex'>
                        <CopyIcon />
                      </span>
                      Copy prompt
                    </DropdownMenuItem>

                    <DropdownMenuItem
                      data-testid='message-edit-button'
                      className='cursor-pointer'
                      onClick={() => setMode('edit')}
                    >
                      Edit prompt
                    </DropdownMenuItem>

                    {hasVersions && onOpenVersions && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          data-testid='message-view-versions'
                          className='cursor-pointer'
                          onClick={() => onOpenVersions(message.id)}
                        >
                          View versions…
                        </DropdownMenuItem>
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}

              <div
                data-testid='message-content'
                className={cn('flex flex-col gap-3 md:gap-4', {
                  'bg-primary text-primary-foreground px-3 py-2 md:px-3 md:py-2 rounded-xl':
                    messageRole === 'user',
                })}
              >
                {dataStream != null ? (
                  <Markdown>{dataStream.content}</Markdown>
                ) : (
                  <>
                    <Markdown>{messageContent}</Markdown>
                    {messageRole === 'assistant' && message?.metadata?.gemini && (
                      <GeminiCitations metadata={message.metadata.gemini} />
                    )}
                    {messageRole === 'assistant' && message?.metadata?.xai && (
                      <XaiCitations metadata={message.metadata.xai} />
                    )}
                  </>
                )}
              </div>
            </div>
          ) : (
            <div className='flex flex-row gap-2 items-start'>
              <div className='size-7 md:size-8' />

              {message != null && (
                <MessageEditor
                  key={message.id}
                  message={message}
                  setMode={setMode}
                  onCreateBranchFromEdit={onCreateBranchFromEdit}
                  reload={reload}
                />
              )}
            </div>
          )}

          {message != null && message.role === 'assistant' && message.modelId != null && (
            <div className='text-[12px] text-gray-400'>
              Model used: {getModel(message.modelId).name}
            </div>
          )}

          {message != null && !isReadonly && (
            <MessageActions
              key={`action-${message.id}`}
              message={message}
              vote={vote}
              isLoading={isLoading}
            />
          )}
        </div>
      </div>
    </motion.div>
  )
}

export const Message = memo(PureMessage, (prevProps, nextProps) => {
  if (prevProps.isLoading !== nextProps.isLoading) return false
  if (prevProps.message?.content !== nextProps.message?.content) return false
  if (prevProps.dataStream !== nextProps.dataStream) return false
  if (!equal(prevProps.vote, nextProps.vote)) return false
  return true
})

export const ThinkingMessage = () => {
  const role = 'assistant'

  return (
    <motion.div
      data-testid='message-assistant-loading'
      className='w-full mx-auto max-w-3xl px-3 md:px-4 group/message'
      initial={{y: 5, opacity: 0}}
      animate={{y: 0, opacity: 1}}
      transition={{duration: 0.2}}
      data-role={role}
    >
      <div
        className={cx(
          'flex gap-3 md:gap-4 group-data-[role=user]/message:px-3 w-full group-data-[role=user]/message:w-fit group-data-[role=user]/message:ml-auto group-data-[role=user]/message:max-w-2xl group-data-[role=user]/message:py-2 rounded-xl',
          {
            'group-data-[role=user]/message:bg-muted': true,
          },
        )}
      >
        <div className='flex items-center justify-center w-full py-4'>
          <LottieLoader size='lg' />
        </div>
      </div>
    </motion.div>
  )
}

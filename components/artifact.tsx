import type {Attachment, UIMessage} from 'ai'
import {formatDistance} from 'date-fns'
import {AnimatePresence, motion} from 'framer-motion'
import {type Dispatch, memo, type SetStateAction, useCallback, useEffect, useState} from 'react'
import useSWR, {useSWRConfig} from 'swr'
import {useDebounceCallback, useWindowSize} from 'usehooks-ts'
import type {Document, Vote} from '@/lib/db/schema'
import {fetcher} from '@/lib/utils'
import {toast} from 'sonner'
import {Toolbar} from './toolbar'
import {VersionFooter} from './version-footer'
import {ArtifactActions} from './artifact-actions'
import {ArtifactCloseButton} from './artifact-close-button'
import {ArtifactMessages} from './artifact-messages'
import {useSidebar} from './ui/sidebar'
import {useArtifact} from '@/hooks/use-artifact'
import {imageArtifact} from '@/artifacts/image/client'
import {codeArtifact} from '@/artifacts/code/client'
import {sheetArtifact} from '@/artifacts/sheet/client'
import {textArtifact} from '@/artifacts/text/client'
import equal from 'fast-deep-equal'
import type {UseChatHelpers} from '@ai-sdk/react'
import type {VisibilityType} from './visibility-selector'

export const artifactDefinitions = [textArtifact, codeArtifact, imageArtifact, sheetArtifact]
export type ArtifactKind = (typeof artifactDefinitions)[number]['kind']

export interface UIArtifact {
  title: string
  documentId: string
  kind: ArtifactKind
  content: string
  isVisible: boolean
  status: 'streaming' | 'idle'
  boundingBox: {
    top: number
    left: number
    width: number
    height: number
  }
}

type ArtifactProps = {
  chatId: string
  input: string
  setInput: UseChatHelpers['setInput']
  status: UseChatHelpers['status']
  stop: UseChatHelpers['stop']
  attachments: Array<Attachment>
  setAttachments: Dispatch<SetStateAction<Array<Attachment>>>
  messages: Array<UIMessage>
  setMessages: UseChatHelpers['setMessages']
  votes: Array<Vote> | undefined
  append: UseChatHelpers['append']
  handleSubmit: UseChatHelpers['handleSubmit']
  reload: UseChatHelpers['reload']
  isReadonly: boolean
  selectedVisibilityType: VisibilityType
  selectedModelId?: string
  onModelChange?: (modelId: string) => void
  isModelSyncing?: boolean
}

function PureArtifact({
  chatId,
  input,
  setInput,
  handleSubmit,
  status,
  stop,
  attachments,
  setAttachments,
  append,
  messages,
  setMessages,
  reload,
  votes,
  isReadonly,
  selectedVisibilityType,
  selectedModelId,
  onModelChange,
  isModelSyncing,
}: {
  chatId: string
  input: string
  setInput: UseChatHelpers['setInput']
  status: UseChatHelpers['status']
  stop: UseChatHelpers['stop']
  attachments: Array<Attachment>
  setAttachments: Dispatch<SetStateAction<Array<Attachment>>>
  messages: Array<UIMessage>
  setMessages: UseChatHelpers['setMessages']
  votes: Array<Vote> | undefined
  append: UseChatHelpers['append']
  handleSubmit: UseChatHelpers['handleSubmit']
  reload: UseChatHelpers['reload']
  isReadonly: boolean
  selectedVisibilityType: VisibilityType
  selectedModelId?: string
  onModelChange?: (modelId: string) => void
  isModelSyncing?: boolean
}) {
  const {artifact, setArtifact, metadata, setMetadata} = useArtifact()

  // ESC key handler for closing artifact
  useEffect(() => {
    const handleEscKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && artifact.isVisible) {
        setArtifact((currentArtifact) => ({
          ...currentArtifact,
          isVisible: false,
        }))
      }
    }

    if (artifact.isVisible) {
      window.document.addEventListener('keydown', handleEscKey)
      return () => window.document.removeEventListener('keydown', handleEscKey)
    }
  }, [artifact.isVisible, setArtifact])

  // Click outside handler for closing artifact
  const handleBackdropClick = useCallback(
    (event: React.MouseEvent) => {
      // Only close if clicking on the backdrop itself, not its children
      if (event.target === event.currentTarget) {
        setArtifact((currentArtifact) => ({
          ...currentArtifact,
          isVisible: false,
        }))
      }
    },
    [setArtifact],
  )

  const {
    data: documents,
    isLoading: isDocumentsFetching,
    mutate: mutateDocuments,
  } = useSWR<Array<Document>>(
    artifact.documentId !== 'init' && artifact.status !== 'streaming'
      ? `/api/document?id=${artifact.documentId}`
      : null,
    fetcher,
  )

  const [mode, setMode] = useState<'edit' | 'diff'>('edit')
  const [documentData, setDocumentData] = useState<Document | null>(null)
  const [currentVersionIndex, setCurrentVersionIndex] = useState(-1)

  const {open: isSidebarOpen} = useSidebar()

  useEffect(() => {
    if (documents && documents.length > 0) {
      const mostRecentDocument = documents.at(-1)

      if (mostRecentDocument) {
        setDocumentData(mostRecentDocument)
        setCurrentVersionIndex(documents.length - 1)
        setArtifact((currentArtifact) => ({
          ...currentArtifact,
          content: mostRecentDocument.content ?? '',
        }))
      }
    }
  }, [documents, setArtifact])

  useEffect(() => {
    mutateDocuments()
  }, [artifact.status, mutateDocuments])

  const {mutate} = useSWRConfig()

  const debouncedSaveContent = useDebounceCallback(
    useCallback(
      async (content: string) => {
        if (isReadonly) {
          return
        }

        if (artifact.status === 'streaming') {
          return
        }

        const response = await fetch(`/api/document?id=${artifact.documentId}`, {
          method: 'POST',
          body: JSON.stringify({
            title: artifact.title,
            content,
          }),
        })

        if (!response.ok) {
          toast.error('Failed to save document!')
        }

        mutate(`/api/document?id=${artifact.documentId}`)
      },
      [artifact.documentId, artifact.title, artifact.status, isReadonly, mutate],
    ),
    2000,
  )

  const [isContentDirty, setIsContentDirty] = useState(false)

  const saveContent = useCallback(
    (content: string) => {
      setIsContentDirty(true)

      setArtifact((currentArtifact) => ({
        ...currentArtifact,
        content,
      }))

      debouncedSaveContent(content)

      const timeoutId = setTimeout(() => {
        setIsContentDirty(false)
      }, 2000)

      return () => clearTimeout(timeoutId)
    },
    [setArtifact, debouncedSaveContent],
  )

  function getDocumentContentById(index: number) {
    if (!documents) return ''
    if (!documents[index]) return ''
    return documents[index].content ?? ''
  }

  const handleVersionChange = (type: 'next' | 'prev' | 'toggle' | 'latest') => {
    if (!documents) return

    if (type === 'latest') {
      setCurrentVersionIndex(documents.length - 1)
      setMode('edit')
    }

    if (type === 'toggle') {
      setMode((mode) => (mode === 'edit' ? 'diff' : 'edit'))
    }

    if (type === 'prev') {
      if (currentVersionIndex > 0) {
        setCurrentVersionIndex((index) => index - 1)
      }
    } else if (type === 'next') {
      if (currentVersionIndex < documents.length - 1) {
        setCurrentVersionIndex((index) => index + 1)
      }
    }
  }

  const [isToolbarVisible, setIsToolbarVisible] = useState(false)

  /*
   * NOTE: if there are no documents, or if
   * the documents are being fetched, then
   * we mark it as the current version.
   */

  const isCurrentVersion =
    documents && documents.length > 0 ? currentVersionIndex === documents.length - 1 : true

  const {width: windowWidth, height: windowHeight} = useWindowSize()
  const isMobile = windowWidth ? windowWidth < 768 : false

  const artifactDefinition = artifactDefinitions.find(
    (definition) => definition.kind === artifact.kind,
  )

  if (!artifactDefinition) {
    throw new Error('Artifact definition not found!')
  }

  useEffect(() => {
    if (artifact.documentId !== 'init') {
      if (artifactDefinition.initialize) {
        artifactDefinition.initialize({
          documentId: artifact.documentId,
          setMetadata,
        })
      }
    }
  }, [artifact.documentId, artifactDefinition, setMetadata])

  return (
    <AnimatePresence>
      {artifact.isVisible && (
        <motion.div
          data-testid='artifact'
          className='flex flex-row h-dvh w-dvw fixed top-0 left-0 z-50 bg-black/20 backdrop-blur-sm cursor-pointer'
          initial={{opacity: 0}}
          animate={{opacity: 1}}
          exit={{opacity: 0, transition: {delay: 0.4}}}
          onClick={handleBackdropClick}
        >
          {!isMobile && (
            <motion.div
              className='fixed bg-background h-dvh cursor-default'
              initial={{
                width: isSidebarOpen ? windowWidth - 256 : windowWidth,
                right: 0,
              }}
              animate={{width: windowWidth, right: 0}}
              exit={{
                width: isSidebarOpen ? windowWidth - 256 : windowWidth,
                right: 0,
              }}
              onClick={(e) => e.stopPropagation()}
            />
          )}

          <motion.div
            className='relative w-[400px] bg-muted dark:bg-background h-dvh shrink-0 cursor-default'
            initial={{opacity: 0, x: 10, scale: 1}}
            animate={{
              opacity: 1,
              x: 0,
              scale: 1,
              transition: {
                delay: 0.2,
                type: 'spring',
                stiffness: 200,
                damping: 30,
              },
            }}
            exit={{
              opacity: 0,
              x: 0,
              scale: 1,
              transition: {duration: 0},
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <AnimatePresence>
              {!isCurrentVersion && (
                <motion.div
                  className='left-0 absolute h-dvh w-[400px] top-0 bg-zinc-900/50 z-50'
                  initial={{opacity: 0}}
                  animate={{opacity: 1}}
                  exit={{opacity: 0}}
                />
              )}
            </AnimatePresence>

            <div className='flex flex-col h-full justify-between items-center'>
              <ArtifactMessages
                chatId={chatId}
                status={status}
                votes={votes}
                messages={messages}
                setMessages={setMessages}
                reload={reload}
                isReadonly={isReadonly}
                artifactStatus={artifact.status}
              />

              <form className='flex flex-row gap-2 relative items-end w-full px-4 pb-4'>
                {/* <MultimodalInput
                  chatId={chatId}
                  input={input}
                  setInput={setInput}
                  handleSubmit={handleSubmit}
                  status={status}
                  onStop={stop}
                  attachments={attachments}
                  setAttachments={setAttachments}
                  messages={messages}
                  append={append}
                  className='bg-background dark:bg-muted'
                  setMessages={setMessages}
                  selectedVisibilityType={selectedVisibilityType}
                  isOnLandingPage={false}
                  chatModel={selectedModelId}
                  onModelChange={onModelChange}
                  isModelSyncing={isModelSyncing}
                /> */}
              </form>
            </div>
          </motion.div>

          <motion.div
            className='fixed dark:bg-muted bg-background h-dvh flex flex-col overflow-y-scroll md:border-l dark:border-zinc-700 border-zinc-200 cursor-default'
            initial={
              isMobile
                ? {
                    opacity: 1,
                    x: artifact.boundingBox.left,
                    y: artifact.boundingBox.top,
                    height: artifact.boundingBox.height,
                    width: artifact.boundingBox.width,
                    borderRadius: 50,
                  }
                : {
                    opacity: 1,
                    x: artifact.boundingBox.left,
                    y: artifact.boundingBox.top,
                    height: artifact.boundingBox.height,
                    width: artifact.boundingBox.width,
                    borderRadius: 50,
                  }
            }
            animate={
              isMobile
                ? {
                    opacity: 1,
                    x: 0,
                    y: 0,
                    height: windowHeight,
                    width: windowWidth ? windowWidth : 'calc(100dvw)',
                    borderRadius: 0,
                    transition: {
                      delay: 0,
                      type: 'spring',
                      stiffness: 200,
                      damping: 30,
                      duration: 5000,
                    },
                  }
                : {
                    opacity: 1,
                    x: 400,
                    y: 0,
                    height: windowHeight,
                    width: windowWidth ? windowWidth - 400 : 'calc(100dvw-400px)',
                    borderRadius: 0,
                    transition: {
                      delay: 0,
                      type: 'spring',
                      stiffness: 200,
                      damping: 30,
                      duration: 5000,
                    },
                  }
            }
            exit={{
              opacity: 0,
              scale: 0.5,
              transition: {
                delay: 0.1,
                type: 'spring',
                stiffness: 600,
                damping: 30,
              },
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className='p-2 flex flex-row justify-between items-start bg-background/95 backdrop-blur-sm border-b border-border sticky top-0 z-10'>
              <div className='flex flex-row gap-4 items-start'>
                <ArtifactCloseButton />

                <div className='flex flex-col'>
                  <div className='font-medium'>{artifact.title}</div>

                  {isContentDirty ? (
                    <div className='text-sm text-muted-foreground'>Saving changes...</div>
                  ) : documentData ? (
                    <div className='text-sm text-muted-foreground'>
                      {`Updated ${formatDistance(new Date(documentData.createdAt), new Date(), {
                        addSuffix: true,
                      })}`}
                    </div>
                  ) : (
                    <div className='w-32 h-3 mt-2 bg-muted-foreground/20 rounded-md animate-pulse' />
                  )}
                </div>
              </div>

              <ArtifactActions
                artifact={artifact}
                currentVersionIndex={currentVersionIndex}
                handleVersionChange={handleVersionChange}
                isCurrentVersion={isCurrentVersion}
                mode={mode}
                metadata={metadata}
                setMetadata={setMetadata}
              />
            </div>

            <div className='dark:bg-muted bg-background h-full overflow-y-scroll !max-w-full items-center'>
              <artifactDefinition.content
                title={artifact.title}
                content={
                  isCurrentVersion ? artifact.content : getDocumentContentById(currentVersionIndex)
                }
                mode={mode}
                status={artifact.status}
                currentVersionIndex={currentVersionIndex}
                suggestions={[]}
                onSaveContent={saveContent}
                isInline={false}
                isCurrentVersion={isCurrentVersion}
                getDocumentContentById={getDocumentContentById}
                isLoading={isDocumentsFetching && !artifact.content}
                metadata={metadata}
                setMetadata={setMetadata}
              />

              <AnimatePresence>
                {isCurrentVersion && (
                  <Toolbar
                    isToolbarVisible={isToolbarVisible}
                    setIsToolbarVisible={setIsToolbarVisible}
                    append={append}
                    status={status}
                    stop={stop}
                    setMessages={setMessages}
                    artifactKind={artifact.kind}
                  />
                )}
              </AnimatePresence>
            </div>

            <AnimatePresence>
              {!isCurrentVersion && (
                <VersionFooter
                  currentVersionIndex={currentVersionIndex}
                  documents={documents}
                  handleVersionChange={handleVersionChange}
                />
              )}
            </AnimatePresence>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export const Artifact = memo(PureArtifact, (prevProps, nextProps) => {
  if (
    !equal(prevProps.messages, nextProps.messages) ||
    !equal(prevProps.attachments, nextProps.attachments) ||
    prevProps.input !== nextProps.input ||
    prevProps.chatId !== nextProps.chatId ||
    prevProps.selectedModelId !== nextProps.selectedModelId ||
    prevProps.isModelSyncing !== nextProps.isModelSyncing
  ) {
    return false
  }

  return true
})

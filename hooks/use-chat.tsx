'use client'

import {
  DEFAULT_CHAT_MODEL,
  ensureVisionModel,
  getModel,
  isVisionModel,
  resolveModelId,
  supportsPdf,
  type ModelId,
} from '@/lib/ai/models'
import {DEV, buildTeeEnclaveUrl, buildTeeApiUrl} from '@/lib/constants'
import {ChatSDKError} from '@/lib/errors'
import type {PiiConfig, SkipPiiRedaction} from '@/lib/pii/types'
import {createRegexFromPiiParameters, generateUuid, streamNdjson} from '@/lib/utils'
import {atom, useAtom} from 'jotai'
import {useAccount} from '@/components/account-provider'
import {useCallback, useEffect, useMemo, useRef, useState, type ReactNode} from 'react'
import {toast} from 'sonner'
import {useLocalStorage, useSessionStorage} from 'usehooks-ts'
import {stripDataUrlPrefix} from '@/lib/utils/files'
import {generateTitleFromMessage} from '@/lib/utils/chat-title'

// This shall be used as a global onFinish hook
export const chatRequestCountAtom = atom(0)
export const chatLoadCountAtom = atom(0)

export interface AskAiOptions {
  /** Enable the web search tool. */
  webSearch?: boolean
  /** Image attachments to send with the prompt. */
  images?: Array<{url: string; detail?: 'low' | 'high' | 'auto'}>
  pdfs?: Array<{base64: string; fileName?: string}>
  urls?: Array<string>
  /** Skip PII redaction (true = skip all; or per-modality object) */
  skipPiiRedaction?: SkipPiiRedaction
  /** Specific PII entity types to redact (e.g., ['CREDIT_CARD', 'PHONE_NUMBER']) */
  piiEntities?: string[]
  /** Advanced PII tuning (images/pdfs/preview/anonymization) */
  piiConfig?: PiiConfig
}

export interface ChatMessage {
  /** A uuid v4 string. */
  id: string
  content: string
  /** Available on assistant responses (unless forcefully stopped). */
  summary?: string
  /** Model used for generating message. Assistant responses only. */
  modelId?: ModelId
  role: 'assistant' | 'user'
  /** millisecond-timestamp */
  createdAt: number
  metadata?: Record<string, any>
}

type ChatBranch = {
  id: string
  /** `undefined` means this is the root branch. */
  parentBranchId?: string
  /**
   * Message id in the parent branch timeline where this branch forks.
   * The forked branch will exclude this message and everything after it from the parent.
   */
  forkFromMessageId?: string
  /** The original user message id this version group belongs to (for “View versions…”). */
  rootVersionOf?: string
  createdAt: number
  messages: Array<ChatMessage>
}

type ChatBranchState = {
  activeBranchId: string
  branches: Record<string, ChatBranch>
}

type ChatDataStream = {
  messageId: string
  content: string
  words: Array<ReactNode>
  piiParameters: {[placeholder: string]: string}
  /** Is `null` if no PII was found in user prompt. */
  piiRegex: RegExp | null
  geminiMetadata?: GeminiMetadata | null
  xaiMetadata?: XaiMetadata | null
}

export type GeminiMetadata = {
  groundingMetadata?: {
    webSearchQueries?: Array<string>
    groundingSupports?: Array<GroundingSupport>
    searchEntryPoint?: {
      renderedContent?: string
    }
    groundingChunks?: Array<GroundingChunk>
  } | null
  usageMetadata?: {
    promptTokenCount: number
    candidatesTokenCount: number
    totalTokenCount: number
  }
  urlContextMetadata?: {
    resolvedUrls?: Array<{url: string; title?: string | null}> | null
    anchors?: Array<{
      url: string
      chunkId?: string
    }>
  } | null
  requestId?: string
}

type GroundingChunk = {
  chunkId: string
  text: string
  web?: {sourceUrl?: string; title?: string}
}

type GroundingSupport = {
  chunkIds: Array<string>
  summaryText?: string
}

export type XaiMetadata = {
  sources?: Array<{
    url: string
    title?: string
    snippet?: string
  }>
  searchQueries?: Array<string>
}

export interface UseChatHelpers {
  askAi: (prompt: string, options?: AskAiOptions) => Promise<void>
  sendPromptRequest: (args: {
    promptPayload: any
    userMessage: {id: string; content: string; createdAt: number; metadata?: Record<string, any>}
    requestId?: string
    branchId?: string
  }) => Promise<void>
  messages: Array<ChatMessage>
  activeBranchId: string
  setActiveBranchId: (branchId: string) => void
  /**
   * Returns all branches (including current) that are versions of this prompt.
   * `messageId` should be a user message id.
   */
  getPromptVersions: (
    messageId: string,
  ) => Array<{branchId: string; label: string; isActive: boolean}>
  /** Creates a new branch from an edited prompt and sends it like a normal request. */
  createBranchFromEdit: (args: {originalMessageId: string; newContent: string}) => Promise<void>
  /**
   * When user submits prompt and `status == 'streaming'`,
   * this object contains data about the message being streamed.
   * Otherwise, and when `status == 'ready'`, this is `null`.
   */
  dataStream: ChatDataStream | null
  removeMessage: (messageId: string) => void
  editMessage: (messageId: string, content: string) => void
  chatModel: ModelId
  selectModel: (modelId: ModelId) => void
  /**
   * Hook status:
   * - `submitted`: The message has been sent to the API and we're awaiting the start of the response stream.
   * - `streaming`: The response is actively streaming in from the API, receiving chunks of data.
   * - `ready`: The full response has been received and processed; a new user message can be submitted.
   * - `error`: An error occurred during the API request, preventing successful completion.
   */
  status: 'submitted' | 'streaming' | 'ready' | 'error' | 'blocked'
  error: ChatSDKError | null
  reload: () => void
  /** Immediately stop streaming current message. */
  stop: () => void
  isLoading: boolean
}

export interface UseChatParams {
  id: string
  userId: string | null
  /** Won't attempt to fetch existing messages. */
  isNewChat?: boolean
  onFinish?: () => void
}

export function useChat({
  id: chatId,
  userId,
  isNewChat = false,
  onFinish = () => {},
}: UseChatParams): UseChatHelpers {
  const {account} = useAccount()
  const chatStorageKey = `cached-chat-${chatId}`
  const chatModelStorageKey = 'selected-model'
  const [storedChatState, setStoredChatState] = useSessionStorage<any>(chatStorageKey, null)
  const [dataStream, setDataStream] = useState<UseChatHelpers['dataStream'] | null>(null)
  const [selectedModel, setSelectedModel] = useLocalStorage(chatModelStorageKey, DEFAULT_CHAT_MODEL)
  const [error, setError] = useState<UseChatHelpers['error']>(null)
  const [isLoading, setIsLoading] = useState<UseChatHelpers['isLoading']>(false)
  const [status, setStatus] = useState<UseChatHelpers['status']>('ready')

  const branchState = useMemo(() => normalizeChatBranchState(storedChatState), [storedChatState])
  const activeBranchId = branchState.activeBranchId
  const messages = useMemo(
    () => renderBranchMessages(activeBranchId, branchState),
    [activeBranchId, branchState],
  )

  // Persist a structured default if the storage is empty/legacy.
  useEffect(() => {
    if (storedChatState == null) {
      setStoredChatState(createInitialChatBranchState())
      return
    }

    // Migrate legacy array payloads (old `messages` format) to branch state.
    if (Array.isArray(storedChatState)) {
      setStoredChatState(createInitialChatBranchState(storedChatState as Array<ChatMessage>))
    }
  }, [storedChatState, setStoredChatState])

  const updateChatBranchState = useCallback(
    (updater: (prev: ChatBranchState) => ChatBranchState) => {
      setStoredChatState((prev: any) => updater(normalizeChatBranchState(prev)))
    },
    [setStoredChatState],
  )

  const setActiveBranchId: UseChatHelpers['setActiveBranchId'] = useCallback(
    (branchId) => {
      updateChatBranchState((s) => {
        if (!s.branches[branchId]) return s
        if (s.activeBranchId === branchId) return s
        return {...s, activeBranchId: branchId}
      })
    },
    [updateChatBranchState],
  )

  const appendMessageToBranch = useCallback(
    (branchId: string, message: ChatMessage) => {
      updateChatBranchState((s) => {
        const existing = s.branches[branchId]
        if (!existing) return s
        return {
          ...s,
          branches: {
            ...s.branches,
            [branchId]: {
              ...existing,
              messages: [...existing.messages, message],
            },
          },
        }
      })
    },
    [updateChatBranchState],
  )

  // Track which branch the currently streaming assistant response belongs to.
  const streamBranchIdRef = useRef<string>(activeBranchId)
  useEffect(() => {
    streamBranchIdRef.current = activeBranchId
  }, [activeBranchId])

  // Upgrade persisted model selections (e.g. deprecated Gemini preview IDs) to the canonical ID.
  useEffect(() => {
    const resolved = resolveModelId(selectedModel)
    if (resolved !== selectedModel) {
      setSelectedModel(resolved)
    }
  }, [selectedModel, setSelectedModel])

  // Misc.
  const [, setChatRequestCount] = useAtom(chatRequestCountAtom)
  const [, setChatLoadCount] = useAtom(chatLoadCountAtom)
  const controller = useRef(new AbortController())
  const ndjsonReaderRef = useRef<ReadableStreamDefaultReader<Uint8Array> | null>(null)
  const cancelNdjsonReader = useCallback(() => {
    const reader = ndjsonReaderRef.current
    if (!reader) return
    ndjsonReaderRef.current = null
    void reader.cancel().catch(() => {})
  }, [])
  const currDataStream = useRef(dataStream)
  currDataStream.current = dataStream

  const selectModel: UseChatHelpers['selectModel'] = useCallback((modelId) => {
    setSelectedModel(resolveModelId(modelId))
  }, [])

  const stop = useCallback(() => {
    try {
      controller.current.abort()
    } catch {}

    controller.current = new AbortController()
    cancelNdjsonReader()

    // If we have partial assistant content, append it as an aborted message
    const dataStream = currDataStream.current
    if (dataStream?.content && dataStream.content.trim().length > 0) {
      appendMessageToBranch(streamBranchIdRef.current, createAbortedMessage(dataStream))
    }

    // Ensure UI resets regardless of server response
    setDataStream(null)
    setStatus('ready')
    setIsLoading(false)
  }, [appendMessageToBranch, cancelNdjsonReader])

  // Reset everything back to defaults on Chat ID change
  const isInitRender = useRef(true)
  useEffect(() => {
    if (isInitRender.current) {
      isInitRender.current = false
      return
    }

    // (skip resetting session storage messages)
    setDataStream(null)
    // (skip local storage hook)
    setError(null)
    setIsLoading(false)
    setStatus('ready')
  }, [chatId])

  // Get existing chat messages from IPFS
  useEffect(() => {
    ;(async () => {
      if (userId == null) return
      if (messages.length) return // Already got from session storage
      if (isNewChat) return

      try {
        setIsLoading(true)
        const chatUrl = buildTeeApiUrl('/chat', {userId, chatId})
        if (!chatUrl) return
        const res = await fetch(chatUrl, {
          headers: {Accept: 'application/json'},
          cache: 'no-store',
        })

        if (!res.ok) {
          toast.error(`Failed to retrieve chat messages.`)
          return
        }

        const data = (await res.json()) as {
          messages: Array<any>
          piiParameters: Record<string, string>
        }

        // Normalize messages: ensure createdAt is present in ms and field names match
        const normalized = data.messages.map((m) => {
          const createdAt: number =
            typeof m.createdAt === 'number'
              ? m.createdAt
              : typeof m.created_at === 'number'
                ? m.created_at
                : Date.now()
          const modelId = m.modelId ?? m.model_id
          const role = m.role
          return {
            id: String(m.id),
            content: String(m.content ?? ''),
            summary: m.summary,
            modelId,
            role,
            createdAt,
          } as ChatMessage
        })

        setStoredChatState(createInitialChatBranchState(normalized))
      } finally {
        setIsLoading(false)
        setChatLoadCount((count) => count + 1)
      }
    })()
  }, [chatId, userId, isNewChat])

  useEffect(() => {
    if (!DEV) return
    if (typeof window === 'undefined') return
    if (messages.length === 0) return

    const counts = new Map<string, number>()
    for (const message of messages) {
      counts.set(message.id, (counts.get(message.id) ?? 0) + 1)
    }

    const duplicates = Array.from(counts.entries())
      .filter(([, count]) => count > 1)
      .map(([id, occurrences]) => ({id, occurrences}))

    if (duplicates.length > 0) {
      console.warn('[use-chat] duplicate message ids detected', {
        chatId,
        duplicates,
        snapshot: messages,
      })
    }
  }, [chatId, messages])

  const sendPromptRequest: UseChatHelpers['sendPromptRequest'] = useCallback(
    async ({promptPayload, userMessage, requestId, branchId}) => {
      const throttle = 0 // 🚂 (keep parity with askAi)
      const targetBranchId = branchId ?? activeBranchId

      try {
        try {
          controller.current.abort()
        } catch {}
        controller.current = new AbortController()

        const promptUrl = buildTeeEnclaveUrl('/prompt')
        if (!promptUrl) {
          throw new Error('TEE enclave endpoint not configured.')
        }
        if (DEV && typeof window !== 'undefined') {
          // eslint-disable-next-line no-console
          console.log('[useChat] prompt endpoint', promptUrl)
        }

        cancelNdjsonReader()
        const ndjsonStream = streamNdjson(
          promptUrl,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(requestId ? {'X-Request-Id': requestId} : {}),
              ...(account?.address ? {'x-wallet-address': account.address} : {}),
            },
            body: JSON.stringify(promptPayload),
            signal: controller.current.signal,
          },
          {
            onReader: (reader) => {
              ndjsonReaderRef.current = reader
            },
          },
        )

        // Record which branch this stream belongs to (used by stop()/forcestop).
        streamBranchIdRef.current = targetBranchId

        appendMessageToBranch(targetBranchId, {
          id: userMessage.id,
          content: userMessage.content,
          role: 'user',
          createdAt: userMessage.createdAt,
          metadata: userMessage.metadata,
        })

        // Optimistic UI: show thinking state immediately
        setIsLoading(true)
        setStatus('submitted')

        let receivedFirstChunk = false
        let watchdogTimeout: ReturnType<typeof setTimeout> | null = null

        const clearWatchdog = () => {
          if (watchdogTimeout) {
            clearTimeout(watchdogTimeout)
            watchdogTimeout = null
          }
        }

        const startWatchdog = () => {
          clearWatchdog()
          watchdogTimeout = setTimeout(() => {
            toast.info('Still working… model is taking longer than usual.')
          }, 17000)
        }

        startWatchdog()

        for await (const obj of ndjsonStream) {
          receivedFirstChunk = true
          clearWatchdog()
          if (throttle) await new Promise((_) => setTimeout(_, throttle))

          if ('limitReached' in obj || 'limit_reached' in obj) {
            const blocked = Boolean((obj as any).limitReached ?? (obj as any).limit_reached)
            if (blocked) {
              const ms: number | undefined =
                typeof (obj as any).timeUntilReset === 'number'
                  ? (obj as any).timeUntilReset
                  : typeof (obj as any).daysUntilReset === 'number'
                    ? Math.ceil((obj as any).daysUntilReset * 24 * 60 * 60 * 1000)
                    : undefined

              const minutes = ms != null ? Math.ceil(ms / 60000) : null
              toast.info(
                `Limit reached. Please upgrade your plan${minutes != null ? ` or try again in ~${minutes} min` : ''}.`,
              )

              // Block further sends until reset window passes or user upgrades
              setStatus('blocked')

              // Optionally auto-unblock after the server-provided reset window
              if (ms != null && ms > 0) {
                setTimeout(() => {
                  setStatus('ready')
                }, ms)
              }
            }
          }

          if ('status' in obj && obj.status === 'stillWorking') {
            toast.info('Still working… we will keep waiting a bit longer.')
          }

          // First stage: Setting up details
          if ('piiParameters' in obj) {
            setDataStream({
              messageId: obj.assistantMessageId,
              content: '',
              words: [],
              piiParameters: obj.piiParameters,
              piiRegex: createRegexFromPiiParameters(obj.piiParameters),
              geminiMetadata: null,
              xaiMetadata: null,
            })

            setStatus('submitted')
          }

          // Second stage: Streaming words
          if ('w' in obj) {
            let newWords = obj.w as string[]
            setDataStream((dataStream) => {
              if (dataStream == null) {
                return dataStream
              }

              // Replace PII placeholders with how <ReactMarkdown /> expects to receive them:
              // in the format of "<PERSON_1=John>"
              newWords = newWords.map((word) => {
                if (dataStream.piiRegex == null) return word
                return word.replace(dataStream.piiRegex, (placeholderMatch) => {
                  return `${placeholderMatch.slice(0, -1)}=${dataStream.piiParameters[placeholderMatch]}>`
                })
              })

              // Robust join to avoid mid-stream markdown glitches (e.g. code fences, punctuation).
              // The final `assistantMessage.content` on `complete` is still the source of truth.
              const joinNdjsonWordTokens = (prev: string, tokens: string[]) => {
                let out = prev ?? ''
                for (const token of tokens) {
                  const t = String(token ?? '')
                  if (!t) continue
                  if (!out) {
                    out = t
                    continue
                  }

                  const prevEndsWithWhitespace = /\s$/.test(out)
                  const tokenStartsWithNewline = /^\n/.test(t)
                  const tokenIsPunctuation = /^[,.;:!?)}\]]/.test(t)
                  const tokenIsQuote = /^['"’”]/.test(t)

                  // Markdown-specific: avoid ` ``` ts `; prefer ```ts
                  const prevEndsWithCodeFence = out.endsWith('```')
                  const tokenLooksLikeFenceLang = /^[a-z0-9_-]+$/i.test(t)

                  if (tokenStartsWithNewline) {
                    out += t
                  } else if (prevEndsWithWhitespace) {
                    out += t
                  } else if (tokenIsPunctuation || tokenIsQuote) {
                    out += t
                  } else if (prevEndsWithCodeFence && tokenLooksLikeFenceLang) {
                    out += t
                  } else {
                    out += ` ${t}`
                  }
                }
                return out
              }

              const content = joinNdjsonWordTokens(dataStream.content, newWords)

              return {
                ...dataStream,
                content,
              }
            })

            setStatus('streaming')
          }

          if ('limitReached' in obj && obj.limitReached === true) {
            toast.warning(
              'Request aborted because the budget limit was reached mid-stream. Please retry later.',
            )
            clearWatchdog()
            cancelNdjsonReader()
            setIsLoading(false)
            break
          }

          // Third stage: Streaming is complete
          if ('complete' in obj) {
            cancelNdjsonReader()
            setIsLoading(false)
            const completionTimestamp = Date.now()
            if (DEV) {
              console.log('[USE_CHAT] [TIMING] Stream complete event received', {
                timestamp: completionTimestamp,
                chatId,
              })
            }

            // OPTIMIZATION: Set status to 'ready' FIRST to immediately re-enable input
            // This prevents React batching from delaying the input re-enable
            setStatus('ready')
            if (DEV) {
              console.log('[USE_CHAT] [TIMING] Status set to ready', {
                timestamp: Date.now(),
                elapsed: Date.now() - completionTimestamp,
              })
            }

            const newAssistantMessage = obj.assistantMessage
            const geminiMetadata =
              'geminiMetadata' in obj
                ? normalizeGeminiMetadata(obj.geminiMetadata)
                : (currDataStream.current?.geminiMetadata ?? null)

            const xaiMetadata =
              'xaiMetadata' in obj
                ? normalizeXaiMetadata(obj.xaiMetadata)
                : (currDataStream.current?.xaiMetadata ?? null)

            const metadata = {
              ...(newAssistantMessage.metadata ?? {}),
              ...(geminiMetadata ? {gemini: geminiMetadata} : {}),
              ...(xaiMetadata ? {xai: xaiMetadata} : {}),
            }

            appendMessageToBranch(
              targetBranchId,
              Object.keys(metadata).length > 0
                ? {
                    ...newAssistantMessage,
                    metadata,
                  }
                : newAssistantMessage,
            )
            setDataStream(null)

            setChatRequestCount((count) => {
              const newCount = count + 1
              if (DEV) {
                console.log(
                  '[USE_CHAT] Chat request completed (streaming done), incrementing count',
                  {
                    previousCount: count,
                    newCount,
                    chatId,
                  },
                )
              }
              return newCount
            })
            onFinish()

            if (DEV) {
              console.log('[USE_CHAT] [TIMING] All completion state updates queued', {
                timestamp: Date.now(),
                elapsed: Date.now() - completionTimestamp,
              })
            }
            break
          }

          // Third stage alternative: Streaming is complete due to client-side interruption
          if ('forcestop' in obj) {
            cancelNdjsonReader()
            setIsLoading(false)
            const dataStream = currDataStream.current
            if (dataStream?.content)
              appendMessageToBranch(targetBranchId, createAbortedMessage(dataStream))
            setDataStream(null)

            setChatRequestCount((count) => {
              const newCount = count + 1
              if (DEV) {
                console.log('[USE_CHAT] Chat request force stopped, incrementing count', {
                  previousCount: count,
                  newCount,
                  chatId,
                })
              }
              return newCount
            })
            onFinish()

            setStatus('ready')
            break
          }

          // Graceful error sent back from server
          if ('error' in obj) {
            setError(new ChatSDKError('offline:api'))
            setDataStream(null)

            cancelNdjsonReader()
            setIsLoading(false)

            setStatus('error')
            break
          }

          setIsLoading(false)
        }

        if (!receivedFirstChunk) {
          toast.error('No response received. Please try again.')
          setStatus('error')
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') {
          // Silent abort; UI was already reset in stop()
          return
        }
        // Provide user-friendly error message for network errors
        if (err instanceof TypeError && err.message.includes('fetch')) {
          toast.error('Unable to connect to the chat server. Please check your connection.')
        } else if (err instanceof Error) {
          toast.error(`Chat error: ${err.message}`)
        }

        setError(new ChatSDKError('offline:api'))
        setStatus('error')
      } finally {
        cancelNdjsonReader()
      }
    },
    [
      account?.address,
      activeBranchId,
      appendMessageToBranch,
      cancelNdjsonReader,
      chatId,
      onFinish,
      setChatRequestCount,
    ],
  )

  const askAi: UseChatHelpers['askAi'] = useCallback(
    async (prompt, options) => {
      if (userId == null) {
        return
      }
      const trimmedPrompt = prompt.trim()
      if (trimmedPrompt === '') return

      try {
        const userMessageId = generateUuid()
        const userMessageCreatedAt = Date.now()

        const hasImages = Boolean(options?.images && options.images.length > 0)
        const hasPdfs = Boolean(options?.pdfs && options.pdfs.length > 0)

        const currentModel = getModel(selectedModel)
        let effectiveModelId = selectedModel

        // Auto-switch model for PDFs if current model doesn't support them
        if (hasPdfs && !supportsPdf(effectiveModelId)) {
          const compatibleModel: ModelId = 'claude-sonnet-4-6'
          if (DEV) {
            console.info('[use-chat] auto switching for PDF support', {
              previousModel: effectiveModelId,
              newModel: compatibleModel,
            })
          }
          toast.info(
            `${currentModel.name} doesn't support PDFs. Switching to ${getModel(compatibleModel).name}.`,
          )
          effectiveModelId = compatibleModel
          if (effectiveModelId !== selectedModel) {
            setSelectedModel(effectiveModelId)
          }
        }

        // Auto-switch model for images if current model doesn't support vision
        if (hasImages && !isVisionModel(effectiveModelId)) {
          const visionModel = ensureVisionModel(effectiveModelId)
          if (visionModel !== effectiveModelId) {
            effectiveModelId = visionModel
            if (effectiveModelId !== selectedModel) {
              setSelectedModel(effectiveModelId)
            }
            toast.info(`Switched to ${getModel(effectiveModelId).name} for image support.`)
          }
        }

        const resolvedModelId = resolveModelId(effectiveModelId)
        if (resolvedModelId !== effectiveModelId) {
          effectiveModelId = resolvedModelId
          if (effectiveModelId !== selectedModel) {
            setSelectedModel(effectiveModelId)
          }
        }

        const model = getModel(effectiveModelId)
        if (DEV) {
          console.info('[use-chat] preparing prompt payload')
        }

        const buildImages = () =>
          options?.images && options.images.length > 0
            ? options.images.map((image) => ({
                url: image.url,
                detail: image.detail ?? 'auto',
              }))
            : undefined

        const buildPdfs = () => {
          if (!options?.pdfs || options.pdfs.length === 0) return undefined

          const sanitized = [] as Array<{base64: string; fileName?: string}>
          const skipped: Array<string | undefined> = []

          for (const pdf of options.pdfs) {
            const base64FromMetadata =
              typeof (pdf as any)?.metadata === 'object' && (pdf as any)?.metadata
                ? (pdf as any).metadata.base64
                : undefined

            const base64 =
              typeof base64FromMetadata === 'string' && base64FromMetadata.trim().length > 0
                ? base64FromMetadata.trim()
                : stripDataUrlPrefix(pdf.base64)

            if (!base64 || base64.length === 0) {
              skipped.push(pdf.fileName)
              continue
            }

            sanitized.push({
              base64,
              fileName: pdf.fileName,
            })
          }

          if (!sanitized.length) {
            toast.error('Unable to process attached PDFs.')
            if (DEV && skipped.length > 0) console.warn('[use-chat] skipped invalid PDF data')
            return undefined
          }

          return sanitized
        }

        const sanitizedPdfs = buildPdfs()

        // Generate a title from the first message for new chats
        const chatTitle =
          messages.length === 0 ? generateTitleFromMessage(trimmedPrompt) : undefined

        const skipPiiRedaction = options?.skipPiiRedaction
        const noPiiRedaction =
          typeof skipPiiRedaction === 'boolean' ? skipPiiRedaction : Boolean(skipPiiRedaction?.text)

        const promptPayload = {
          context: makeContext(messages),
          message: {
            id: userMessageId,
            content: trimmedPrompt,
            role: 'user',
            createdAt: userMessageCreatedAt,
          },
          modelId: effectiveModelId,
          provider: model.provider,
          userId,
          chatId,
          // Always include explicit flags as per integration guide
          noSave: false,
          privacyMode: 'legacy_plaintext',
          noPiiRedaction,
          ...(skipPiiRedaction !== undefined ? {skipPiiRedaction} : {}),
          // Optional: specific PII entities to redact
          ...(options?.piiEntities ? {piiEntities: options.piiEntities} : {}),
          ...(options?.piiConfig ? {piiConfig: options.piiConfig} : {}),
          tools: options?.webSearch ? [{type: 'web_search' as const}] : undefined,
          images: buildImages(),
          pdfs: sanitizedPdfs,
          urls: options?.urls && options.urls.length > 0 ? options.urls : undefined,
          // Include title for new chats (first message)
          ...(chatTitle ? {title: chatTitle} : {}),
        }

        await sendPromptRequest({
          promptPayload,
          userMessage: {
            id: userMessageId,
            content: trimmedPrompt,
            createdAt: userMessageCreatedAt,
          },
        })
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') {
          // Silent abort; UI was already reset in stop()
          return
        }

        // Provide user-friendly error message for network errors
        if (err instanceof TypeError && err.message.includes('fetch')) {
          toast.error('Unable to connect to the chat server. Please check your connection.')
        } else if (err instanceof Error) {
          toast.error(`Chat error: ${err.message}`)
        }

        setError(new ChatSDKError('offline:api'))
        setStatus('error')
      } finally {
        cancelNdjsonReader()
      }
    },
    [cancelNdjsonReader, messages, selectedModel, sendPromptRequest, setSelectedModel, userId],
  )

  const removeMessage: UseChatHelpers['removeMessage'] = useCallback((messageId) => {
    // Removing a message should also remove the very next message (assistant's message) (via backend)
  }, [])

  const editMessage: UseChatHelpers['editMessage'] = useCallback((messageId, content) => {
    // Must also delete trailing messages (via backend)
  }, [])

  const getPromptVersions: UseChatHelpers['getPromptVersions'] = useCallback(
    (messageId) => {
      const rendered = renderBranchMessages(activeBranchId, branchState)
      const msg = rendered.find((m) => m.id === messageId)
      const versionGroupId =
        msg &&
        msg.role === 'user' &&
        msg.metadata &&
        typeof (msg.metadata as any).versionOf === 'string'
          ? String((msg.metadata as any).versionOf)
          : messageId

      const originalBranchId =
        Object.values(branchState.branches).find((b) =>
          b.messages.some((m) => m.id === versionGroupId),
        )?.id ?? ROOT_BRANCH_ID

      const edited = Object.values(branchState.branches)
        .filter((b) => b.rootVersionOf === versionGroupId)
        .sort((a, b) => a.createdAt - b.createdAt)

      const out: Array<{branchId: string; label: string; isActive: boolean}> = []
      out.push({
        branchId: originalBranchId,
        label: 'Original (V1)',
        isActive: activeBranchId === originalBranchId,
      })
      edited.forEach((b, i) => {
        out.push({
          branchId: b.id,
          label: `Edited (V${i + 2})`,
          isActive: activeBranchId === b.id,
        })
      })
      return out
    },
    [activeBranchId, branchState],
  )

  const createBranchFromEdit: UseChatHelpers['createBranchFromEdit'] = useCallback(
    async ({originalMessageId, newContent}) => {
      if (userId == null) return
      const trimmed = newContent.trim()
      if (trimmed === '') return

      const parentBranchId = activeBranchId
      const parentRendered = renderBranchMessages(parentBranchId, branchState)
      const forkIndex = parentRendered.findIndex((m) => m.id === originalMessageId)
      if (forkIndex < 0) {
        toast.error('Could not find the original prompt to branch from.')
        return
      }

      const prefixMessages = parentRendered.slice(0, forkIndex)
      const newBranchId = generateUuid()

      updateChatBranchState((s) => ({
        ...s,
        activeBranchId: newBranchId,
        branches: {
          ...s.branches,
          [newBranchId]: {
            id: newBranchId,
            parentBranchId,
            forkFromMessageId: originalMessageId,
            rootVersionOf: originalMessageId,
            createdAt: Date.now(),
            messages: [],
          },
        },
      }))

      const userMessageId = generateUuid()
      const userMessageCreatedAt = Date.now()
      const resolvedModelId = resolveModelId(selectedModel)
      const model = getModel(resolvedModelId)

      const promptPayload = {
        context: makeContext(prefixMessages),
        message: {
          id: userMessageId,
          content: trimmed,
          role: 'user',
          createdAt: userMessageCreatedAt,
        },
        modelId: resolvedModelId,
        provider: model.provider,
        userId,
        chatId,
        noSave: false,
        privacyMode: 'legacy_plaintext',
        noPiiRedaction: false,
      }

      await sendPromptRequest({
        promptPayload,
        userMessage: {
          id: userMessageId,
          content: trimmed,
          createdAt: userMessageCreatedAt,
          metadata: {versionOf: originalMessageId},
        },
        branchId: newBranchId,
      })
    },
    [
      activeBranchId,
      branchState,
      chatId,
      selectedModel,
      sendPromptRequest,
      updateChatBranchState,
      userId,
    ],
  )

  return {
    askAi,
    sendPromptRequest,
    messages: isInitRender.current ? [] : messages, // Withhold on init render, otherwise face hydration errors
    activeBranchId,
    setActiveBranchId,
    getPromptVersions,
    createBranchFromEdit,
    dataStream,
    removeMessage,
    editMessage,
    chatModel: selectedModel,
    selectModel,
    status,
    error,
    reload: () => {},
    stop,
    isLoading,
  }
}

function createAbortedMessage(dataStream: ChatDataStream): ChatMessage {
  const metadata: Record<string, any> = {}

  if (dataStream.geminiMetadata != null) {
    metadata.gemini = dataStream.geminiMetadata
  }

  if (dataStream.xaiMetadata != null) {
    metadata.xai = dataStream.xaiMetadata
  }

  return {
    id: dataStream.messageId,
    content: dataStream.content,
    role: 'assistant',
    createdAt: Date.now(),
    metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
  }
}

function normalizeGeminiMetadata(raw: any): GeminiMetadata | null {
  if (raw == null || typeof raw !== 'object') return null
  return {
    groundingMetadata: raw.groundingMetadata ?? null,
    usageMetadata: raw.usageMetadata ?? undefined,
    urlContextMetadata: raw.urlContextMetadata ?? null,
    requestId: typeof raw.requestId === 'string' ? raw.requestId : undefined,
  }
}

function normalizeXaiMetadata(raw: any): XaiMetadata | null {
  if (raw == null || typeof raw !== 'object') return null
  return {
    sources: Array.isArray(raw.sources) ? raw.sources : undefined,
    searchQueries: Array.isArray(raw.searchQueries) ? raw.searchQueries : undefined,
  }
}

function makeContext(messages: Array<ChatMessage>): string {
  // Basically, concatenate all the summaries together from past responses
  const summaries = [] as string[]
  for (const {role, summary} of messages) {
    if (role !== 'assistant' || !summary) continue
    summaries.push(removeDataUris(summary))
  }
  return summaries.join(' ')
}

const ROOT_BRANCH_ID = 'main'

function createInitialChatBranchState(messages: Array<ChatMessage> = []): ChatBranchState {
  return {
    activeBranchId: ROOT_BRANCH_ID,
    branches: {
      [ROOT_BRANCH_ID]: {
        id: ROOT_BRANCH_ID,
        createdAt: Date.now(),
        messages,
      },
    },
  }
}

function normalizeChatBranchState(raw: any): ChatBranchState {
  if (raw == null) return createInitialChatBranchState()
  if (Array.isArray(raw)) return createInitialChatBranchState(raw as Array<ChatMessage>)

  if (
    typeof raw === 'object' &&
    raw &&
    typeof raw.activeBranchId === 'string' &&
    raw.branches &&
    typeof raw.branches === 'object'
  ) {
    const branches = raw.branches as Record<string, any>
    const normalizedBranches: Record<string, ChatBranch> = {}

    for (const [id, b] of Object.entries(branches)) {
      if (!b || typeof b !== 'object') continue
      const msgs = Array.isArray((b as any).messages)
        ? ((b as any).messages as Array<ChatMessage>)
        : []
      normalizedBranches[id] = {
        id,
        parentBranchId:
          typeof (b as any).parentBranchId === 'string' ? (b as any).parentBranchId : undefined,
        forkFromMessageId:
          typeof (b as any).forkFromMessageId === 'string'
            ? (b as any).forkFromMessageId
            : undefined,
        rootVersionOf:
          typeof (b as any).rootVersionOf === 'string' ? (b as any).rootVersionOf : undefined,
        createdAt: typeof (b as any).createdAt === 'number' ? (b as any).createdAt : Date.now(),
        messages: msgs,
      }
    }

    if (!normalizedBranches[ROOT_BRANCH_ID]) {
      normalizedBranches[ROOT_BRANCH_ID] = {
        id: ROOT_BRANCH_ID,
        createdAt: Date.now(),
        messages: [],
      }
    }

    const activeBranchId = normalizedBranches[raw.activeBranchId]
      ? raw.activeBranchId
      : ROOT_BRANCH_ID
    return {activeBranchId, branches: normalizedBranches}
  }

  return createInitialChatBranchState()
}

function renderBranchMessages(branchId: string, state: ChatBranchState): Array<ChatMessage> {
  const seen = new Set<string>()

  const inner = (id: string): Array<ChatMessage> => {
    if (seen.has(id)) return []
    seen.add(id)
    const branch = state.branches[id]
    if (!branch) return []
    if (!branch.parentBranchId) return branch.messages

    const parent = inner(branch.parentBranchId)
    if (!branch.forkFromMessageId) return [...parent, ...branch.messages]
    const idx = parent.findIndex((m) => m.id === branch.forkFromMessageId)
    const prefix = idx >= 0 ? parent.slice(0, idx) : parent
    return [...prefix, ...branch.messages]
  }

  return inner(branchId)
}

function removeDataUris(content: string): string {
  return content.replace(/data:[^;]+;base64,[a-z0-9+/=]+/gi, '[image removed]')
}

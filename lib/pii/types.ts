export type ModelId = string

export type SkipPiiRedaction =
  | boolean
  | {
      text?: boolean
      pdf?: boolean
      image?: boolean
    }

export type ToolSpec = {type: string} | string
export type PromptPrivacyMode = 'legacy_plaintext' | 'confidential_compute' | 'e2ee_private_archive'

export type InputTextPart = {type: 'input_text'; text: string}
export type InputImagePart = {
  type: 'input_image'
  /**
   * Backend shape compatibility:
   * - OpenAI-style: `image_url`
   * - Some backends/serializers: `imageUrl`
   */
  image_url?: ImageUrlPayload
  imageUrl?: ImageUrlPayload
  detail?: 'low' | 'high' | 'auto'
}

export type ImageUrlPayload =
  | string
  | {omitted: true; length?: number}
  // Newer backends may wrap the URL.
  | {url: string}
  // Tolerate common aliases (forward/backward compatibility).
  | {uri: string}
  | {href: string}
export type InputPdfPart = {
  type: 'input_pdf'
  base64: string | {omitted: true; length?: number}
  file_name?: string
}

export type ContentForModel = string | Array<InputTextPart | InputImagePart | InputPdfPart>

export type PromptMessage = {
  id: string
  content: string
  role: 'user' | 'assistant'
  createdAt: number
}

export type PiiConfig = {
  analysis?: {
    language?: string
    scoreThreshold?: number
    includeDecisionProcess?: boolean
    correlationId?: string
    allowList?: string[]
    denyList?: string[]
    maxFindings?: number
    sortOrder?: 'score_desc' | 'start_asc'
    dedupeStrategy?: 'highest_score' | 'longest_span' | 'keep_all'
  }

  recognizers?: {
    useBuiltInRecognizers?: boolean
    useProjectCustomRecognizers?: boolean
    disableRecognizerNames?: string[]
    onlyRecognizerNames?: string[]
    adHocPatternRecognizers?: Array<{
      name: string
      supportedEntity: string
      supportedLanguage?: string
      patterns: Array<{name: string; regex: string; score: number}>
      context?: string[]
      denyList?: string[]
    }>
  }

  anonymization?: {
    defaultOperator?: {operator: string; params?: Record<string, unknown>}
    operatorsByEntity?: Record<string, {operator: string; params?: Record<string, unknown>}>
  }

  placeholders?: {
    format?: 'angle' | 'bracket'
    includeOriginalTextInPreview?: boolean
    persistAcrossChat?: boolean
  }

  jsonMode?: {
    enabled?: boolean
    scoreThreshold?: number
    defaultOperator?: {operator: string; params?: Record<string, unknown>}
    operatorsByEntity?: Record<string, {operator: string; params?: Record<string, unknown>}>
  }

  text?: {
    engine?: 'presidio' | 'model'
    scoreThreshold?: number
  }

  image?: {
    enabled?: boolean
    entities?: string[]
    scoreThreshold?: number
    fillColor?: 'black' | 'white' | [number, number, number]
    paddingPx?: number
    ocr?: {engine?: 'tesseract'; language?: string; config?: string}
    faces?: {
      blur?: boolean
      method?: 'auto' | 'opencv' | 'face_recognition'
      /**
       * Newer backends support additional knobs. Keep older fields (like
       * `confidenceThreshold`) for backward compatibility.
       */
      detectionStrength?: number
      blurStrength?: number
      facePaddingPx?: number
      minFaceSizePx?: number
      // face_recognition
      model?: 'hog' | 'cnn'
      upsample?: number
      // OpenCV Haar cascade
      scaleFactor?: number
      minNeighbors?: number
      /**
       * Legacy “aggressiveness” knob for face detection.
       * Some backends still use this name.
       */
      confidenceThreshold?: number
    }
  }

  pdf?: {
    enabled?: boolean
    entities?: string[]
    scoreThreshold?: number
    maxPages?: number
    fillColor?: [number, number, number]
    useCustomRecognizers?: boolean
    scrub?: {
      metadata?: boolean
      embeddedFiles?: boolean
      javascript?: boolean
      annotations?: boolean
      formFields?: boolean
      outlines?: boolean
    }
    rasterFallback?: {enabled?: boolean; dpi?: number; maxPages?: number}
  }

  preview?: {
    includeMatches?: boolean
    includeRedactedMedia?: boolean
    returnIntermediateArtifacts?: boolean
    maxPayloadBytes?: number
  }

  overrides?: {
    keepPlaceholders?: string[]
    forceRedactSpans?: Array<{
      start: number
      end: number
      operator?: {operator: string; params?: any}
    }>
    forceRedactStrings?: string[]
    forceKeepStrings?: string[]
  }
}

export type PromptRequestBase = {
  userId: string
  chatId: string
  modelId: ModelId
  message: PromptMessage

  context?: string
  tools?: ToolSpec[]
  urls?: string[]
  images?: Array<{url: string; detail?: 'low' | 'high' | 'auto'}>
  pdfs?: Array<{base64: string; fileName?: string}>
  attachmentIds?: string[]

  skipPiiRedaction?: SkipPiiRedaction
  piiEntities?: string[]
  piiConfig?: PiiConfig

  noSave?: boolean
  noPiiRedaction?: boolean
  privacyMode?: PromptPrivacyMode
}

export type PiiPreviewResponse = {
  draftId: string
  expiresAt: number
  draftDigest: string
  preview: {
    provider: string | null
    modelId: string
    cleanPrompt: string
    contentForModel: ContentForModel
    normalizedTools: Array<{type: string}> | null
  }
  piiParameters: Record<string, string>
}

export type PiiApproveRequest = {
  draftId: string
  clientDigest?: string
}

export type PiiApproveResponse = {
  draftId: string
  expiresAt: number
  approvalToken: string
}

export type PromptRequest = PromptRequestBase & {
  piiDraftId?: string
  piiApprovalToken?: string
}

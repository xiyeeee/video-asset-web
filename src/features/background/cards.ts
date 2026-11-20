const detectionStatuses = ['DETECTED', 'NOT_DETECTED', 'UNKNOWN'] as const

export type DetectionStatus = (typeof detectionStatuses)[number]

export type BackgroundReview = 'CLEAN_CANDIDATE' | 'NEEDS_REVIEW'

export type BackgroundCard = {
  assetId: string
  sourceTaskId: string
  shotId: string | null
  shotIndex: number
  startMs: number
  endMs: number
  timestampMs: number
  personStatus: DetectionStatus
  subtitleStatus: DetectionStatus
  reviewStatus: BackgroundReview
  imageUrl: string
  expiresInSeconds: number
}

export type BackgroundCandidate = {
  assetId: string
  assetType: string
  sourceTaskId: string | null
  expiresInSeconds: number
  details: {
    shotId?: string | null
    shotIndex?: number | null
    startMs?: number | null
    endMs?: number | null
    timestampMs?: number | null
    method?: string | null
    personStatus?: string | null
    subtitleStatus?: string | null
    reviewStatus?: string | null
    imageUrl?: string | null
  }
}

export type BackgroundSeek = {
  id: number
  seconds: number
  episodeId: string
}

export type BackgroundSession = {
  episodeId: string
  selectedId: string | null
  seek: BackgroundSeek | null
}

const integer = (value: number | null | undefined): value is number =>
  typeof value === 'number' && Number.isInteger(value)

const detection = (value: string | null | undefined): DetectionStatus | null =>
  detectionStatuses.find((item) => item === value) ?? null

export const reviewLabel = (status: BackgroundReview) => (status === 'CLEAN_CANDIDATE' ? '可用候选' : '待复核')

export const personLabel = (status: DetectionStatus) => {
  if (status === 'DETECTED') return '有人物'
  if (status === 'NOT_DETECTED') return '未检出人物'
  return '人物未知'
}

export const subtitleLabel = (status: DetectionStatus) => {
  if (status === 'DETECTED') return '有字幕'
  if (status === 'NOT_DETECTED') return '未检出字幕'
  return '字幕未知'
}

/**
 * 只保留原帧候选。人物和字幕没有都确认未检出时，不显示为可用候选。
 * 来源时间必须落在镜头半开区间内。
 */
export const classifyBackgrounds = (items: BackgroundCandidate[]) => {
  const cards = items.flatMap((item) => {
    const card = formalCard(item)
    return card ? [card] : []
  })
  cards.sort((left, right) => left.shotIndex - right.shotIndex || left.timestampMs - right.timestampMs)
  return cards
}

const formalCard = (item: BackgroundCandidate): BackgroundCard | null => {
  const details = item.details
  const personStatus = detection(details.personStatus)
  const subtitleStatus = detection(details.subtitleStatus)
  if (item.assetType !== 'BACKGROUND' || !item.sourceTaskId || !details.imageUrl) return null
  if (!integer(item.expiresInSeconds) || item.expiresInSeconds <= 0) return null
  if (details.method !== 'SOURCE_FRAME' || !personStatus || !subtitleStatus) return null
  if (details.reviewStatus !== 'CLEAN_CANDIDATE' && details.reviewStatus !== 'NEEDS_REVIEW') return null
  if (!integer(details.shotIndex) || details.shotIndex < 1) return null
  if (!integer(details.startMs) || details.startMs < 0) return null
  if (!integer(details.endMs) || details.endMs <= details.startMs) return null
  if (!integer(details.timestampMs) || details.timestampMs < details.startMs || details.timestampMs >= details.endMs) return null
  const clean = details.reviewStatus === 'CLEAN_CANDIDATE' && personStatus === 'NOT_DETECTED' && subtitleStatus === 'NOT_DETECTED'
  return {
    assetId: item.assetId,
    sourceTaskId: item.sourceTaskId,
    shotId: details.shotId || null,
    shotIndex: details.shotIndex,
    startMs: details.startMs,
    endMs: details.endMs,
    timestampMs: details.timestampMs,
    personStatus,
    subtitleStatus,
    reviewStatus: clean ? 'CLEAN_CANDIDATE' : 'NEEDS_REVIEW',
    imageUrl: details.imageUrl,
    expiresInSeconds: item.expiresInSeconds,
  }
}

export const sameBackgroundVersion = (cards: BackgroundCard[], sourceTaskId: string | undefined) =>
  sourceTaskId ? cards.filter((card) => card.sourceTaskId === sourceTaskId) : cards

/** 签名图在过期前 15 秒重新获取，不把地址写入本地存储。 */
export const signedImageStaleMs = (expiresInSeconds: number | null) => {
  if (!expiresInSeconds || expiresInSeconds <= 0) return 0
  return Math.max(0, expiresInSeconds * 1000 - 15_000)
}

export const openBackgroundEpisode = (episodeId: string): BackgroundSession => ({
  episodeId,
  selectedId: null,
  seek: null,
})

export const switchBackgroundEpisode = (session: BackgroundSession, episodeId: string) =>
  session.episodeId === episodeId ? session : openBackgroundEpisode(episodeId)

/** 点击来源时间跳到候选帧。播放器还不能定位时保留请求，不假装已经跳转。 */
export const nextBackgroundSeek = (previous: BackgroundSeek | null, episodeId: string, card: BackgroundCard): BackgroundSeek => ({
  id: (previous?.episodeId === episodeId ? previous.id : 0) + 1,
  seconds: card.timestampMs / 1000,
  episodeId,
})

export const appliedBackgroundSeek = (seek: BackgroundSeek | null, episodeId: string, positionable: boolean) => {
  if (!seek || seek.episodeId !== episodeId || !positionable) return null
  return seek.seconds
}

export const contractBackgroundItems = (): BackgroundCandidate[] => [
  {
    assetId: '819',
    assetType: 'BACKGROUND',
    sourceTaskId: '925',
    expiresInSeconds: 600,
    details: {
      shotId: '814',
      shotIndex: 1,
      startMs: 0,
      endMs: 8000,
      timestampMs: 4000,
      method: 'SOURCE_FRAME',
      personStatus: 'NOT_DETECTED',
      subtitleStatus: 'NOT_DETECTED',
      reviewStatus: 'CLEAN_CANDIDATE',
      imageUrl: 'https://media.example/background-1.jpg',
    },
  },
  {
    assetId: '820',
    assetType: 'BACKGROUND',
    sourceTaskId: '925',
    expiresInSeconds: 600,
    details: {
      shotId: '815',
      shotIndex: 2,
      startMs: 8000,
      endMs: 20000,
      timestampMs: 14000,
      method: 'SOURCE_FRAME',
      personStatus: 'DETECTED',
      subtitleStatus: 'UNKNOWN',
      reviewStatus: 'NEEDS_REVIEW',
      imageUrl: 'https://media.example/background-2.jpg',
    },
  },
]

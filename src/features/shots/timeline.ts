export type FormalShot = {
  assetId: string
  sourceTaskId: string
  shotId: string
  shotIndex: number
  startMs: number
  endMs: number
  previewTimestampMs: number
  frameUrl: string
  sizeBytes: number
  expiresInSeconds: number
}

export type ShotCandidate = {
  assetId: string
  assetType: string
  sourceTaskId: string | null
  sizeBytes: number
  expiresInSeconds: number
  details: {
    shotId?: string | null
    shotIndex?: number | null
    startMs?: number | null
    endMs?: number | null
    previewTimestampMs?: number | null
    frameUrl?: string | null
  }
}

const integer = (value: number | null | undefined): value is number =>
  typeof value === 'number' && Number.isInteger(value)

export const classifyShots = (items: ShotCandidate[]) => {
  const parsed = items.flatMap((item) => {
    const shot = formalShot(item)
    return shot ? [shot] : []
  })
  parsed.sort((left, right) => left.startMs - right.startMs || left.shotIndex - right.shotIndex)
  const formal: FormalShot[] = []
  for (const shot of parsed) {
    const previous = formal[formal.length - 1]
    if (previous && shot.startMs < previous.endMs) continue
    formal.push(shot)
  }
  const rejected = items.filter((item) => item.assetType === 'SHOT').length - formal.length
  return { formal, rejected }
}

const formalShot = (item: ShotCandidate): FormalShot | null => {
  const details = item.details
  if (item.assetType !== 'SHOT' || !item.sourceTaskId || !details.shotId || !details.frameUrl) return null
  if (!integer(details.shotIndex) || details.shotIndex < 1) return null
  if (!integer(details.startMs) || details.startMs < 0) return null
  if (!integer(details.endMs) || details.endMs <= details.startMs) return null
  if (!integer(details.previewTimestampMs)) return null
  if (details.previewTimestampMs < details.startMs || details.previewTimestampMs >= details.endMs) return null
  return {
    assetId: item.assetId,
    sourceTaskId: item.sourceTaskId,
    shotId: details.shotId,
    shotIndex: details.shotIndex,
    startMs: details.startMs,
    endMs: details.endMs,
    previewTimestampMs: details.previewTimestampMs,
    frameUrl: details.frameUrl,
    sizeBytes: item.sizeBytes,
    expiresInSeconds: item.expiresInSeconds,
  }
}

export const timelineDuration = (shots: FormalShot[]) =>
  shots.reduce((duration, shot) => Math.max(duration, shot.endMs), 0)

export const segmentPercent = (shot: FormalShot, durationMs: number) =>
  durationMs <= 0 ? 0 : ((shot.endMs - shot.startMs) / durationMs) * 100

export const activeFormalShot = (shots: FormalShot[], timeMs: number) =>
  shots.find((shot) => shot.startMs <= timeMs && timeMs < shot.endMs) ?? null

export const formatMediaTime = (timestampMs: number) => {
  const minutes = Math.floor(timestampMs / 60000)
  const seconds = Math.floor(timestampMs / 1000) % 60
  const milliseconds = timestampMs % 1000
  const clock = `${minutes}:${seconds.toString().padStart(2, '0')}`
  return milliseconds === 0 ? clock : `${clock}.${milliseconds.toString().padStart(3, '0')}`
}

export const contractShotItems = (): ShotCandidate[] => [
  {
    assetId: '814',
    assetType: 'SHOT',
    sourceTaskId: '922',
    sizeBytes: 139842,
    expiresInSeconds: 600,
    details: {
      shotId: '814',
      shotIndex: 1,
      startMs: 0,
      endMs: 8000,
      previewTimestampMs: 4000,
      frameUrl: 'https://media.example/shot-1.jpg',
    },
  },
  {
    assetId: '815',
    assetType: 'SHOT',
    sourceTaskId: '922',
    sizeBytes: 120000,
    expiresInSeconds: 600,
    details: {
      shotId: '815',
      shotIndex: 2,
      startMs: 8000,
      endMs: 20000,
      previewTimestampMs: 14000,
      frameUrl: 'https://media.example/shot-2.jpg',
    },
  },
]

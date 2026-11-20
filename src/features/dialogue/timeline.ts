export type DialogueLine = {
  assetId: string
  sourceTaskId: string
  segmentIndex: number
  startMs: number
  endMs: number
  text: string
  speakerId: string | null
}

export type DialogueCandidate = {
  assetId: string
  assetType: string
  sourceTaskId: string | null
  details: {
    segmentIndex?: number | null
    startMs?: number | null
    endMs?: number | null
    text?: string | null
    speakerId?: string | null
  }
}

export type SeekRequest = {
  id: number
  seconds: number
  episodeId: string
}

export type DialogueSession = {
  episodeId: string
  selectedId: string | null
  seek: SeekRequest | null
  timeMs: number
}

export type DialoguePlacement = {
  line: DialogueLine
  lane: number
  leftPercent: number
  widthPercent: number
}

const SPEAKER_ID = /^speaker-([1-9]\d*)$/

const integer = (value: number | null | undefined): value is number =>
  typeof value === 'number' && Number.isInteger(value)

export const speakerLabel = (speakerId: string | null) => {
  if (!speakerId) return '未知说话人'
  const match = SPEAKER_ID.exec(speakerId)
  return match ? `说话人 ${match[1]}` : '未知说话人'
}

export const speakerKey = (speakerId: string | null) => speakerId && SPEAKER_ID.test(speakerId) ? speakerId : 'unknown'

/**
 * 只保留半开区间合法、文本非空的对白。重叠句都保留，按开始时间排序。
 */
export const classifyDialogue = (items: DialogueCandidate[]) => {
  const lines = items.flatMap((item) => {
    const line = formalLine(item)
    return line ? [line] : []
  })
  lines.sort((left, right) => left.startMs - right.startMs || left.endMs - right.endMs || left.segmentIndex - right.segmentIndex)
  return lines
}

const formalLine = (item: DialogueCandidate): DialogueLine | null => {
  const details = item.details
  const text = details.text?.trim() ?? ''
  if (item.assetType !== 'DIALOGUE' || !item.sourceTaskId || !text) return null
  if (!integer(details.segmentIndex) || details.segmentIndex < 1) return null
  if (!integer(details.startMs) || details.startMs < 0) return null
  if (!integer(details.endMs) || details.endMs <= details.startMs) return null
  const speakerId = details.speakerId && SPEAKER_ID.test(details.speakerId) ? details.speakerId : null
  return {
    assetId: item.assetId,
    sourceTaskId: item.sourceTaskId,
    segmentIndex: details.segmentIndex,
    startMs: details.startMs,
    endMs: details.endMs,
    text,
    speakerId,
  }
}

export const sameVersion = (lines: DialogueLine[], sourceTaskId: string | undefined) =>
  sourceTaskId ? lines.filter((line) => line.sourceTaskId === sourceTaskId) : lines

/** 播放位置落在 [startMs, endMs) 内的句子都算当前句，重叠时可以同时命中。 */
export const activeDialogue = (lines: DialogueLine[], timeMs: number) =>
  lines.filter((line) => line.startMs <= timeMs && timeMs < line.endMs)

export const silentRanges = (lines: DialogueLine[], durationMs: number) => {
  const ranges: Array<[number, number]> = []
  let cursor = 0
  for (const line of lines) {
    if (line.startMs > cursor) ranges.push([cursor, line.startMs])
    cursor = Math.max(cursor, line.endMs)
  }
  if (durationMs > cursor) ranges.push([cursor, durationMs])
  return ranges
}

/**
 * 时间线长度至少覆盖原视频时长和最后一句的结束时间，空白不压缩。
 * 重叠句分到不同轨道，避免点到被盖住的句子。
 */
export const placeDialogue = (lines: DialogueLine[], durationMs: number): DialoguePlacement[] => {
  const span = Math.max(durationMs, 0)
  const laneEnds: number[] = []
  return lines.map((line) => {
    let lane = laneEnds.findIndex((end) => end <= line.startMs)
    if (lane < 0) {
      lane = laneEnds.length
      laneEnds.push(line.endMs)
    } else {
      laneEnds[lane] = line.endMs
    }
    return {
      line,
      lane,
      leftPercent: span > 0 ? (line.startMs / span) * 100 : 0,
      widthPercent: span > 0 ? ((line.endMs - line.startMs) / span) * 100 : 0,
    }
  })
}

export const timelineDurationMs = (lines: DialogueLine[], mediaDurationMs: number | null) =>
  Math.max(mediaDurationMs ?? 0, ...lines.map((line) => line.endMs), 0)

export const openEpisode = (episodeId: string): DialogueSession => ({
  episodeId,
  selectedId: null,
  seek: null,
  timeMs: 0,
})

export const switchEpisode = (session: DialogueSession, episodeId: string) =>
  session.episodeId === episodeId ? session : openEpisode(episodeId)

/** 点击始终记录原视频的 startMs / 1000。播放器还不能定位时不改当前播放时间。 */
export const nextSeek = (previous: SeekRequest | null, episodeId: string, line: DialogueLine): SeekRequest => ({
  id: (previous?.episodeId === episodeId ? previous.id : 0) + 1,
  seconds: line.startMs / 1000,
  episodeId,
})

export const appliedSeekSeconds = (seek: SeekRequest | null, episodeId: string, positionable: boolean) => {
  if (!seek || seek.episodeId !== episodeId || !positionable) return null
  return seek.seconds
}

export const contractDialogueItems = (): DialogueCandidate[] => [
  {
    assetId: '816',
    assetType: 'DIALOGUE',
    sourceTaskId: '923',
    details: { segmentIndex: 1, startMs: 1200, endMs: 3100, text: '你怎么还在这？', speakerId: 'speaker-1' },
  },
  {
    assetId: '817',
    assetType: 'DIALOGUE',
    sourceTaskId: '923',
    details: { segmentIndex: 2, startMs: 5000, endMs: 7200, text: '我在等末班车。', speakerId: 'speaker-2' },
  },
  {
    assetId: '818',
    assetType: 'DIALOGUE',
    sourceTaskId: '923',
    details: { segmentIndex: 3, startMs: 7000, endMs: 7550, text: '来了。', speakerId: null },
  },
]

/** 组合动作时间轴。对外时间用整数毫秒，动作文件内部用秒。 */

export const comboTracks = [
  { id: 'face', label: '脸部' },
  { id: 'head', label: '头部' },
  { id: 'mouth', label: '口型' },
  { id: 'speech', label: '台词音频' },
] as const

export type ComboTrack = (typeof comboTracks)[number]['id']

export type ComboTrackType = 'MOTION' | 'DIALOGUE'

export const MIN_TIMELINE_MS = 3_000

export const MIN_CLIP_MS = 50

export type ComboClip = {
  segmentId: string
  track: ComboTrack
  trackType: ComboTrackType
  presetId?: string | null
  sourceId: string
  sourceVersionId: string
  label: string
  startMs: number
  durationMs: number
  sourceDurationMs: number | null
}

export type ComboDraft = {
  comboId: string | null
  name: string
  characterId: string
  modelVersionId: string
  durationMs: number
  clips: ComboClip[]
}

export type MotionSource = {
  sourceId: string
  sourceVersionId: string
  name: string
  track: ComboTrack
  trackType: ComboTrackType
  presetId?: string | null
  durationMs: number | null
  group: string | null
  supported?: boolean
  missingParameterIds?: readonly string[]
}

export type MotionCurve = {
  id: string
  segments: readonly number[]
}

export type PlaybackSegment = {
  segmentId: string
  trackType: ComboTrackType
  startTimeMs: number
  durationMs: number
  sourceStartMs: number | null
  resourceUrl: string
  motion: readonly MotionCurve[] | null
}

export const live2dId = () => crypto.randomUUID().replaceAll('-', '')

export const snapMs = (value: number) => Math.max(0, Math.round(value / 10) * 10)

export const clipEnd = (clip: { startMs: number; durationMs: number }) => clip.startMs + clip.durationMs

export const timelineDuration = (
  clips: readonly { startMs: number; durationMs: number }[],
  floor = MIN_TIMELINE_MS,
) => Math.max(floor, ...clips.map(clipEnd))

export const emptyComboDraft = (name: string, characterId: string, modelVersionId: string): ComboDraft => ({
  comboId: null,
  name,
  characterId,
  modelVersionId,
  durationMs: MIN_TIMELINE_MS,
  clips: [],
})

export const trackForMotion = (group: string, sourceId: string): ComboTrack => {
  const text = `${group} ${sourceId}`.toLowerCase()
  if (/mouth|lip|speech|口型|说话/.test(text)) return 'mouth'
  if (/head|nod|angle|头/.test(text)) return 'head'
  if (/face|eye|blink|smile|exp|脸|笑|眨/.test(text)) return 'face'
  return 'face'
}

export const comboDraftKey = (draft: ComboDraft) => JSON.stringify({
  name: draft.name.trim(),
  modelVersionId: draft.modelVersionId,
  durationMs: draft.durationMs,
  segments: draft.clips.map((clip) => ({
    segmentId: clip.segmentId,
    trackType: clip.trackType,
    presetId: clip.presetId ?? null,
    sourceId: clip.sourceId,
    sourceVersionId: clip.sourceVersionId,
    startTimeMs: clip.startMs,
    durationMs: clip.durationMs,
  })).toSorted((left, right) => left.startTimeMs - right.startTimeMs || left.segmentId.localeCompare(right.segmentId)),
})

export const comboFingerprint = (draft: ComboDraft) => comboDraftKey(draft)

export const acceptComboPreview = (startedKey: string, currentKey: string) => startedKey === currentKey

export const placeClip = (draft: ComboDraft, source: MotionSource, playheadMs: number): ComboDraft => {
  const startMs = snapMs(Math.min(Math.max(0, playheadMs), draft.durationMs))
  const available = source.durationMs ?? 1_000
  const durationMs = Math.min(Math.max(MIN_CLIP_MS, snapMs(available)), available)
  const clip: ComboClip = {
    segmentId: live2dId(),
    track: source.track,
    trackType: source.trackType,
    presetId: source.presetId ?? null,
    sourceId: source.sourceId,
    sourceVersionId: source.sourceVersionId,
    label: source.name,
    startMs,
    durationMs: Math.max(1, durationMs),
    sourceDurationMs: source.durationMs,
  }
  const clips = [...draft.clips, clip]
  return { ...draft, clips, durationMs: timelineDuration(clips, Math.max(draft.durationMs, clipEnd(clip))) }
}

export const moveClip = (draft: ComboDraft, segmentId: string, startMs: number): ComboDraft => {
  const clips = draft.clips.map((clip) => clip.segmentId === segmentId ? { ...clip, startMs: snapMs(startMs) } : clip)
  return { ...draft, clips, durationMs: timelineDuration(clips, MIN_TIMELINE_MS) }
}

export const trimClip = (
  draft: ComboDraft,
  segmentId: string,
  edge: 'start' | 'end',
  timeMs: number,
): ComboDraft => {
  const clips = draft.clips.map((clip) => {
    if (clip.segmentId !== segmentId) return clip
    const limit = clip.sourceDurationMs
    if (edge === 'start') {
      const end = clipEnd(clip)
      const start = Math.min(snapMs(timeMs), end - MIN_CLIP_MS)
      const durationMs = end - Math.max(0, start)
      return { ...clip, startMs: Math.max(0, start), durationMs: limit === null ? durationMs : Math.min(durationMs, limit) }
    }
    const end = Math.max(clip.startMs + MIN_CLIP_MS, snapMs(timeMs))
    const durationMs = end - clip.startMs
    return { ...clip, durationMs: limit === null ? durationMs : Math.min(durationMs, limit) }
  })
  return { ...draft, clips, durationMs: timelineDuration(clips) }
}

export const removeClip = (draft: ComboDraft, segmentId: string): ComboDraft => {
  const clips = draft.clips.filter((clip) => clip.segmentId !== segmentId)
  return { ...draft, clips, durationMs: timelineDuration(clips) }
}

export const labelComboClips = (clips: readonly ComboClip[], sources: readonly MotionSource[]) =>
  clips.map((clip) => {
    const source = sources.find((item) => item.sourceId === clip.sourceId)
    if (!source) return clip
    return { ...clip, label: source.name, track: source.track, sourceDurationMs: source.durationMs }
  })

export const conflictSegmentIds = (issues: readonly { segmentIds: readonly string[] }[]) => [
  ...new Set(issues.flatMap((item) => item.segmentIds)),
]

export const overlappingClipIds = (clips: readonly ComboClip[], timeMs: number) =>
  clips.filter((clip) => timeMs >= clip.startMs && timeMs < clipEnd(clip)).map((clip) => clip.segmentId)

export const formatComboClock = (timeMs: number) => {
  const clamped = Math.max(0, Math.round(timeMs))
  const centiseconds = Math.floor(clamped / 10)
  const fraction = centiseconds % 100
  const totalSeconds = Math.floor(centiseconds / 100)
  const seconds = totalSeconds % 60
  const minutes = Math.floor(totalSeconds / 60)
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(fraction).padStart(2, '0')}`
}

export const advanceComboClock = (timeMs: number, deltaMs: number, durationMs: number, loop: boolean) => {
  const duration = Math.max(durationMs, 1)
  const next = timeMs + deltaMs
  if (next < duration) return { timeMs: next, stop: false }
  if (loop) return { timeMs: next % duration, stop: false }
  return { timeMs: duration, stop: true }
}

const readPoint = (segments: readonly number[], index: number) => {
  const time = segments[index]
  const value = segments[index + 1]
  if (time === undefined || value === undefined) return null
  return { time, value }
}

const bezierValue = (
  start: { time: number; value: number },
  controlA: { time: number; value: number },
  controlB: { time: number; value: number },
  end: { time: number; value: number },
  time: number,
) => {
  let low = 0
  let high = 1
  for (let step = 0; step < 18; step += 1) {
    const mid = (low + high) / 2
    const inverse = 1 - mid
    const curveTime = inverse ** 3 * start.time
      + 3 * inverse ** 2 * mid * controlA.time
      + 3 * inverse * mid ** 2 * controlB.time
      + mid ** 3 * end.time
    if (curveTime < time) low = mid
    else high = mid
  }
  const mid = (low + high) / 2
  const inverse = 1 - mid
  return inverse ** 3 * start.value
    + 3 * inverse ** 2 * mid * controlA.value
    + 3 * inverse * mid ** 2 * controlB.value
    + mid ** 3 * end.value
}

export const sampleMotionCurve = (segments: readonly number[], timeSeconds: number) => {
  const first = readPoint(segments, 0)
  if (!first) return null
  if (timeSeconds <= first.time) return first.value
  let index = 2
  let previous = first
  while (index < segments.length) {
    const curve = segments[index]
    if (curve === 1) {
      const controlA = readPoint(segments, index + 1)
      const controlB = readPoint(segments, index + 3)
      const end = readPoint(segments, index + 5)
      if (!controlA || !controlB || !end) return previous.value
      if (timeSeconds <= end.time) return bezierValue(previous, controlA, controlB, end, timeSeconds)
      previous = end
      index += 7
      continue
    }
    const end = readPoint(segments, index + 1)
    if (!end) return previous.value
    if (timeSeconds <= end.time) {
      if (curve === 2) return previous.value
      if (curve === 3) return end.value
      const span = end.time - previous.time
      if (span <= 0) return end.value
      const ratio = (timeSeconds - previous.time) / span
      return previous.value + (end.value - previous.value) * ratio
    }
    previous = end
    index += 3
  }
  return previous.value
}

export const sampleMotion3 = (curves: readonly MotionCurve[], timeSeconds: number) => curves.flatMap((curve) => {
  const value = sampleMotionCurve(curve.segments, timeSeconds)
  return value === null ? [] : [{ id: curve.id, value }]
})

export const parseMotion3 = (payload: unknown): MotionCurve[] => {
  if (!payload || typeof payload !== 'object' || !('Curves' in payload) || !Array.isArray(payload.Curves)) return []
  return payload.Curves.flatMap((curve) => {
    if (!curve || typeof curve !== 'object') return []
    const target = 'Target' in curve ? curve.Target : null
    const id = 'Id' in curve ? curve.Id : null
    const segments = 'Segments' in curve ? curve.Segments : null
    if (target !== 'Parameter' || typeof id !== 'string' || !Array.isArray(segments)) return []
    const numbers = segments.filter((item): item is number => typeof item === 'number' && Number.isFinite(item))
    return numbers.length >= 2 ? [{ id, segments: numbers }] : []
  })
}

export const samplePlayback = (segments: readonly PlaybackSegment[], timeMs: number) => {
  const values = new Map<string, number>()
  for (const segment of segments) {
    if (segment.trackType !== 'MOTION' || !segment.motion) continue
    const local = timeMs - segment.startTimeMs
    if (local < 0 || local >= segment.durationMs) continue
    const at = ((segment.sourceStartMs ?? 0) + local) / 1000
    for (const point of sampleMotion3(segment.motion, at)) values.set(point.id, point.value)
  }
  return [...values].map(([id, value]) => ({ id, value }))
}

export const dialogueWindow = (
  segment: { startTimeMs: number; durationMs: number; sourceStartMs: number | null },
  timeMs: number,
) => {
  const local = timeMs - segment.startTimeMs
  if (local < 0 || local >= segment.durationMs) return null
  return { offsetSeconds: ((segment.sourceStartMs ?? 0) + local) / 1000, remainingSeconds: (segment.durationMs - local) / 1000 }
}

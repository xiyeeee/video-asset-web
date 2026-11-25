import axios from 'axios'
import { z } from 'zod'
import { AuthError, authorizedRequest } from '@/features/auth/auth-api'
import { useSession } from '@/features/auth/session'
import { listLive2dCharacters, listLive2dVersions } from './api'
import { modelRequestNeedsAuth } from './contract'
import {
  parseMotion3,
  trackForMotion,
  type ComboClip,
  type ComboDraft,
  type MotionCurve,
  type MotionSource,
  type PlaybackSegment,
} from './combo-contract'

const gateway = axios.create({ baseURL: '/api', timeout: 20_000 })

const projectPath = (projectId: string) => `/projects/${encodeURIComponent(projectId)}/live2d/combo-motions`

const decimalId = z.union([z.string().min(1), z.number().int().positive()]).transform((value) => String(value))

const nullableDuration = z.union([z.number().int().positive(), z.null()]).optional().transform((value) => value ?? null)

const motionSchema = z.object({
  sourceId: z.string().min(1),
  sourceVersionId: decimalId,
  group: z.string().min(1),
  index: z.number().int().positive(),
  durationMs: nullableDuration,
  resourceUrl: z.string().min(1),
})

const presetSchema = z.object({
  presetId: z.string().min(1),
  supported: z.boolean(),
  parameterIds: z.array(z.string()),
  missingParameterIds: z.array(z.string()),
})

const dialogueSchema = z.object({
  sourceId: z.string().min(1),
  sourceVersionId: decimalId,
  episodeId: decimalId,
  lineText: z.string(),
  sourceStartMs: z.number().int().nonnegative(),
  durationMs: z.number().int().positive(),
  resourceUrl: z.string().min(1),
  previewExpiresInSeconds: z.number().int().nonnegative(),
})

const catalogSchema = z.object({
  modelVersion: z.object({ modelVersionId: decimalId, modelName: z.string().min(1) }),
  presets: z.array(presetSchema),
  motions: z.array(motionSchema),
  dialogues: z.object({
    items: z.array(dialogueSchema),
    page: z.number().int().positive(),
    size: z.number().int().positive(),
    total: z.number().int().nonnegative(),
  }),
})

const summarySchema = z.object({
  id: z.string().min(1),
  modelVersionId: decimalId,
  name: z.string().min(1),
  durationMs: z.number().int().positive(),
  status: z.string().min(1),
  savedAt: z.string().min(1),
  updatedAt: z.string().min(1),
})

const pageSchema = z.object({
  items: z.array(summarySchema),
  page: z.number().int().positive(),
  size: z.number().int().positive(),
  total: z.number().int().nonnegative(),
})

const segmentSchema = z.object({
  segmentId: z.string().regex(/^[a-f0-9]{32}$/),
  trackType: z.enum(['MOTION', 'DIALOGUE']),
  presetId: z.string().min(1).nullable().optional(),
  sourceId: z.string().min(1),
  sourceVersionId: decimalId,
  startTimeMs: z.number().int().nonnegative(),
  durationMs: z.number().int().positive(),
})

const timelineSchema = z.object({
  projectId: decimalId,
  modelVersionId: decimalId,
  name: z.string().min(1),
  durationMs: z.number().int().positive(),
  segments: z.array(segmentSchema),
})

const issueSchema = z.object({
  code: z.string().min(1),
  message: z.string(),
  segmentIds: z.preprocess(
    (value) => Array.isArray(value) ? value : [],
    z.array(z.string().min(1)),
  ),
})

const stringListSchema = z.preprocess(
  (value) => Array.isArray(value) ? value : [],
  z.array(z.string().min(1)),
)

const playbackSegmentSchema = z.object({
  segmentId: z.string().min(1),
  trackType: z.enum(['MOTION', 'DIALOGUE']),
  startTimeMs: z.number().int().nonnegative(),
  durationMs: z.number().int().positive(),
  sourceStartMs: z.number().int().nonnegative().nullable().optional(),
  resourceUrl: z.string().min(1).nullable().optional(),
})

const playbackSchema = z.object({
  durationMs: z.number().int().positive(),
  segments: z.array(playbackSegmentSchema),
  compiledMotion: z.object({
    formatVersion: z.number().int().positive(),
    format: z.literal('cubism-motion3'),
    durationMs: z.number().int().positive(),
    resourceUrl: z.string().min(1).nullable().optional(),
    previewExpiresInSeconds: z.number().int().positive().optional(),
  }).nullable().optional(),
})

const compileSchema = z.object({
  compilationId: z.string().min(1),
  requestId: z.string().min(1),
  contentHash: z.string().min(1),
  modelVersionId: decimalId,
  status: z.enum(['READY', 'CONFLICT']),
  durationMs: z.number().int().positive(),
  issues: z.preprocess((value) => Array.isArray(value) ? value : [], z.array(issueSchema)),
  missingCapabilities: stringListSchema,
  modelEntryUrl: z.string().min(1),
  playbackManifest: playbackSchema,
})

const detailSchema = z.object({
  comboId: z.string().min(1),
  projectId: decimalId,
  modelVersionId: decimalId,
  name: z.string().min(1),
  durationMs: z.number().int().positive(),
  status: z.string().min(1),
  modelEntryUrl: z.string().min(1),
  timeline: timelineSchema,
  playbackManifest: playbackSchema,
})

export type ComboSummary = {
  comboId: string
  modelVersionId: string
  name: string
  durationMs: number
  status: string
  updatedAt: string
}

export type ComboIssue = z.infer<typeof issueSchema>

export type ComboCompile = {
  compilationId: string
  requestId: string
  status: 'READY' | 'CONFLICT'
  modelEntryUrl: string
  issues: ComboIssue[]
  missingCapabilities: string[]
  segments: PlaybackSegment[]
}

export type ModelChoice = {
  characterId: string
  characterName: string
  versionId: string
  versionNumber: number
  modelName: string
  label: string
}

const segmentBody = (clip: ComboClip) => ({
  segmentId: clip.segmentId,
  trackType: clip.trackType,
  presetId: clip.presetId ?? null,
  sourceId: clip.sourceId,
  sourceVersionId: clip.sourceVersionId,
  startTimeMs: clip.startMs,
  durationMs: clip.durationMs,
})

const toClip = (segment: z.infer<typeof segmentSchema>): ComboClip => ({
  segmentId: segment.segmentId,
  track: segment.trackType === 'DIALOGUE' ? 'speech' : trackForMotion('', segment.sourceId),
  trackType: segment.trackType,
  presetId: segment.presetId ?? null,
  sourceId: segment.sourceId,
  sourceVersionId: segment.sourceVersionId,
  label: segment.trackType === 'DIALOGUE' ? '台词' : segment.sourceId.split('/').at(-1) ?? segment.sourceId,
  startMs: segment.startTimeMs,
  durationMs: segment.durationMs,
  sourceDurationMs: null,
})

const expireIfNeeded = (status: number) => {
  if (status === 401) useSession.getState().expire(useSession.getState().revision)
}

export const listModelChoices = async (projectId: string, signal?: AbortSignal) => {
  const characters = await listLive2dCharacters(projectId, signal)
  const groups = await Promise.all(characters.map(async (character) => {
    const versions = await listLive2dVersions(projectId, character.characterId, signal)
    return versions.map((version) => ({
      characterId: character.characterId,
      characterName: character.name,
      versionId: version.versionId,
      versionNumber: version.versionNumber,
      modelName: version.modelName,
      label: `${version.modelName} · V${version.versionNumber}`,
    }))
  }))
  return groups.flat()
}

export const listComboMotions = async (projectId: string, signal?: AbortSignal) => {
  const items: ComboSummary[] = []
  let page = 1
  while (page <= 50) {
    const result = await authorizedRequest(
      (authorization) => gateway.get(projectPath(projectId), {
        signal,
        params: { page, size: 100 },
        headers: { Authorization: authorization },
      }),
      pageSchema,
    )
    items.push(...result.data.items.map((item) => ({
      comboId: item.id,
      modelVersionId: item.modelVersionId,
      name: item.name,
      durationMs: item.durationMs,
      status: item.status,
      updatedAt: item.updatedAt,
    })))
    if (items.length >= result.data.total || result.data.items.length === 0) return items
    page += 1
  }
  return items
}

export const listComboCatalog = async (projectId: string, modelVersionId: string, signal?: AbortSignal) => {
  const sources: MotionSource[] = []
  let page = 1
  let motionsRead = false
  while (page <= 50) {
    const result = await authorizedRequest(
      (authorization) => gateway.get(`${projectPath(projectId)}/catalog`, {
        signal,
        params: { modelVersionId, page, size: 100 },
        headers: { Authorization: authorization },
      }),
      catalogSchema,
    )
    if (!motionsRead) {
      sources.push(...result.data.motions.map((item) => ({
        sourceId: item.sourceId,
        sourceVersionId: item.sourceVersionId,
        name: `${item.group} ${item.index}`,
        track: trackForMotion(item.group, item.sourceId),
        trackType: 'MOTION' as const,
        presetId: null,
        durationMs: item.durationMs,
        group: item.group,
      })))
      sources.push(...result.data.presets.map((item) => ({
        sourceId: `preset:${item.presetId}`,
        sourceVersionId: modelVersionId,
        name: ({ blink: '眨眼', smile: '微笑', nod: '点头' }[item.presetId] ?? item.presetId)
          + (item.supported ? '' : `（缺少：${item.missingParameterIds.join('、')}）`),
        track: trackForMotion(item.presetId, item.presetId),
        trackType: 'MOTION' as const,
        presetId: item.presetId,
        durationMs: null,
        group: item.presetId,
        supported: item.supported,
        missingParameterIds: item.missingParameterIds,
      })))
      motionsRead = true
    }
    sources.push(...result.data.dialogues.items.map((item) => ({
      sourceId: item.sourceId,
      sourceVersionId: item.sourceVersionId,
      name: item.lineText || '台词',
      track: 'speech' as const,
      trackType: 'DIALOGUE' as const,
      presetId: null,
      durationMs: item.durationMs,
      group: null,
    })))
    if (sources.filter((item) => item.trackType === 'DIALOGUE').length >= result.data.dialogues.total
      || result.data.dialogues.items.length === 0) {
      return sources
    }
    page += 1
  }
  return sources
}

export const getComboMotion = async (projectId: string, comboId: string, signal?: AbortSignal) => {
  const result = await authorizedRequest(
    (authorization) => gateway.get(`${projectPath(projectId)}/${encodeURIComponent(comboId)}`, {
      signal,
      headers: { Authorization: authorization },
    }),
    detailSchema,
  )
  const timeline = result.data.timeline
  return {
    draft: {
      comboId: result.data.comboId,
      name: timeline.name,
      characterId: '',
      modelVersionId: result.data.modelVersionId,
      durationMs: timeline.durationMs,
      clips: timeline.segments.map(toClip),
    },
    modelEntryUrl: result.data.modelEntryUrl,
    playback: toPlaybackSegments(result.data.playbackManifest),
  }
}

const toPlaybackSegments = (manifest: z.infer<typeof playbackSchema>): PlaybackSegment[] => {
  const segments: PlaybackSegment[] = []
  const compiledMotion = manifest.compiledMotion
  if (compiledMotion?.resourceUrl) {
    segments.push({
      segmentId: 'compiled-motion',
      trackType: 'MOTION',
      startTimeMs: 0,
      durationMs: manifest.durationMs,
      sourceStartMs: null,
      resourceUrl: compiledMotion.resourceUrl,
      motion: null,
    })
  }
  for (const segment of manifest.segments) {
    if (segment.trackType !== 'DIALOGUE' || !segment.resourceUrl) continue
    segments.push({
      segmentId: segment.segmentId,
      trackType: 'DIALOGUE',
      startTimeMs: segment.startTimeMs,
      durationMs: segment.durationMs,
      sourceStartMs: segment.sourceStartMs ?? null,
      resourceUrl: segment.resourceUrl,
      motion: null,
    })
  }
  return segments
}

const compilePayload = (draft: ComboDraft, requestId: string) => ({
  requestId,
  modelVersionId: draft.modelVersionId,
  name: draft.name.trim(),
  durationMs: draft.durationMs,
  segments: draft.clips.map(segmentBody),
})

export const compileComboMotion = async (
  projectId: string,
  draft: ComboDraft,
  requestId: string,
  signal?: AbortSignal,
) => {
  const result = await authorizedRequest(
    (authorization) => gateway.post(`${projectPath(projectId)}/compile`, compilePayload(draft, requestId), {
      signal,
      timeout: 60_000,
      headers: { Authorization: authorization },
    }),
    compileSchema,
  )
  return {
    compilationId: result.data.compilationId,
    requestId: result.data.requestId,
    status: result.data.status,
    modelEntryUrl: result.data.modelEntryUrl,
    issues: result.data.issues,
    missingCapabilities: result.data.missingCapabilities,
    segments: toPlaybackSegments(result.data.playbackManifest),
  } satisfies ComboCompile
}

const savePayload = (draft: ComboDraft, compilationId: string, requestId: string) => ({
  requestId,
  compilationId,
  modelVersionId: draft.modelVersionId,
  name: draft.name.trim(),
  durationMs: draft.durationMs,
  segments: draft.clips.map(segmentBody),
})

export const createComboMotion = (projectId: string, draft: ComboDraft, compilationId: string, requestId: string, signal?: AbortSignal) =>
  authorizedRequest(
    (authorization) => gateway.post(projectPath(projectId), savePayload(draft, compilationId, requestId), {
      signal,
      headers: { Authorization: authorization },
    }),
    detailSchema,
  ).then((result) => result.data.comboId)

export const updateComboMotion = (
  projectId: string,
  comboId: string,
  draft: ComboDraft,
  compilationId: string,
  requestId: string,
  signal?: AbortSignal,
) =>
  authorizedRequest(
    (authorization) => gateway.put(`${projectPath(projectId)}/${encodeURIComponent(comboId)}`, savePayload(draft, compilationId, requestId), {
      signal,
      headers: { Authorization: authorization },
    }),
    detailSchema,
  ).then((result) => result.data.comboId)

export const retryComboSave = (projectId: string, requestId: string, signal?: AbortSignal) =>
  authorizedRequest(
    (authorization) => gateway.post(`${projectPath(projectId)}/save-requests/${encodeURIComponent(requestId)}/retry`, null, {
      signal,
      headers: { Authorization: authorization },
    }),
    detailSchema,
  ).then((result) => result.data.comboId)

export const fetchComboResource = async (url: string, signal: AbortSignal) => {
  const resource = new URL(url, window.location.origin)
  const sameOrigin = resource.origin === window.location.origin
  const path = sameOrigin ? `${resource.pathname}${resource.search}` : null
  const apiPath = path?.startsWith('/api/') ? path.slice(4) : null
  const needsAuth = modelRequestNeedsAuth(url, window.location.origin)
  if (apiPath === null) {
    const response = await fetch(url, { signal })
    if (!response.ok) throw new AuthError('组合资源加载失败', response.status, 'UNKNOWN')
    return response.blob()
  }
  const token = useSession.getState().token
  if (needsAuth && !token) throw new AuthError('请先登录', 401, 'UNAUTHENTICATED')
  try {
    const response = await gateway.get<Blob>(apiPath, {
      signal,
      responseType: 'blob',
      timeout: 60_000,
      headers: needsAuth && token ? { Authorization: `Bearer ${token}` } : {},
    })
    return response.data
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 401) expireIfNeeded(401)
    throw new AuthError('组合资源加载失败', axios.isAxiosError(error) ? error.response?.status ?? 0 : 0, 'UNKNOWN')
  }
}

export const loadMotionCurves = async (url: string, signal: AbortSignal): Promise<MotionCurve[]> => {
  const blob = await fetchComboResource(url, signal)
  return parseMotion3(JSON.parse(await blob.text()) as unknown)
}

export const comboErrorMessage = (error: unknown, fallback: string) => {
  if (!(error instanceof AuthError)) return fallback
  if (error.code === 'ABORTED') return ''
  if (error.code === 'TIMEOUT') return '请求超时，请稍后重试。'
  if (error.code === 'NETWORK_ERROR') return '网络请求失败，请检查连接后重试。'
  if (error.status === 401 || error.code === 'UNAUTHENTICATED') return '登录已失效，请重新登录。'
  if (error.code === 'LIVE2D_COMBO_CONFLICT') return '时间轴已经变化，请重新编译后再保存。'
  if (error.code === 'LIVE2D_COMBO_SAVE_IN_PROGRESS') return '这个组合正在保存，请稍后重试。'
  if (error.code === 'LIVE2D_COMBO_SAVE_FAILED') return '组合没有保存成功，可以重试这次保存。'
  if (error.code === 'LIVE2D_COMBO_COMPILER_UNAVAILABLE') return '动作编译服务暂时不可用。'
  if (error.code === 'LIVE2D_COMBO_NOT_FOUND') return '组合、模型或台词不存在。'
  if (error.code === 'LIVE2D_COMBO_INVALID' || error.code === 'INVALID_REQUEST') return '组合的名称、时长或片段不符合要求。'
  if (error.code === 'INVALID_RESPONSE') return error.message
  if (error.status === 404) return '组合或模型不存在，可能已被删除。'
  if (error.status >= 500) return '动作服务暂时不可用，请稍后重试。'
  return error.message || fallback
}

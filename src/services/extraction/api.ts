import axios from 'axios'
import { z } from 'zod'
import { AuthError, authorizedRequest, isCancelled } from '@/features/auth/auth-api'
import {
  characterProgressText,
  characterStatusLabel,
  characterTaskErrorMessage,
  getLatestCharacterTask,
  retryCharacterExtraction,
  startCharacterExtraction,
  type CharacterTask,
} from '@/services/characters/api'
import { listEpisodes, uploadEpisode, type EpisodeSummary } from '@/services/episodes/api'
import { listProjects } from '@/services/projects/api'

export const extractTypes = ['SHOT', 'CHARACTER', 'DIALOGUE', 'BACKGROUND', 'AUDIO', 'STORY'] as const

export type ExtractType = (typeof extractTypes)[number]

export type TaskStatus = 'PENDING' | 'RUNNING' | 'SUCCESS' | 'PARTIAL_SUCCESS' | 'FAILED' | 'CANCELLED'

export type ExtractionCapability = {
  type: ExtractType
  supported: boolean
}

export type TaskStep = {
  type: ExtractType
  state: 'done' | 'running' | 'pending' | 'failed' | 'unsupported'
  detail: string
}

export type ExtractionTask = {
  id: string
  projectId: string
  projectName: string
  episodeId: string
  episodeNumber: number
  episodeTitle: string
  types: ExtractType[]
  status: TaskStatus
  createdAt: string
  startedAt: string | null
  finishedAt: string | null
  stageLabel: string
  errorMessage: string | null
  steps: TaskStep[]
}

export type PendingEpisode = {
  projectId: string
  projectName: string
  episodeId: string
  episodeNumber: number
  episodeTitle: string
}

export type ExtractionBoard = {
  tasks: ExtractionTask[]
  pendingEpisodes: PendingEpisode[]
  failedReads: number
  source: 'unified' | 'legacy'
}

export type UploadExtractionResult = {
  episode: EpisodeSummary
  created: boolean
  autoExtract: boolean
  taskId: string | null
  taskError: unknown
}

const capabilitySchema = z.object({
  type: z.enum(extractTypes),
  supported: z.boolean(),
})

const unifiedTaskSchema = z.object({
  id: z.string().min(1).optional(),
  taskId: z.union([z.string().min(1), z.number()]).optional(),
  projectId: z.union([z.string().min(1), z.number()]).optional(),
  episodeId: z.union([z.string().min(1), z.number()]),
  status: z.enum(['PENDING', 'RUNNING', 'SUCCESS', 'PARTIAL_SUCCESS', 'FAILED', 'CANCELLED']).optional(),
  taskStatus: z.enum(['PENDING', 'RUNNING', 'SUCCESS', 'PARTIAL_SUCCESS', 'FAILED', 'CANCELLED']).optional(),
  extractTypes: z.array(z.enum(extractTypes)).optional(),
  createdAt: z.string().optional(),
  startedAt: z.string().nullable().optional(),
  finishedAt: z.string().nullable().optional(),
  errorMessage: z.string().nullable().optional(),
})

const media = axios.create({ baseURL: '/api/media/v1', timeout: 15_000 })
const ai = axios.create({ baseURL: '/api/ai/v1', timeout: 15_000 })

export const extractionBoardKey = ['extraction-board'] as const

export const capabilityKey = ['extraction-capabilities'] as const

const typeMeta: Record<ExtractType, string> = {
  SHOT: '分镜',
  CHARACTER: '人物',
  DIALOGUE: '对话',
  BACKGROUND: '背景',
  AUDIO: '音频',
  STORY: '剧情',
}

export const extractTypeName = (type: ExtractType) => typeMeta[type]

const missingEndpoint = (error: unknown) => error instanceof AuthError && error.status === 404

const asText = (value: string | number | undefined) => (value === undefined ? '' : String(value))

const fillCapabilities = (items: ExtractionCapability[]) => extractTypes.map((type) => (
  items.find((item) => item.type === type) ?? { type, supported: false }
))

const legacyCapabilities = (): ExtractionCapability[] => extractTypes.map((type) => ({
  type,
  supported: type === 'CHARACTER',
}))

export const listExtractionCapabilities = async (signal?: AbortSignal) => {
  try {
    const result = await authorizedRequest(
      (authorization) => media.get('/extraction-capabilities', {
        signal,
        headers: { Authorization: authorization },
      }),
      z.array(capabilitySchema),
    )
    return fillCapabilities(result.data)
  } catch (error) {
    if (!missingEndpoint(error)) throw error
    return legacyCapabilities()
  }
}

const mapCharacterStatus = (status: CharacterTask['status']): TaskStatus => {
  if (status === 'SUCCEEDED') return 'SUCCESS'
  if (status === 'FAILED') return 'FAILED'
  if (status === 'RUNNING') return 'RUNNING'
  return 'PENDING'
}

const stepState = (status: TaskStatus): TaskStep['state'] => {
  if (status === 'SUCCESS' || status === 'PARTIAL_SUCCESS') return 'done'
  if (status === 'RUNNING') return 'running'
  if (status === 'FAILED' || status === 'CANCELLED') return 'failed'
  return 'pending'
}

const characterSteps = (task: CharacterTask, status: TaskStatus): TaskStep[] => extractTypes.map((type) => {
  if (type !== 'CHARACTER') return { type, state: 'unsupported', detail: '暂不支持' }
  const progress = characterProgressText(task)
  const detail = status === 'FAILED'
    ? characterTaskErrorMessage(task.errorCode)
    : progress || characterStatusLabel(task)
  return { type, state: stepState(status), detail }
})

const toCharacterView = (
  task: CharacterTask,
  project: { id: string; name: string },
  episode: EpisodeSummary,
): ExtractionTask => {
  const status = mapCharacterStatus(task.status)
  const progress = characterProgressText(task)
  return {
    id: task.id,
    projectId: project.id,
    projectName: project.name,
    episodeId: episode.id,
    episodeNumber: episode.episodeNumber,
    episodeTitle: episode.title,
    types: ['CHARACTER'],
    status,
    createdAt: task.createdAt,
    startedAt: null,
    finishedAt: task.finishedAt,
    stageLabel: progress || characterStatusLabel(task),
    errorMessage: status === 'FAILED' ? characterTaskErrorMessage(task.errorCode) : null,
    steps: characterSteps(task, status),
  }
}

const loadLegacyBoard = async (signal?: AbortSignal): Promise<ExtractionBoard> => {
  const projects = await listProjects({ q: '', page: 1, size: 100 }, signal)
  const groups = await Promise.all(projects.items.map(async (project) => {
    const episodes = await listEpisodes({ projectId: project.id, page: 1, size: 100 }, signal)
    return Promise.all(episodes.items.map(async (episode) => {
      try {
        const task = await getLatestCharacterTask(project.id, episode.id, signal)
        return { project, episode, task, failed: false }
      } catch (error) {
        if (isCancelled(error)) throw error
        return { project, episode, task: null, failed: true }
      }
    }))
  }))
  const rows = groups.flat()
  return {
    source: 'legacy',
    failedReads: rows.filter((row) => row.failed).length,
    tasks: rows.flatMap((row) => (
      row.task ? [toCharacterView(row.task, row.project, row.episode)] : []
    )),
    pendingEpisodes: rows.flatMap((row) => (
      row.task || row.failed ? [] : [{
        projectId: row.project.id,
        projectName: row.project.name,
        episodeId: row.episode.id,
        episodeNumber: row.episode.episodeNumber,
        episodeTitle: row.episode.title,
      }]
    )),
  }
}

export const loadExtractionBoard = async (signal?: AbortSignal) => {
  try {
    const result = await authorizedRequest(
      (authorization) => ai.get('/tasks', { signal, headers: { Authorization: authorization } }),
      z.array(unifiedTaskSchema),
    )
    if (result.data.length === 0) return loadLegacyBoard(signal)
    return {
      source: 'unified' as const,
      failedReads: 0,
      pendingEpisodes: [],
      tasks: result.data.flatMap((item) => {
        const id = asText(item.taskId ?? item.id)
        const episodeId = asText(item.episodeId)
        if (!id || !episodeId) return []
        const status = item.status ?? item.taskStatus ?? 'PENDING'
        const types = item.extractTypes ?? []
        return [{
          id,
          projectId: asText(item.projectId),
          projectName: '',
          episodeId,
          episodeNumber: 0,
          episodeTitle: '',
          types,
          status,
          createdAt: item.createdAt ?? '',
          startedAt: item.startedAt ?? null,
          finishedAt: item.finishedAt ?? null,
          stageLabel: status,
          errorMessage: item.errorMessage ?? null,
          steps: extractTypes.map((type) => ({
            type,
            state: types.includes(type) ? stepState(status) : 'unsupported' as const,
            detail: types.includes(type) ? '' : '暂不支持',
          })),
        }]
      }),
    }
  } catch (error) {
    if (!missingEndpoint(error)) throw error
    return loadLegacyBoard(signal)
  }
}

const createUnifiedTask = async (projectId: string, episodeId: string, types: ExtractType[]) => {
  const result = await authorizedRequest(
    (authorization) => ai.post('/tasks', {
      projectId,
      episodeId,
      extractTypes: types,
    }, { headers: { Authorization: authorization } }),
    unifiedTaskSchema,
  )
  return result.data
}

export const createExtractionTask = async (projectId: string, episodeId: string, types: ExtractType[]) => {
  const requested = types.filter((type) => extractTypes.includes(type))
  if (requested.length === 0) throw new AuthError('请至少选择一种已支持的提取类型。', 400, 'INVALID_REQUEST')
  try {
    const created = await createUnifiedTask(projectId, episodeId, requested)
    const id = asText(created.taskId ?? created.id)
    if (id) return { id, source: 'unified' as const }
  } catch (error) {
    if (!missingEndpoint(error)) throw error
  }
  if (!requested.includes('CHARACTER')) {
    throw new AuthError('所选素材类型的提取接口尚未提供，视频仍保留在剧集中。', 404, 'NOT_FOUND')
  }
  const task = await startCharacterExtraction(projectId, episodeId)
  return { id: task.id, source: 'legacy' as const }
}

export const retryExtractionTask = async (task: ExtractionTask) => {
  try {
    await authorizedRequest(
      (authorization) => ai.post(`/tasks/${task.id}/retry`, undefined, {
        headers: { Authorization: authorization },
      }),
      unifiedTaskSchema,
    )
    return
  } catch (error) {
    if (!missingEndpoint(error)) throw error
  }
  if (!task.types.includes('CHARACTER')) {
    throw new AuthError('这个任务暂时不能重试。', 404, 'NOT_FOUND')
  }
  await retryCharacterExtraction(task.projectId, task.episodeId, task.id)
}

export const uploadAndExtract = async (input: {
  projectId: string
  file: File
  idempotencyKey: string
  autoExtract: boolean
  extractTypes: ExtractType[]
  onProgress: (ratio: number) => void
  onUploaded?: () => void
  signal?: AbortSignal
}): Promise<UploadExtractionResult> => {
  const uploaded = await uploadEpisode(
    input.projectId,
    input.file,
    input.idempotencyKey,
    input.onProgress,
    input.signal,
  )
  if (!input.autoExtract) {
    return { episode: uploaded.episode, created: uploaded.created, autoExtract: false, taskId: null, taskError: null }
  }
  input.onUploaded?.()
  try {
    const created = await createExtractionTask(input.projectId, uploaded.episode.id, input.extractTypes)
    return { episode: uploaded.episode, created: uploaded.created, autoExtract: true, taskId: created.id, taskError: null }
  } catch (error) {
    return { episode: uploaded.episode, created: uploaded.created, autoExtract: true, taskId: null, taskError: error }
  }
}

export const taskStatusLabel = (status: TaskStatus) => {
  if (status === 'PENDING') return '排队中'
  if (status === 'RUNNING') return '运行中'
  if (status === 'SUCCESS') return '已完成'
  if (status === 'PARTIAL_SUCCESS') return '部分完成'
  if (status === 'CANCELLED') return '已取消'
  return '失败'
}

export const activeTask = (status: TaskStatus) => status === 'PENDING' || status === 'RUNNING'

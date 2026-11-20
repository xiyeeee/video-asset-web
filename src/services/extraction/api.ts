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
  episode: EpisodeSummary | null
  episodeId: string
  created: boolean
  autoExtract: boolean
  taskId: string | null
  taskStatus: TaskStatus | null
  taskError: unknown
}

const uploadResultSchema = z.object({
  videoId: z.string().min(1),
  episodeId: z.string().min(1),
  autoExtract: z.boolean(),
  taskId: z.string().nullable(),
  taskStatus: z.enum(['PENDING', 'RUNNING', 'SUCCESS', 'PARTIAL_SUCCESS', 'FAILED', 'CANCELLED']).nullable(),
  taskErrorCode: z.string().nullable(),
})

const capabilitySchema = z.object({
  type: z.enum(extractTypes),
  supported: z.boolean(),
})

const taskStatusSchema = z.enum(['PENDING', 'RUNNING', 'SUCCESS', 'PARTIAL_SUCCESS', 'FAILED', 'CANCELLED'])

const extractionStepSchema = z.object({
  type: z.enum(extractTypes),
  status: taskStatusSchema,
  progress: z.number().nullable(),
  stage: z.string().nullable(),
  assetCount: z.number().int().nonnegative().nullable(),
  errorCode: z.string().nullable(),
  sourceTaskId: z.string().nullable(),
})

const extractionTaskSchema = z.object({
  taskId: z.string().min(1),
  projectId: z.string().min(1),
  episodeId: z.string().min(1),
  status: taskStatusSchema,
  progress: z.number().nullable(),
  createdAt: z.string(),
  startedAt: z.string().nullable(),
  finishedAt: z.string().nullable(),
  steps: z.array(extractionStepSchema).nullable(),
})

const extractionTaskPageSchema = z.object({
  items: z.array(extractionTaskSchema),
  pageNum: z.number().int().positive(),
  pageSize: z.number().int().positive(),
  total: z.number().int().nonnegative(),
})

const gateway = axios.create({ baseURL: '/api', timeout: 15_000 })

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
      (authorization) => gateway.get('/media/extraction-capabilities', {
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

const stepDetail = (step: z.infer<typeof extractionStepSchema>) => {
  const parts = [taskStatusLabel(step.status)]
  if (step.stage) parts.push(step.stage)
  if (step.progress === 100) parts.push('100%')
  if (step.assetCount !== null) parts.push(`${step.assetCount} 条素材`)
  if (step.errorCode) parts.push(extractionFailureText(step.errorCode) ?? step.errorCode)
  return parts.join(' · ')
}

const toExtractionTask = (item: z.infer<typeof extractionTaskSchema>): ExtractionTask => {
  const steps = item.steps ?? []
  const failed = steps.find((step) => step.errorCode)
  return {
    id: item.taskId,
    projectId: item.projectId,
    projectName: `项目 ${item.projectId}`,
    episodeId: item.episodeId,
    episodeNumber: 0,
    episodeTitle: `剧集 ${item.episodeId}`,
    types: steps.map((step) => step.type),
    status: item.status,
    createdAt: item.createdAt,
    startedAt: item.startedAt,
    finishedAt: item.finishedAt,
    stageLabel: item.progress === 100 ? '已完成' : taskStatusLabel(item.status),
    errorMessage: failed?.errorCode ?? null,
    steps: steps.map((step) => ({ type: step.type, state: stepState(step.status), detail: stepDetail(step) })),
  }
}

export const loadExtractionBoard = async (signal?: AbortSignal) => {
  try {
    const result = await authorizedRequest(
      (authorization) => gateway.get('/ai/tasks', {
        signal,
        headers: { Authorization: authorization },
        params: { pageNum: 1, pageSize: 100 },
      }),
      extractionTaskPageSchema,
    )
    return {
      source: 'unified' as const,
      failedReads: 0,
      pendingEpisodes: [],
      tasks: result.data.items.map(toExtractionTask),
    }
  } catch (error) {
    if (!missingEndpoint(error)) throw error
    return loadLegacyBoard(signal)
  }
}

export const findExtractionTask = async (episodeId: string, type: ExtractType, signal?: AbortSignal) => {
  const result = await authorizedRequest(
    (authorization) => gateway.get('/ai/tasks', {
      signal,
      headers: { Authorization: authorization },
      params: { episodeId, pageNum: 1, pageSize: 20 },
    }),
    extractionTaskPageSchema,
  )
  for (const item of result.data.items.slice(0, 5)) {
    const detail = await getExtractionTask(item.taskId, signal)
    if (detail.types.includes(type)) return detail
  }
  return null
}

export const findShotTask = (episodeId: string, signal?: AbortSignal) =>
  findExtractionTask(episodeId, 'SHOT', signal)

export const getExtractionTask = async (taskId: string, signal?: AbortSignal) => {
  const result = await authorizedRequest(
    (authorization) => gateway.get(`/ai/tasks/${taskId}`, {
      signal,
      headers: { Authorization: authorization },
    }),
    extractionTaskSchema,
  )
  return toExtractionTask(result.data)
}

const createUnifiedTask = async (episodeId: string, types: ExtractType[]) => {
  const result = await authorizedRequest(
    (authorization) => gateway.post('/ai/tasks', {
      episodeId,
      extractTypes: types,
    }, { headers: { Authorization: authorization } }),
    extractionTaskSchema,
  )
  return result.data
}

export const createExtractionTask = async (projectId: string, episodeId: string, types: ExtractType[]) => {
  const requested = types.filter((type) => extractTypes.includes(type))
  if (requested.length === 0) throw new AuthError('请至少选择一种已支持的提取类型。', 400, 'INVALID_REQUEST')
  try {
    const created = await createUnifiedTask(episodeId, requested)
    const id = created.taskId
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
      (authorization) => gateway.post(`/ai/tasks/${task.id}/retry`, undefined, {
        headers: { Authorization: authorization },
      }),
      extractionTaskSchema,
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

const UPLOAD_TIMEOUT_MS = 330_000

const findUploadedEpisode = async (projectId: string, episodeId: string, signal?: AbortSignal) => {
  const first = await listEpisodes({ projectId, page: 1, size: 100 }, signal)
  const matched = first.items.find((item) => item.id === episodeId)
  if (matched || first.total <= first.items.length) return matched ?? null
  const lastPage = Math.max(1, Math.ceil(first.total / first.size))
  const last = await listEpisodes({ projectId, page: lastPage, size: first.size }, signal)
  return last.items.find((item) => item.id === episodeId) ?? null
}

export const extractionFailureText = (code: string | null) => {
  if (!code) return null
  if (code === 'EXTRACTION_TASK_CREATE_FAILED') return '视频已保存，提取任务没有建成。可以重试创建任务。'
  if (code === 'EPISODE_NUMBER_CONFLICT') return '这个集号已经被占用，请换一个集号。'
  if (code === 'EXTRACTION_TASK_CONFLICT') return '同一个上传键不能改成另一组提取参数。'
  if (code === 'EXTRACTION_UNSUPPORTED') return '所选提取类型当前不可用，请刷新能力后重选。'
  if (code === 'AUDIO_STREAM_NOT_FOUND') return '视频没有音轨。已成功的其他素材仍可查看。'
  if (code === 'SHOT_MANIFEST_INVALID') return '分镜清单校验失败，可以单独重试分镜。'
  if (code === 'SHOT_DETECTION_FAILED' || code === 'SHOT_PREVIEW_FAILED' || code === 'SHOT_WRITE_FAILED' || code === 'SHOT_EXTRACTION_TIMEOUT') {
    return '分镜处理失败，可以单独重试。'
  }
  if (code === 'DIALOGUE_MANIFEST_INVALID') return '对白清单校验失败，可以单独重试对白。'
  if (code === 'DIALOGUE_AUDIO_PREP_FAILED' || code === 'DIALOGUE_MODEL_UNAVAILABLE' || code === 'DIALOGUE_TRANSCRIPTION_FAILED' || code === 'DIALOGUE_EXTRACTION_TIMEOUT' || code === 'DIALOGUE_WRITE_FAILED') {
    return '对白处理失败，可以单独重试。'
  }
  if (code === 'BACKGROUND_MANIFEST_INVALID' || code === 'BACKGROUND_SHOT_MANIFEST_INVALID') return '背景清单校验失败，可以单独重试背景。'
  if (code === 'BACKGROUND_SHOTS_FAILED' || code === 'BACKGROUND_CANDIDATE_FAILED' || code === 'BACKGROUND_EXTRACTION_TIMEOUT' || code === 'BACKGROUND_WRITE_FAILED') {
    return '背景处理失败，可以单独重试。'
  }
  if (code === 'QUEUE_UNAVAILABLE' || code === 'PYTHON_TASK_LOST' || code === 'CHARACTER_TASK_TIMEOUT' || code === 'EXTRACTION_TASK_TIMEOUT') {
    return '任务已超过恢复期限，可以重试。'
  }
  return code
}

export const uploadAndExtract = async (input: {
  projectId: string
  episodeNumber: number
  file: File
  idempotencyKey: string
  autoExtract: boolean
  extractTypes: ExtractType[]
  onProgress: (ratio: number) => void
  signal?: AbortSignal
}): Promise<UploadExtractionResult> => {
  const body = new FormData()
  body.append('file', input.file)
  body.append('projectId', input.projectId)
  body.append('episodeNumber', String(input.episodeNumber))
  body.append('autoExtract', input.autoExtract ? 'true' : 'false')
  if (input.autoExtract) {
    for (const type of input.extractTypes) body.append('extractTypes', type)
  }
  let created = false
  try {
    const result = await authorizedRequest(
      (authorization) => gateway.post('/media/videos/upload', body, {
        signal: input.signal,
        timeout: UPLOAD_TIMEOUT_MS,
        maxBodyLength: Infinity,
        maxContentLength: Infinity,
        headers: { Authorization: authorization, 'Idempotency-Key': input.idempotencyKey },
        onUploadProgress: (event) => {
          const total = event.total ?? input.file.size
          if (total > 0) input.onProgress(Math.min(1, event.loaded / total))
        },
      }).then((response) => {
        created = response.status === 201
        return response
      }),
      uploadResultSchema,
    )
    const data = result.data
    const taskError = data.taskErrorCode
      ? new AuthError(extractionFailureText(data.taskErrorCode) ?? data.taskErrorCode, 200, data.taskErrorCode)
      : null
    return {
      episode: await findUploadedEpisode(input.projectId, data.episodeId, input.signal),
      episodeId: data.episodeId,
      created,
      autoExtract: data.autoExtract,
      taskId: data.taskId,
      taskStatus: data.taskStatus,
      taskError,
    }
  } catch (error) {
    if (!(error instanceof AuthError) || error.status !== 404) throw error
  }
  const uploaded = await uploadEpisode(input.projectId, input.file, input.idempotencyKey, input.onProgress, input.signal)
  if (!input.autoExtract) {
    return {
      episode: uploaded.episode,
      episodeId: uploaded.episode.id,
      created: uploaded.created,
      autoExtract: false,
      taskId: null,
      taskStatus: null,
      taskError: null,
    }
  }
  try {
    const task = await createExtractionTask(input.projectId, uploaded.episode.id, input.extractTypes)
    return {
      episode: uploaded.episode,
      episodeId: uploaded.episode.id,
      created: uploaded.created,
      autoExtract: true,
      taskId: task.id,
      taskStatus: 'PENDING',
      taskError: null,
    }
  } catch (error) {
    return {
      episode: uploaded.episode,
      episodeId: uploaded.episode.id,
      created: uploaded.created,
      autoExtract: true,
      taskId: null,
      taskStatus: 'FAILED',
      taskError: error,
    }
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

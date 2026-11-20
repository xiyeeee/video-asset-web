import axios from 'axios'
import { z } from 'zod'
import { AuthError, authorizedRequest } from '@/features/auth/auth-api'

const stageSchema = z.enum([
  'EXTRACTING_FRAMES',
  'DETECTING_CHARACTERS',
  'SEGMENTING_CHARACTERS',
  'WRITING_RESULTS',
])

const taskSchema = z.object({
  id: z.string().min(1),
  episodeId: z.string().min(1),
  status: z.enum(['PENDING', 'RUNNING', 'SUCCEEDED', 'FAILED']),
  stage: stageSchema.nullable(),
  progress: z.object({
    frameCount: z.number().int().nonnegative().nullable(),
    detectedCharacterCount: z.number().int().nonnegative().nullable(),
  }),
  assetCount: z.number().int().nonnegative().nullable(),
  errorCode: z.string().nullable(),
  createdAt: z.string(),
  finishedAt: z.string().nullable(),
})

const assetSchema = z.object({
  id: z.string().min(1),
  taskId: z.string().min(1),
  timestampMs: z.number().int().nonnegative(),
  sourceFrame: z.string(),
  frameCharacterNumber: z.number().int().positive(),
  sizeBytes: z.number().int().nonnegative(),
  url: z.string().url(),
  expiresInSeconds: z.number().positive(),
})

const assetPageSchema = z.object({
  items: z.array(assetSchema),
  page: z.number().int().positive(),
  size: z.number().int().positive(),
  total: z.number().int().nonnegative(),
})

export type CharacterTask = z.infer<typeof taskSchema>
export type CharacterStage = NonNullable<CharacterTask['stage']>
export type CharacterAsset = z.infer<typeof assetSchema>
export type CharacterAssetPage = z.infer<typeof assetPageSchema>

export const CHARACTER_PAGE_SIZE = 20

const http = axios.create({ baseURL: '/api/ai/v1', timeout: 15_000 })

const episodePath = (projectId: string, episodeId: string) => `/projects/${projectId}/episodes/${episodeId}`

export const characterTaskKey = (projectId: string, episodeId: string) =>
  ['character-task', projectId, episodeId] as const

export const characterAssetKey = (projectId: string, episodeId: string, page: number) =>
  ['character-assets', projectId, episodeId, page] as const

export const characterAssetPrefix = (projectId: string, episodeId: string) =>
  ['character-assets', projectId, episodeId] as const

const readTask = (projectId: string, episodeId: string, path: string, signal: AbortSignal | undefined) =>
  authorizedRequest(
    (authorization) => http.get(`${episodePath(projectId, episodeId)}${path}`, {
      signal,
      headers: { Authorization: authorization },
    }),
    taskSchema.nullable(),
  ).then((result) => result.data)

export const getLatestCharacterTask = (projectId: string, episodeId: string, signal?: AbortSignal) =>
  readTask(projectId, episodeId, '/character-extraction/tasks/latest', signal)

export const getCharacterTask = (projectId: string, episodeId: string, taskId: string, signal?: AbortSignal) =>
  authorizedRequest(
    (authorization) => http.get(`${episodePath(projectId, episodeId)}/character-extraction/tasks/${taskId}`, {
      signal,
      headers: { Authorization: authorization },
    }),
    taskSchema,
  ).then((result) => result.data)

const submitTask = (projectId: string, episodeId: string, path: string) =>
  authorizedRequest(
    (authorization) => http.post(`${episodePath(projectId, episodeId)}${path}`, undefined, {
      headers: { Authorization: authorization },
    }),
    taskSchema,
  ).then((result) => result.data)

export const startCharacterExtraction = (projectId: string, episodeId: string) =>
  submitTask(projectId, episodeId, '/character-extraction/tasks')

export const retryCharacterExtraction = (projectId: string, episodeId: string, taskId: string) =>
  submitTask(projectId, episodeId, `/character-extraction/tasks/${taskId}/retry`)

export const listCharacterAssets = (
  projectId: string,
  episodeId: string,
  page: number,
  size: number,
  signal?: AbortSignal,
) => authorizedRequest(
  (authorization) => http.get(`${episodePath(projectId, episodeId)}/character-assets`, {
    signal,
    params: { page, size },
    headers: { Authorization: authorization },
  }),
  assetPageSchema,
).then((result) => result.data)

const stageLabels: Record<CharacterStage, string> = {
  EXTRACTING_FRAMES: '抽帧',
  DETECTING_CHARACTERS: '检测人物',
  SEGMENTING_CHARACTERS: '人物分割',
  WRITING_RESULTS: '发布及导入结果',
}

export const characterStatusLabel = (task: CharacterTask) => {
  if (task.status === 'PENDING') return '排队中'
  if (task.status === 'RUNNING') return '处理中'
  if (task.status === 'FAILED') return '提取失败'
  if (task.assetCount === 0) return '此视频未检测到人物'
  return '提取成功'
}

export const characterProgressText = (task: CharacterTask) => {
  const parts: string[] = []
  if (task.stage) parts.push(stageLabels[task.stage])
  if (task.progress.frameCount !== null) parts.push(`已抽取 ${task.progress.frameCount} 帧`)
  if (task.progress.detectedCharacterCount !== null) parts.push(`已检测 ${task.progress.detectedCharacterCount} 个人物`)
  return parts.join(' · ')
}

export const characterErrorMessage = (error: unknown) => {
  if (!(error instanceof AuthError)) return '暂时无法完成操作，请稍后重试。'
  if (error.code === 'NOT_FOUND' || error.status === 404) return '项目、剧集、原视频或任务不可访问。'
  if (error.code === 'VIDEO_STORAGE_UNAVAILABLE') return '预览地址暂时无法签发，请稍后重试。'
  if (error.code === 'INVALID_REQUEST') return '请求不符合要求，请检查后重试。'
  if (error.code === 'UNAUTHENTICATED' || error.status === 401) return '登录已失效，请重新登录。'
  if (error.code === 'TIMEOUT') return '请求超时，可以重新查询或再次提交。'
  if (error.code === 'NETWORK_ERROR') return '网络请求失败，请检查连接后重试。'
  if (error.status === 503 || error.status >= 500) return '人物提取服务暂时不可用，请稍后重试。'
  return error.message || '暂时无法完成操作，请稍后重试。'
}

export const characterTaskErrorMessage = (code: string | null) => {
  if (code === 'PYTHON_TASK_LOST' || code === 'CHARACTER_TASK_TIMEOUT') {
    return '上游任务不可用或已超过处理期限，请重试。'
  }
  if (code === 'SOURCE_VIDEO_NOT_FOUND' || code === 'SOURCE_VIDEO_REF_INVALID' || code === 'SOURCE_SIZE_INVALID') {
    return '原视频已不可用或超过处理上限。'
  }
  if (code === 'CHARACTER_MODELS_UNAVAILABLE' || code === 'FRAME_EXTRACTION_FAILED' || code === 'FRAME_EXTRACTION_TIMEOUT') {
    return '模型无法加载或抽帧失败。'
  }
  if (
    code === 'CHARACTER_DETECTION_FAILED'
    || code === 'CHARACTER_SEGMENTATION_FAILED'
    || code === 'RESULT_WRITE_FAILED'
    || code === 'TASK_PROCESSING_FAILED'
  ) {
    return '人物提取处理失败，请重试。'
  }
  if (
    code === 'CHARACTER_MANIFEST_INVALID'
    || code === 'PYTHON_PROTOCOL_INVALID'
    || code === 'SHARED_INPUT_INVALID'
    || code === 'TASK_CONFLICT'
  ) {
    return '人物提取结果或共享目录异常，请重试。'
  }
  return '人物提取失败'
}

import axios from 'axios'
import { z } from 'zod'
import { AuthError, authorizedRequest } from '@/features/auth/auth-api'

const taskSchema = z.object({
  id: z.string().min(1),
  episodeId: z.string().min(1),
  status: z.enum(['PENDING', 'RUNNING', 'SUCCEEDED', 'FAILED']),
  attemptCount: z.number().int().nonnegative(),
  errorCode: z.string().nullable(),
  resultAssetId: z.string().nullable(),
  createdAt: z.string(),
  startedAt: z.string().nullable(),
  finishedAt: z.string().nullable(),
})

const frameSchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  type: z.literal('storyboard'),
  timestampMs: z.number().int().nonnegative(),
  sizeBytes: z.number().int().nonnegative(),
  url: z.string().url(),
  expiresInSeconds: z.number().positive(),
})

export type AnalysisTask = z.infer<typeof taskSchema>
export type FramePreview = z.infer<typeof frameSchema>

const http = axios.create({ baseURL: '/api/ai/v1', timeout: 15_000 })

const episodePath = (projectId: string, episodeId: string) => `/projects/${projectId}/episodes/${episodeId}`

export const analysisTaskKey = (projectId: string, episodeId: string) => ['analysis', projectId, episodeId] as const

export const frameListKey = (projectId: string, episodeId: string) => ['frames', projectId, episodeId] as const

export const getAnalysisTask = (projectId: string, episodeId: string, signal?: AbortSignal) =>
  authorizedRequest(
    (authorization) => http.get(`${episodePath(projectId, episodeId)}/analysis`, {
      signal,
      headers: { Authorization: authorization },
    }),
    taskSchema.nullable(),
  ).then((result) => result.data)

export const startAnalysis = (projectId: string, episodeId: string) =>
  authorizedRequest(
    (authorization) => http.post(`${episodePath(projectId, episodeId)}/analysis`, undefined, {
      headers: { Authorization: authorization },
    }),
    taskSchema,
  ).then((result) => result.data)

export const retryAnalysis = (projectId: string, episodeId: string, taskId: string) =>
  authorizedRequest(
    (authorization) => http.post(`${episodePath(projectId, episodeId)}/analysis/${taskId}/retry`, undefined, {
      headers: { Authorization: authorization },
    }),
    taskSchema,
  ).then((result) => result.data)

export const listFrames = (projectId: string, episodeId: string, signal?: AbortSignal) =>
  authorizedRequest(
    (authorization) => http.get(`${episodePath(projectId, episodeId)}/frames`, {
      signal,
      headers: { Authorization: authorization },
    }),
    z.array(frameSchema),
  ).then((result) => result.data)

export const analysisErrorMessage = (error: unknown) => {
  if (!(error instanceof AuthError)) return '暂时无法完成操作，请稍后重试。'
  if (error.code === 'NOT_FOUND' || error.status === 404) return '项目或集数不可访问。'
  if (error.code === 'VIDEO_STORAGE_UNAVAILABLE') return '预览地址暂时无法签发，请稍后重试。'
  if (error.code === 'INVALID_REQUEST') return '请求不符合要求，请检查后重试。'
  if (error.code === 'UNAUTHENTICATED' || error.status === 401) return '登录已失效，请重新登录。'
  if (error.code === 'TIMEOUT') return '请求超时，可以重新查询或再次提交。'
  if (error.code === 'NETWORK_ERROR') return '网络请求失败，请检查连接后重试。'
  if (error.status === 503 || error.status >= 500) return '解析服务暂时不可用，请稍后重试。'
  return error.message || '暂时无法完成操作，请稍后重试。'
}

export const taskErrorMessage = (code: string | null) => {
  if (code === 'QUEUE_UNAVAILABLE' || code === 'FFMPEG_UNAVAILABLE' || code === 'WORKSPACE_UNAVAILABLE') {
    return '解析服务暂不可用，请稍后重试。'
  }
  if (code === 'SOURCE_NOT_FOUND' || code === 'SOURCE_SIZE_INVALID') {
    return '原视频不可用或超出解析上限，请检查上传文件。'
  }
  if (code === 'FRAME_PROCESS_FAILED') return '无法从该视频提取首帧，请检查视频能否正常播放。'
  if (code === 'FRAME_PROCESS_TIMEOUT' || code === 'TASK_TIMEOUT') return '解析超时，请重试。'
  return '解析失败，请稍后重试。'
}

export const analysisStatusLabel = (status: AnalysisTask['status']) => {
  if (status === 'PENDING') return '等待解析'
  if (status === 'RUNNING') return '正在提取首帧'
  if (status === 'SUCCEEDED') return '首帧已提取'
  return '解析失败'
}

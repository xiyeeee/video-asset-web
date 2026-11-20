import axios from 'axios'
import { z } from 'zod'
import { AuthError, authorizedRequest } from '@/features/auth/auth-api'

const episodeSchema = z.object({
  id: z.string().min(1),
  projectId: z.string().min(1),
  episodeNumber: z.number().int().positive(),
  title: z.string(),
  status: z.string(),
  originalFilename: z.string(),
  contentType: z.string(),
  sizeBytes: z.number().int().nonnegative(),
  durationMs: z.number().int().nonnegative().nullable(),
  uploadedAt: z.string(),
})

const episodePageSchema = z.object({
  items: z.array(episodeSchema),
  page: z.number().int().positive(),
  size: z.number().int().positive(),
  total: z.number().int().nonnegative(),
})

const playbackSchema = z.object({
  url: z.string().url(),
  expiresInSeconds: z.number().positive(),
})

export type EpisodeSummary = z.infer<typeof episodeSchema>
export type EpisodePage = z.infer<typeof episodePageSchema>
export type EpisodePlayback = z.infer<typeof playbackSchema>

export type EpisodeQuery = {
  projectId: string
  page: number
  size: number
}

export const EPISODE_PAGE_SIZE = 20
export const MAX_VIDEO_BYTES = 100 * 1024 * 1024
const UPLOAD_TIMEOUT_MS = 330_000

const http = axios.create({ baseURL: '/api/media/v1', timeout: 15_000 })

export const episodeListPrefix = (projectId: string) => ['episodes', projectId] as const

export const episodeQueryKey = (query: EpisodeQuery) => ['episodes', query.projectId, query] as const

export const episodePlaybackKey = (projectId: string, episodeId: string) =>
  ['episode-playback', projectId, episodeId] as const

export const listEpisodes = (query: EpisodeQuery, signal?: AbortSignal) =>
  authorizedRequest(
    (authorization) => http.get(`/projects/${query.projectId}/episodes`, {
      signal,
      headers: { Authorization: authorization },
      params: { page: query.page, size: query.size },
    }),
    episodePageSchema,
  ).then((result) => result.data)

export const getEpisodePlayback = (projectId: string, episodeId: string, signal?: AbortSignal) =>
  authorizedRequest(
    (authorization) => http.get(`/projects/${projectId}/episodes/${episodeId}/playback`, {
      signal,
      headers: { Authorization: authorization },
    }),
    playbackSchema,
  ).then((result) => result.data)

export const uploadEpisode = async (
  projectId: string,
  file: File,
  idempotencyKey: string,
  onProgress: (ratio: number) => void,
  signal?: AbortSignal,
) => {
  let created = false
  const body = new FormData()
  body.append('file', file)
  const result = await authorizedRequest(
    (authorization) => http.post(`/projects/${projectId}/episodes`, body, {
      signal,
      timeout: UPLOAD_TIMEOUT_MS,
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
      headers: {
        Authorization: authorization,
        'Idempotency-Key': idempotencyKey,
      },
      onUploadProgress: (event) => {
        const total = event.total ?? file.size
        if (total > 0) onProgress(Math.min(1, event.loaded / total))
      },
    }).then((response) => {
      created = response.status === 201
      return response
    }),
    episodeSchema,
  )
  return { episode: result.data, created }
}

export const episodeErrorMessage = (error: unknown) => {
  if (!(error instanceof AuthError)) return '暂时无法完成操作，请稍后重试。'
  if (error.code === 'INVALID_VIDEO') return '请检查文件是否为 MP4。'
  if (error.code === 'VIDEO_TOO_LARGE' || error.status === 413) return '文件超过大小限制，单个视频不能超过 100 MiB。'
  if (error.code === 'EPISODE_NUMBER_CONFLICT') return '这个集号已经被占用，请换一个集号。'
  if (error.code === 'EXTRACTION_TASK_CONFLICT') return '同一个上传键不能改成另一组提取参数，请重新选择文件。'
  if (error.code === 'VIDEO_UPLOAD_CONFLICT' || error.status === 409) return '这个上传键已经对应另一份文件，请重新选择后再上传。'
  if (error.code === 'NOT_FOUND' || error.status === 404) return '项目或集数不可访问。'
  if (error.code === 'VIDEO_STORAGE_UNAVAILABLE' || error.status === 503) return '视频存储暂时不可用，请使用原文件重试。'
  if (error.code === 'INTERNAL_ERROR' || error.status >= 500) return '保存结果未知，请使用原文件重试。'
  if (error.code === 'INVALID_REQUEST') return '提交的内容不符合要求，请检查后重试。'
  if (error.code === 'UNAUTHENTICATED' || error.status === 401) return '登录已失效，请重新登录。'
  if (error.code === 'TIMEOUT' || error.code === 'NETWORK_ERROR') return '上传未完成，请使用原文件重试。'
  return error.message || '暂时无法完成操作，请稍后重试。'
}

export const canRetryEpisodeUpload = (error: unknown) => {
  if (!(error instanceof AuthError)) return false
  if (error.code === 'ABORTED' || error.code === 'UNAUTHENTICATED' || error.status === 401) return false
  if (error.code === 'INVALID_VIDEO' || error.code === 'INVALID_REQUEST' || error.code === 'VIDEO_TOO_LARGE') return false
  if (error.code === 'VIDEO_UPLOAD_CONFLICT' || error.status === 409 || error.status === 413 || error.status === 404) return false
  return error.code === 'VIDEO_STORAGE_UNAVAILABLE'
    || error.code === 'INTERNAL_ERROR'
    || error.code === 'TIMEOUT'
    || error.code === 'NETWORK_ERROR'
    || error.status >= 500
    || error.status === 0
}

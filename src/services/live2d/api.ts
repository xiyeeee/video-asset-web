import axios from 'axios'
import { z } from 'zod'
import { AuthError, authorizedRequest } from '@/features/auth/auth-api'
import { useSession } from '@/features/auth/session'
import {
  live2dStatuses,
  modelRequestNeedsAuth,
  type Live2dLibraryCharacter,
  type Live2dLibraryVersion,
  type Live2dStatus,
  type Live2dTaskBody,
} from './contract'

const stageSchema = z.string().min(1).nullable()

const resultSchema = z.object({
  modelId: z.string().min(1),
  modelEntryUrl: z.string().min(1),
}).nullable()

const errorSchema = z.object({
  code: z.string().min(1),
  message: z.string(),
  stage: z.string().nullable(),
}).nullable()

const taskSchema = z.object({
  taskId: z.string().min(1),
  status: z.enum(live2dStatuses),
  stage: stageSchema,
  result: resultSchema,
  error: errorSchema,
})

const uploadSchema = z.object({
  uploadFileId: z.string().min(1),
})

export type Live2dTask = {
  taskId: string
  status: Live2dStatus
  stage: string | null
  result: { modelId: string; modelEntryUrl: string } | null
  error: { code: string; message: string; stage: string | null } | null
}

const gateway = axios.create({ baseURL: '/api', timeout: 15_000 })

const live2dProjectPath = (projectId: string) => `/projects/${encodeURIComponent(projectId)}`

export const uploadLive2dImage = (projectId: string, file: File, signal?: AbortSignal) => {
  const body = new FormData()
  body.append('file', file)
  return authorizedRequest(
    (authorization) => gateway.post(`${live2dProjectPath(projectId)}/files`, body, {
      signal,
      timeout: 120_000,
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
      headers: { Authorization: authorization },
    }),
    uploadSchema,
  ).then((result) => result.data.uploadFileId)
}

export const createLive2dTask = ({ projectId, ...body }: Live2dTaskBody, signal?: AbortSignal) =>
  authorizedRequest(
    (authorization) => gateway.post(`${live2dProjectPath(projectId)}/live2d/tasks`, body, {
      signal,
      headers: { Authorization: authorization },
    }),
    taskSchema,
  ).then((result) => result.data)

export const parseLive2dTask = (value: unknown) => {
  const parsed = taskSchema.safeParse(value)
  return parsed.success ? parsed.data : null
}

const characterSchema = z.object({
  characterId: z.string().min(1),
  name: z.string().min(1),
  avatarUrl: z.string().min(1).nullable(),
  modelIds: z.array(z.string().min(1)),
})

const versionSchema = z.object({
  versionId: z.string().min(1),
  modelId: z.string().min(1),
  versionNumber: z.number().int().positive(),
  name: z.string().min(1).nullable(),
  thumbnailUrl: z.string().min(1).nullable(),
  savedAt: z.string().min(1),
})

const versionDetailSchema = versionSchema.extend({
  characterId: z.string().min(1),
  modelEntryUrl: z.string().min(1),
  packageUrl: z.string().min(1),
})

const characterListSchema = z.object({ items: z.array(characterSchema) })
const versionListSchema = z.object({ items: z.array(versionSchema) })

export type Live2dVersionDetail = Live2dLibraryVersion & {
  characterId: string
  modelEntryUrl: string
  packageUrl: string
}

export const listLive2dCharacters = (projectId: string, signal?: AbortSignal) =>
  authorizedRequest(
    (authorization) => gateway.get(`${live2dProjectPath(projectId)}/live2d/characters`, {
      signal,
      headers: { Authorization: authorization },
    }),
    characterListSchema,
  ).then((result) => result.data.items satisfies Live2dLibraryCharacter[])

export const listLive2dVersions = (projectId: string, characterId: string, signal?: AbortSignal) =>
  authorizedRequest(
    (authorization) => gateway.get(
      `${live2dProjectPath(projectId)}/live2d/characters/${encodeURIComponent(characterId)}/versions`,
      { signal, headers: { Authorization: authorization } },
    ),
    versionListSchema,
  ).then((result) => result.data.items satisfies Live2dLibraryVersion[])

export const getLive2dVersion = (projectId: string, versionId: string, signal?: AbortSignal) =>
  authorizedRequest(
    (authorization) => gateway.get(
      `${live2dProjectPath(projectId)}/live2d/versions/${encodeURIComponent(versionId)}`,
      { signal, headers: { Authorization: authorization } },
    ),
    versionDetailSchema,
  ).then((result) => result.data satisfies Live2dVersionDetail)

const apiPath = (url: string) => {
  const resource = new URL(url, window.location.origin)
  if (resource.origin !== window.location.origin) return null
  const path = `${resource.pathname}${resource.search}`
  return path.startsWith('/api/') ? path.slice(4) : path
}

export const fetchLive2dPackage = async (url: string, signal: AbortSignal) => {
  const path = apiPath(url)
  const needsAuth = modelRequestNeedsAuth(url, window.location.origin)
  try {
    if (path === null) {
      const response = await fetch(url, { signal })
      if (!response.ok) throw new AuthError('模型包下载失败', response.status, 'UNKNOWN')
      return await response.blob()
    }
    const token = useSession.getState().token
    if (needsAuth && !token) throw new AuthError('请先登录', 401, 'UNAUTHENTICATED')
    const response = await gateway.get<Blob>(path, {
      signal,
      responseType: 'blob',
      timeout: 120_000,
      headers: needsAuth && token ? { Authorization: `Bearer ${token}` } : {},
    })
    return response.data
  } catch (error) {
    if (error instanceof AuthError) throw error
    if (axios.isAxiosError(error)) {
      const status = error.response?.status ?? 0
      if (status === 401) useSession.getState().expire(useSession.getState().revision)
      throw new AuthError(status === 404 ? '模型包不存在或已过期' : '模型包下载失败', status, status === 404 ? 'NOT_FOUND' : 'UNKNOWN')
    }
    throw new AuthError('模型包下载失败', 0, 'NETWORK_ERROR')
  }
}

export const getLive2dTask = (projectId: string, taskId: string, signal?: AbortSignal) =>
  authorizedRequest(
    (authorization) => gateway.get(`${live2dProjectPath(projectId)}/live2d/tasks/${encodeURIComponent(taskId)}`, {
      signal,
      headers: { Authorization: authorization },
    }),
    taskSchema,
  ).then((result) => result.data)

const failureText: Record<string, string> = {
  SOURCE_IMAGE_INVALID: '原图无法识别，请换一张 PNG、JPEG 或 WebP。',
  SOURCE_IMAGE_NOT_FOUND: '原图已经不存在，请重新选择。',
  SOURCE_IMAGE_REF_INVALID: '原图位置无效，请重新上传。',
  IMAGE_DECODER_UNAVAILABLE: '图片解码不可用，请稍后重试。',
  CONVERTER_UNAVAILABLE: '图片转 Live2D 转换器尚未配置。',
  CONVERTER_TIMEOUT: '生成超时，请稍后重试。',
  CONVERSION_FAILED: '生成模型失败，请更换图片或稍后重试。',
  RUNTIME_NOT_EXPORTED: '模型导出不完整，请重试。',
  RUNTIME_INVALID: '导出的模型无法通过校验。',
  CUBISM_CORE_UNAVAILABLE: '服务端缺少 Live2D 核心库，暂时不能校验模型。',
  MOC3_VALIDATION_FAILED: '模型网格校验失败。',
  ARTIFACT_WRITE_FAILED: '模型文件没有保存成功，请重试。',
  LIVE2D_TASK_FAILED: 'Live2D 生成失败，请重试。',
  TASK_CONFLICT: '这个任务和已有参数冲突，请重新提交。',
  TASK_NOT_FOUND: '没有找到这个生成任务。',
  REQUEST_INVALID: '提交内容不符合要求，请检查模型名称和图片。',
}

export const live2dFailureText = (code: string | null, fallback: string) => {
  if (!code) return fallback || 'Live2D 生成失败。'
  return failureText[code] ?? (fallback || 'Live2D 生成失败。')
}

export const live2dErrorMessage = (error: unknown) => {
  if (!(error instanceof AuthError)) return '暂时无法完成操作，请稍后重试。'
  if (error.code === 'ABORTED') return ''
  if (error.code === 'TIMEOUT') return '请求超时，可以稍后查询或重新提交。'
  if (error.code === 'NETWORK_ERROR') return '网络请求失败，请检查连接后重试。'
  if (error.code === 'UNAUTHENTICATED' || error.status === 401) return '登录已失效，请重新登录。'
  if (error.status === 404 || error.code === 'NOT_FOUND' || error.code === 'TASK_NOT_FOUND') {
    return '找不到当前项目中的资源或任务。'
  }
  if (error.status === 413) return '图片不能超过 10 MiB。'
  if (error.status === 409 || error.code === 'TASK_CONFLICT') return failureText.TASK_CONFLICT
  if (error.code === 'INVALID_REQUEST' || error.code === 'REQUEST_INVALID') return failureText.REQUEST_INVALID
  if (failureText[error.code]) return failureText[error.code]
  if (error.status >= 500) return 'Live2D 服务暂时不可用，请稍后重试。'
  return error.message || '暂时无法完成操作，请稍后重试。'
}

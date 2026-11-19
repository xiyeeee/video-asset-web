import axios from 'axios'
import { z } from 'zod'
import { AuthError, authorizedRequest } from '@/features/auth/auth-api'

const projectSchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  description: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
})

const projectPageSchema = z.object({
  items: z.array(projectSchema),
  page: z.number().int().positive(),
  size: z.number().int().positive(),
  total: z.number().int().nonnegative(),
})

export type ProjectSummary = z.infer<typeof projectSchema>
export type ProjectPage = z.infer<typeof projectPageSchema>

export type ProjectQuery = {
  q: string
  page: number
  size: number
}

export type ProjectInput = {
  name: string
  description: string
}

export type ProjectPatch = {
  name?: string
  description?: string
}

const http = axios.create({ baseURL: '/api/media/v1', timeout: 15_000 })

export const projectListKey = ['projects'] as const

export const projectQueryKey = (query: ProjectQuery) => ['projects', query] as const

export const projectDetailKey = (projectId: string) => ['project', projectId] as const

export const listProjects = (query: ProjectQuery) =>
  authorizedRequest(
    (authorization) => http.get('/projects', {
      headers: { Authorization: authorization },
      params: { q: query.q, page: query.page, size: query.size },
    }),
    projectPageSchema,
  ).then((result) => result.data)

export const getProject = (projectId: string) =>
  authorizedRequest(
    (authorization) => http.get(`/projects/${projectId}`, { headers: { Authorization: authorization } }),
    projectSchema,
  ).then((result) => result.data)

export const createProject = (input: ProjectInput) =>
  authorizedRequest(
    (authorization) => http.post('/projects', input, { headers: { Authorization: authorization } }),
    projectSchema,
  ).then((result) => result.data)

export const updateProject = (projectId: string, patch: ProjectPatch) =>
  authorizedRequest(
    (authorization) => http.patch(`/projects/${projectId}`, patch, { headers: { Authorization: authorization } }),
    projectSchema,
  ).then((result) => result.data)

export const projectErrorMessage = (error: unknown) => {
  if (!(error instanceof AuthError)) return '暂时无法完成操作，请稍后重试。'
  if (error.code === 'INVALID_REQUEST') return '提交的信息不符合要求，请检查后重试。'
  if (error.code === 'NOT_FOUND') return '项目不可访问或已不存在。'
  if (error.code === 'UNAUTHENTICATED' || error.status === 401) return '登录已失效，请重新登录。'
  if (error.code === 'TIMEOUT' || error.code === 'NETWORK_ERROR') return '暂时无法连接服务，请检查网络后重试。'
  if (error.status >= 500) return '服务暂时不可用，请稍后重试。'
  return error.message || '暂时无法完成操作，请稍后重试。'
}

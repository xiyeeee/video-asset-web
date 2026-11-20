import axios from 'axios'
import { z } from 'zod'
import { AuthError, authorizedRequest } from '@/features/auth/auth-api'
import { classifyShots, type FormalShot, type ShotCandidate } from '@/features/shots/timeline'

const assetStatusSchema = z.enum(['NOT_STARTED', 'UNSUPPORTED', 'PENDING', 'RUNNING', 'SUCCESS', 'FAILED'])

const detailsSchema = z.object({
  shotId: z.string().nullable().optional(),
  shotIndex: z.number().int().nullable().optional(),
  startMs: z.number().int().nullable().optional(),
  endMs: z.number().int().nullable().optional(),
  previewTimestampMs: z.number().int().nullable().optional(),
  frameUrl: z.string().nullable().optional(),
})

const assetSchema = z.object({
  projectId: z.string(),
  episodeId: z.string(),
  assetId: z.string().min(1),
  assetType: z.string(),
  createdAt: z.string(),
  sourceTaskId: z.string().nullable(),
  sizeBytes: z.number().int().nonnegative(),
  expiresInSeconds: z.number().int().positive(),
  details: detailsSchema,
})

const pageSchema = z.object({
  items: z.array(assetSchema),
  pageNum: z.number().int().positive(),
  pageSize: z.number().int().positive(),
  total: z.number().int().nonnegative(),
  status: assetStatusSchema,
})

export type ShotAssetStatus = z.infer<typeof assetStatusSchema>

export type ShotLibrary = {
  status: ShotAssetStatus
  formal: FormalShot[]
  rejected: number
  expiresInSeconds: number | null
}

const http = axios.create({ timeout: 15_000 })
const PAGE_SIZE = 20

export const shotAssetKey = (episodeId: string) => ['shot-assets', episodeId] as const

const readPage = (episodeId: string, pageNum: number, sourceTaskId: string | undefined, signal?: AbortSignal) =>
  authorizedRequest(
    (authorization) => http.get(`/api/media/episodes/${episodeId}/assets`, {
      signal,
      headers: { Authorization: authorization },
      params: {
        type: 'SHOT',
        pageNum,
        pageSize: PAGE_SIZE,
        ...(sourceTaskId ? { sourceTaskId } : {}),
      },
    }),
    pageSchema,
  ).then((result) => result.data)

const toCandidate = (item: z.infer<typeof assetSchema>): ShotCandidate => ({
  assetId: item.assetId,
  assetType: item.assetType,
  sourceTaskId: item.sourceTaskId,
  sizeBytes: item.sizeBytes,
  expiresInSeconds: item.expiresInSeconds,
  details: item.details,
})

export const listEpisodeShots = async (episodeId: string, signal?: AbortSignal): Promise<ShotLibrary> => {
  const first = await readPage(episodeId, 1, undefined, signal)
  const firstFormal = classifyShots(first.items.map(toCandidate)).formal
  const sourceTaskId = firstFormal[0]?.sourceTaskId
  let items = first.items
  if (sourceTaskId && first.total > items.length) {
    const pageCount = Math.ceil(first.total / first.pageSize)
    for (let pageNum = 2; pageNum <= pageCount; pageNum += 1) {
      const next = await readPage(episodeId, pageNum, sourceTaskId, signal)
      items = items.concat(next.items)
    }
  }
  const classified = classifyShots(items.map(toCandidate)).formal.filter((shot) =>
    sourceTaskId ? shot.sourceTaskId === sourceTaskId : true)
  const rejected = items.length - classified.length
  return {
    status: first.status,
    formal: classified,
    rejected,
    expiresInSeconds: classified[0]?.expiresInSeconds ?? items[0]?.expiresInSeconds ?? null,
  }
}

export const shotErrorMessage = (error: unknown) => {
  if (!(error instanceof AuthError)) return '暂时无法读取分镜，请稍后重试。'
  if (error.code === 'ABORTED') return '请求已取消'
  if (error.code === 'TIMEOUT') return '请求超时，请重试。'
  if (error.code === 'NETWORK_ERROR') return '网络请求失败，请检查连接后重试。'
  if (error.code === 'EXTRACTION_UNSUPPORTED' || error.status === 422) return '当前环境还不能提取分镜。'
  if (error.code === 'NOT_FOUND' || error.status === 404) return '分镜接口或这一集不存在。'
  if (error.status === 401) return '登录已失效，请重新登录。'
  if (error.status >= 500) return '分镜服务暂时不可用，请稍后重试。'
  return error.message || '暂时无法完成操作，请稍后重试。'
}

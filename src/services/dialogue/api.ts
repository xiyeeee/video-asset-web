import axios from 'axios'
import { z } from 'zod'
import { classifyDialogue, sameVersion, type DialogueCandidate, type DialogueLine } from '@/features/dialogue/timeline'
import { AuthError, authorizedRequest } from '@/features/auth/auth-api'

const assetStatusSchema = z.enum(['NOT_STARTED', 'UNSUPPORTED', 'PENDING', 'RUNNING', 'SUCCESS', 'FAILED'])

const assetSchema = z.object({
  assetId: z.string().min(1),
  assetType: z.string(),
  sourceTaskId: z.string().nullable(),
  details: z.object({
    segmentIndex: z.number().int().nullable().optional(),
    startMs: z.number().int().nullable().optional(),
    endMs: z.number().int().nullable().optional(),
    text: z.string().nullable().optional(),
    speakerId: z.string().nullable().optional(),
    characterId: z.string().nullable().optional(),
  }),
})

const pageSchema = z.object({
  items: z.array(assetSchema),
  pageNum: z.number().int().positive(),
  pageSize: z.number().int().positive(),
  total: z.number().int().nonnegative(),
  status: assetStatusSchema,
})

export type DialogueAssetStatus = z.infer<typeof assetStatusSchema>

export type DialogueLibrary = {
  status: DialogueAssetStatus
  lines: DialogueLine[]
  rejected: number
}

const http = axios.create({ timeout: 15_000 })
const PAGE_SIZE = 20

export const dialogueAssetKey = (episodeId: string) => ['dialogue-assets', episodeId] as const

const readPage = (episodeId: string, pageNum: number, sourceTaskId: string | undefined, signal?: AbortSignal) =>
  authorizedRequest(
    (authorization) => http.get(`/api/media/episodes/${episodeId}/assets`, {
      signal,
      headers: { Authorization: authorization },
      params: {
        type: 'DIALOGUE',
        pageNum,
        pageSize: PAGE_SIZE,
        ...(sourceTaskId ? { sourceTaskId } : {}),
      },
    }),
    pageSchema,
  ).then((result) => result.data)

const toCandidate = (item: z.infer<typeof assetSchema>): DialogueCandidate => ({
  assetId: item.assetId,
  assetType: item.assetType,
  sourceTaskId: item.sourceTaskId,
  details: item.details,
})

export const listEpisodeDialogue = async (episodeId: string, signal?: AbortSignal): Promise<DialogueLibrary> => {
  const first = await readPage(episodeId, 1, undefined, signal)
  const firstLines = classifyDialogue(first.items.map(toCandidate))
  const sourceTaskId = firstLines[0]?.sourceTaskId
  let items = first.items
  if (sourceTaskId && first.total > items.length) {
    const pageCount = Math.ceil(first.total / first.pageSize)
    for (let pageNum = 2; pageNum <= pageCount; pageNum += 1) {
      const next = await readPage(episodeId, pageNum, sourceTaskId, signal)
      items = items.concat(next.items)
    }
  }
  const parsed = classifyDialogue(items.map(toCandidate))
  const lines = sameVersion(parsed, sourceTaskId)
  return {
    status: first.status,
    lines,
    rejected: items.filter((item) => item.assetType === 'DIALOGUE').length - lines.length,
  }
}

export const dialogueErrorMessage = (error: unknown) => {
  if (!(error instanceof AuthError)) return '暂时无法读取对话，请稍后重试。'
  if (error.code === 'ABORTED') return '请求已取消'
  if (error.code === 'TIMEOUT') return '请求超时，请重试。'
  if (error.code === 'NETWORK_ERROR') return '网络请求失败，请检查连接后重试。'
  if (error.code === 'EXTRACTION_UNSUPPORTED' || error.status === 422) return '当前环境还不能提取对话。'
  if (error.code === 'NOT_FOUND' || error.status === 404) return '对话接口或这一集不存在。'
  if (error.status === 401) return '登录已失效，请重新登录。'
  if (error.status >= 500) return '对话服务暂时不可用，请稍后重试。'
  return error.message || '暂时无法完成操作，请稍后重试。'
}

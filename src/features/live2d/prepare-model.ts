import { z } from 'zod'
import { useSession } from '@/features/auth/session'
import {
  indexModelDirectory,
  modelRequestNeedsAuth,
  resolveModelReference,
  rewriteModelFiles,
  safeModelReference,
  type ModelSettingsJson,
} from '@/services/live2d/contract'

const fileReferenceSchema = z.string().min(1)

const settingsSchema = z.object({
  Version: z.number(),
  FileReferences: z.object({
    Moc: fileReferenceSchema,
    Textures: z.array(fileReferenceSchema).min(1),
    Physics: fileReferenceSchema.optional(),
    Pose: fileReferenceSchema.optional(),
    UserData: fileReferenceSchema.optional(),
    DisplayInfo: fileReferenceSchema.optional(),
    Expressions: z.array(z.object({ Name: z.string().optional(), File: fileReferenceSchema }).passthrough()).optional(),
    Motions: z.record(z.string(), z.array(z.object({ File: fileReferenceSchema }).passthrough())).optional(),
  }).passthrough(),
}).passthrough()

const readSettings = (payload: unknown): ModelSettingsJson => {
  const parsed = settingsSchema.safeParse(payload)
  if (!parsed.success) throw new Error('模型描述不是可用的 .model3.json。')
  return parsed.data
}

const collectReferences = (model: ModelSettingsJson) => {
  const files = model.FileReferences
  const references = [files.Moc, ...files.Textures]
  if (files.Physics) references.push(files.Physics)
  if (files.Pose) references.push(files.Pose)
  if (files.UserData) references.push(files.UserData)
  if (files.DisplayInfo) references.push(files.DisplayInfo)
  for (const expression of files.Expressions ?? []) references.push(expression.File)
  for (const motions of Object.values(files.Motions ?? {})) {
    for (const motion of motions) references.push(motion.File)
  }
  return references
}

const fetchBytes = async (url: string, signal: AbortSignal) => {
  const headers = new Headers()
  const token = useSession.getState().token
  if (token && modelRequestNeedsAuth(url, window.location.origin)) {
    headers.set('Authorization', `Bearer ${token}`)
  }
  const response = await fetch(url, { headers, signal, credentials: 'same-origin' })
  if (!response.ok) throw new Error(`模型文件加载失败（${response.status}）。`)
  return response.blob()
}

const remember = (blob: Blob, urls: string[]) => {
  const url = URL.createObjectURL(blob)
  urls.push(url)
  return url
}

/** 把入口和相对引用都读成本地地址后再交给播放器，避免签名地址和业务登录态混在一次请求里。 */
export const prepareRemoteModel = async (entryUrl: string, signal: AbortSignal) => {
  const settings = readSettings(JSON.parse(await (await fetchBytes(entryUrl, signal)).text()) as unknown)
  const urls: string[] = []
  const local = new Map<string, string>()
  for (const reference of collectReferences(settings)) {
    const safe = safeModelReference(reference)
    if (local.has(safe)) continue
    const blob = await fetchBytes(resolveModelReference(entryUrl, safe), signal)
    local.set(safe, remember(blob, urls))
  }
  const json = rewriteModelFiles(settings, (reference) => {
    const cached = local.get(safeModelReference(reference))
    if (!cached) throw new Error(`模型缺少文件 ${reference}。`)
    return cached
  })
  json.url = remember(new Blob([JSON.stringify(json)], { type: 'application/json' }), urls)
  return { json, blobUrls: urls }
}

export const prepareDirectoryModel = async (files: readonly File[]) => {
  const indexed = indexModelDirectory(files)
  const entry = indexed.files.get(indexed.entryName)
  if (!entry) throw new Error('所选目录里没有 .model3.json。')
  const settings = readSettings(JSON.parse(await entry.text()) as unknown)
  const urls: string[] = []
  const json = rewriteModelFiles(settings, (reference) => {
    const safe = safeModelReference(reference)
    const file = indexed.files.get(safe)
    if (!file) throw new Error(`模型缺少文件 ${safe}。`)
    return remember(file, urls)
  })
  json.url = remember(new Blob([JSON.stringify(json)], { type: 'application/json' }), urls)
  return { json, blobUrls: urls }
}

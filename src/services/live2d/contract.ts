/** Live2D 任务契约。页面只提交一个图片来源，并在任务终态后关闭状态连接。 */

export const live2dStatuses = ['QUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED'] as const

export type Live2dStatus = (typeof live2dStatuses)[number]

export const LIVE2D_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp'] as const

export const MAX_LIVE2D_IMAGE_BYTES = 10 * 1024 * 1024

export const SAMPLE_MODEL_URL = '/live2d/samples/model/model.model3.json'

export const live2dEventsPath = (projectId: string, taskId: string) =>
  `/api/projects/${encodeURIComponent(projectId)}/live2d/tasks/${encodeURIComponent(taskId)}/events`

const stageLabels: Record<string, string> = {
  PREPARING: '准备原图',
  GENERATING: '生成模型',
  VALIDATING: '校验模型',
  EXPORTING: '发布模型',
}

const statusLabels: Record<Live2dStatus, string> = {
  QUEUED: '排队中',
  RUNNING: '生成中',
  SUCCEEDED: '生成成功',
  FAILED: '生成失败',
}

export type Live2dSource =
  | { uploadFileId: string }
  | { sourceAssetId: string }

export type Live2dTaskBody = {
  projectId: string
  modelName: string
  uploadFileId?: string
  sourceAssetId?: string
}

export type ModelFileReferences = {
  Moc: string
  Textures: string[]
  Physics?: string
  Pose?: string
  UserData?: string
  DisplayInfo?: string
  Expressions?: { Name?: string; File: string }[]
  Motions?: Record<string, { File: string }[]>
}

export type ModelSettingsJson = {
  Version: number
  FileReferences: ModelFileReferences
  url?: string
}

export type MotionTestId = 'blink' | 'mouth' | 'head'

export type MotionTest = {
  id: MotionTestId
  label: string
  parameters: string[]
}

const motionCatalog: { id: MotionTestId; label: string; parameters: string[] }[] = [
  { id: 'blink', label: '眨眼', parameters: ['ParamEyeLOpen', 'ParamEyeROpen'] },
  { id: 'mouth', label: '张嘴', parameters: ['ParamMouthOpenY'] },
  { id: 'head', label: '转头', parameters: ['ParamAngleX'] },
]

export const isLive2dSettled = (status: Live2dStatus) => status === 'SUCCEEDED' || status === 'FAILED'

export const live2dStatusLabel = (status: Live2dStatus) => statusLabels[status]

export const live2dStageLabel = (stage: string | null) => {
  if (!stage) return ''
  return stageLabels[stage] ?? stage
}

export const shouldApplyLive2dTask = (startedProjectId: string, currentProjectId: string | undefined) =>
  startedProjectId === currentProjectId

/** 同一请求只带一个来源，避免 Java 无法判断用上传图还是人物素材。 */
export const live2dTaskBody = (projectId: string, modelName: string, source: Live2dSource): Live2dTaskBody => {
  if (!/^[1-9]\d*$/.test(projectId)) throw new Error('请选择项目。')
  const name = modelName.trim()
  if (name.length < 1 || name.length > 255) throw new Error('模型名称需要 1 到 255 个字符。')
  if ('uploadFileId' in source) {
    if (!source.uploadFileId.trim()) throw new Error('图片还没有上传完成。')
    return { projectId, modelName: name, uploadFileId: source.uploadFileId }
  }
  if (!source.sourceAssetId.trim()) throw new Error('请选择一张人物素材。')
  return { projectId, modelName: name, sourceAssetId: source.sourceAssetId }
}

export const live2dImageIssue = (file: File) => {
  const extension = file.name.split('.').pop()?.toLowerCase() ?? ''
  const extensionOk = extension === 'png' || extension === 'jpg' || extension === 'jpeg' || extension === 'webp'
  const typeOk = LIVE2D_IMAGE_TYPES.some((type) => type === file.type)
  if (!typeOk && !extensionOk) return '请选择 PNG、JPEG 或 WebP 图片。'
  if (file.size > MAX_LIVE2D_IMAGE_BYTES) return '图片不能超过 10 MiB。'
  return ''
}

/**
 * 模型资源路径自带访问票据。只为本站其他需要登录态的地址提供业务 JWT。
 */
export const modelRequestNeedsAuth = (url: string, pageOrigin: string) => {
  if (url.startsWith('blob:') || url.startsWith('data:')) return false
  try {
    const resource = new URL(url, pageOrigin)
    const hasModelTicket = /^\/api\/projects\/\d+\/live2d\/models\/\d+\/files\/[a-f0-9]{64}\//.test(resource.pathname)
    return resource.origin === pageOrigin && !hasModelTicket
  } catch {
    return false
  }
}

/** 拒绝绝对地址、查询串和目录穿越，只允许相对当前 model3.json 的文件。 */
export const safeModelReference = (reference: string) => {
  const normalized = reference.replaceAll('\\', '/')
  if (!normalized || normalized.startsWith('/') || /^[a-z][a-z0-9+.-]*:/i.test(normalized)) {
    throw new Error('模型引用了不受支持的文件地址。')
  }
  if (normalized.includes('?') || normalized.includes('#') || normalized.split('/').includes('..')) {
    throw new Error('模型引用了不受支持的文件地址。')
  }
  return normalized
}

/** 用入口文件所在目录解析相对路径，不继承入口 URL 上的签名查询串。 */
export const resolveModelReference = (entryUrl: string, reference: string) => {
  const safe = safeModelReference(reference)
  const entry = new URL(entryUrl, 'https://model.local')
  const resolved = new URL(safe, entry)
  if (resolved.origin !== entry.origin) throw new Error('模型文件指向了其他地址。')
  if (entryUrl.startsWith('http://') || entryUrl.startsWith('https://')) {
    return new URL(`${resolved.pathname}${resolved.search}`, new URL(entryUrl).origin).toString()
  }
  return `${resolved.pathname}${resolved.search}`
}

const copyMotion = (motion: { File: string }, resolve: (reference: string) => string) => ({
  ...motion,
  File: resolve(motion.File),
})

export const rewriteModelFiles = (
  model: ModelSettingsJson,
  resolve: (reference: string) => string,
): ModelSettingsJson => {
  const files = model.FileReferences
  const motions = files.Motions
    ? Object.fromEntries(Object.entries(files.Motions).map(([group, items]) => [group, items.map((item) => copyMotion(item, resolve))]))
    : undefined
  return {
    ...model,
    FileReferences: {
      ...files,
      Moc: resolve(files.Moc),
      Textures: files.Textures.map(resolve),
      Physics: files.Physics ? resolve(files.Physics) : undefined,
      Pose: files.Pose ? resolve(files.Pose) : undefined,
      UserData: files.UserData ? resolve(files.UserData) : undefined,
      DisplayInfo: files.DisplayInfo ? resolve(files.DisplayInfo) : undefined,
      Expressions: files.Expressions?.map((item) => ({ ...item, File: resolve(item.File) })),
      Motions: motions,
    },
  }
}

type DirectoryEntry = {
  name: string
  webkitRelativePath?: string
}

export const indexModelDirectory = <Entry extends DirectoryEntry>(files: readonly Entry[]) => {
  const listed = files.map((file) => ({
    file,
    path: (file.webkitRelativePath || file.name).replaceAll('\\', '/'),
  }))
  const entries = listed.filter((item) => item.path.toLowerCase().endsWith('.model3.json'))
  if (entries.length === 0) throw new Error('所选目录里没有 .model3.json。')
  if (entries.length > 1) throw new Error('所选目录里有多个 .model3.json，请只保留一个入口。')
  const entry = entries[0]
  if (!entry) throw new Error('所选目录里没有 .model3.json。')
  const folder = entry.path.includes('/') ? entry.path.slice(0, entry.path.lastIndexOf('/') + 1) : ''
  const indexed = new Map<string, Entry>()
  for (const item of listed) {
    if (!item.path.startsWith(folder)) continue
    indexed.set(item.path.slice(folder.length), item.file)
  }
  return { entryName: entry.path.slice(folder.length), files: indexed }
}

export const availableMotionTests = (parameterIds: readonly string[]): MotionTest[] => {
  const present = new Set(parameterIds)
  return motionCatalog.flatMap((test) => {
    const parameters = test.parameters.filter((id) => present.has(id))
    return parameters.length > 0 ? [{ id: test.id, label: test.label, parameters }] : []
  })
}

/** 眨眼关到最小值，张嘴开到最大值，转头在当前默认值附近偏转。 */
export const motionTarget = (kind: MotionTestId, min: number, max: number, fallback: number) => {
  if (kind === 'blink') return min
  if (kind === 'mouth') return max
  const turned = Math.min(Math.max(fallback + 15, min), max)
  if (turned !== fallback) return turned
  return Math.min(max, fallback + (max - min) * 0.25)
}

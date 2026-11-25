import type { ComboTrack, MotionSource } from './combo-contract.js'

export type MotionCompatibility = 'ready' | 'partial' | 'missing'

export type MotionPurpose = '眼神' | '表情' | '头部' | '口型' | '模型动作' | '台词'

export type CatalogItem = {
  key: string
  name: string
  category: '预设' | '模型动作' | '台词'
  part: '脸部' | '头部' | '口型' | '台词'
  purpose: MotionPurpose
  durationMs: number | null
  compatibility: MotionCompatibility
  missing: readonly string[]
  parameters: readonly string[]
  source: MotionSource
}

export type CatalogQuery = {
  keyword: string
  part: 'all' | ComboTrack
  purpose: 'all' | MotionPurpose
  compatibility: 'all' | MotionCompatibility
}

const presetProfile: Record<string, { name: string; purpose: MotionPurpose; durationMs: number }> = {
  blink: { name: '眨眼', purpose: '眼神', durationMs: 320 },
  smile: { name: '微笑', purpose: '表情', durationMs: 1_800 },
  nod: { name: '点头', purpose: '头部', durationMs: 800 },
}

const partLabel: Record<ComboTrack, CatalogItem['part']> = {
  face: '脸部',
  head: '头部',
  mouth: '口型',
  speech: '台词',
}

const purposeForTrack = (track: ComboTrack): MotionPurpose => {
  if (track === 'head') return '头部'
  if (track === 'mouth') return '口型'
  if (track === 'speech') return '台词'
  return '表情'
}

export const compatibilityLabel: Record<MotionCompatibility, string> = {
  ready: '可播',
  partial: '部分可播',
  missing: '缺少绑定',
}

export const presetDuration = (presetId: string | null | undefined) =>
  presetId ? presetProfile[presetId]?.durationMs ?? 1_000 : 1_000

const compatibilityOf = (source: MotionSource): MotionCompatibility => {
  const missing = source.missingParameterIds ?? []
  if (source.supported === false) return 'missing'
  if (missing.length > 0 || source.durationMs === null && source.presetId == null && source.trackType === 'MOTION') return 'partial'
  return 'ready'
}

export const catalogItems = (sources: readonly MotionSource[]): CatalogItem[] => sources.map((source) => {
  const preset = source.presetId ? presetProfile[source.presetId] : undefined
  const name = preset?.name ?? source.name
  return {
    key: `${source.trackType}:${source.sourceId}`,
    name,
    category: source.presetId ? '预设' : source.trackType === 'DIALOGUE' ? '台词' : '模型动作',
    part: partLabel[source.track],
    purpose: preset?.purpose ?? (source.trackType === 'MOTION' && !source.presetId ? '模型动作' : purposeForTrack(source.track)),
    durationMs: source.durationMs ?? preset?.durationMs ?? null,
    compatibility: compatibilityOf(source),
    missing: source.missingParameterIds ?? [],
    parameters: source.parameterIds ?? [],
    source: { ...source, name },
  }
})

export const filterCatalog = (items: readonly CatalogItem[], query: CatalogQuery) => {
  const keyword = query.keyword.trim()
  return items.filter((item) => {
    if (keyword && !`${item.name} ${item.missing.join(' ')}`.includes(keyword)) return false
    if (query.part !== 'all' && item.source.track !== query.part) return false
    if (query.purpose !== 'all' && item.purpose !== query.purpose) return false
    if (query.compatibility !== 'all' && item.compatibility !== query.compatibility) return false
    return true
  })
}

export const formatMotionSeconds = (durationMs: number | null) =>
  durationMs === null ? '未标明' : `${(durationMs / 1000).toFixed(2)} 秒`

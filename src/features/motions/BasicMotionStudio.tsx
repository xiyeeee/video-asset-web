import { useEffect, useMemo, useState } from 'react'
import { isCancelled } from '@/features/auth/auth-api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { ParameterRange } from '@/features/live2d/Live2DViewport'
import { getLive2dVersion } from '@/services/live2d/api'
import {
  comboErrorMessage,
  createComboMotion,
  listComboCatalog,
  type ComboCompile,
  type ModelChoice,
} from '@/services/live2d/combo-api'
import { emptyComboDraft, live2dId, placeClip, timelineDuration, type MotionSource } from '@/services/live2d/combo-contract'
import {
  catalogItems,
  compatibilityLabel,
  filterCatalog,
  formatMotionSeconds,
  type CatalogQuery,
  type MotionCompatibility,
  type MotionPurpose,
} from '@/services/live2d/motion-catalog'
import { CompiledPreview } from './CompiledPreview'

const parts = [
  { id: 'all', label: '全部部位' },
  { id: 'face', label: '脸部' },
  { id: 'head', label: '头部' },
  { id: 'mouth', label: '口型' },
  { id: 'speech', label: '台词' },
] as const

const purposes: { id: 'all' | MotionPurpose; label: string }[] = [
  { id: 'all', label: '全部用途' },
  { id: '眼神', label: '眼神' },
  { id: '表情', label: '表情' },
  { id: '头部', label: '头部' },
  { id: '口型', label: '口型' },
  { id: '模型动作', label: '模型动作' },
  { id: '台词', label: '台词' },
]

const compatibilities: { id: 'all' | MotionCompatibility; label: string }[] = [
  { id: 'all', label: '全部兼容性' },
  { id: 'ready', label: '可播' },
  { id: 'partial', label: '部分可播' },
  { id: 'missing', label: '缺少绑定' },
]

export function BasicMotionStudio({
  projectId,
  choice,
}: {
  projectId: string
  choice: ModelChoice | null
}) {
  const [sources, setSources] = useState<MotionSource[]>([])
  const [catalogError, setCatalogError] = useState('')
  const [query, setQuery] = useState<CatalogQuery>({ keyword: '', part: 'all', purpose: 'all', compatibility: 'all' })
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const [durationOverride, setDurationOverride] = useState<{ key: string; durationMs: number } | null>(null)
  const [scene, setScene] = useState<'action' | 'line'>('action')
  const [modelUrl, setModelUrl] = useState<string | null>(null)
  const [modelError, setModelError] = useState('')
  const [ranges, setRanges] = useState<readonly ParameterRange[]>([])
  const [compiled, setCompiled] = useState<ComboCompile | null>(null)
  const [probe, setProbe] = useState(false)
  const [amplitude, setAmplitude] = useState(70)
  const [direction, setDirection] = useState<'increase' | 'decrease'>('increase')
  const [saving, setSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState('')

  useEffect(() => {
    if (!choice) return
    const controller = new AbortController()
    void listComboCatalog(projectId, choice.versionId, controller.signal)
      .then((items) => {
        if (controller.signal.aborted) return
        setSources(items)
        setCatalogError('')
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted || isCancelled(error)) return
        setCatalogError(comboErrorMessage(error, '动作目录加载失败。'))
      })
    return () => controller.abort()
  }, [projectId, choice])

  useEffect(() => {
    if (!choice) return
    const controller = new AbortController()
    void getLive2dVersion(projectId, choice.characterId, choice.versionId, controller.signal)
      .then((detail) => {
        if (controller.signal.aborted) return
        setModelUrl(detail.modelEntryUrl)
        setModelError('')
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted || isCancelled(error)) return
        setModelUrl(null)
        setModelError(comboErrorMessage(error, '模型加载失败。'))
      })
    return () => controller.abort()
  }, [projectId, choice])

  const items = useMemo(() => catalogItems(sources), [sources])
  const visible = useMemo(() => filterCatalog(items, query), [items, query])
  const selected = items.find((item) => item.key === selectedKey) ?? visible[0] ?? null
  const dialogue = items.find((item) => item.source.trackType === 'DIALOGUE') ?? null
  const durationMs = durationOverride?.key === selected?.key ? durationOverride.durationMs : (selected?.durationMs ?? 1_000)

  const draft = useMemo(() => {
    if (!choice || !selected) return null
    const source = { ...selected.source, durationMs }
    let next = placeClip(emptyComboDraft(selected.name, choice.characterId, choice.versionId), source, 0)
    if (scene === 'line' && dialogue && dialogue.key !== selected.key) {
      next = placeClip(next, dialogue.source, 200)
    }
    return { ...next, durationMs: timelineDuration(next.clips, next.clips.reduce((end, clip) => Math.max(end, clip.startMs + clip.durationMs), 2)) }
  }, [choice, selected, durationMs, scene, dialogue])

  const probeValues = probe ? selected?.parameters.flatMap((id) => {
    const range = ranges.find((item) => item.id === id)
    if (!range) return []
    const target = direction === 'decrease' ? range.min : range.max
    const value = range.fallback + (target - range.fallback) * (amplitude / 100)
    return [{ id, value }]
  }) ?? null : null

  const save = async () => {
    if (!draft || !compiled || compiled.status !== 'READY' || saving) return
    setSaving(true)
    setSaveMessage('')
    try {
      const comboId = await createComboMotion(projectId, draft, compiled.compilationId, live2dId())
      setSaveMessage(`已另存为我的动作 ${comboId}，可在「组合反应」里重新打开。`)
    } catch (error: unknown) {
      setSaveMessage(comboErrorMessage(error, '保存失败。'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="grid min-h-0 gap-3 lg:grid-cols-[320px_minmax(0,1fr)]">
      <section className="flex min-h-0 flex-col gap-3 rounded-2xl border border-white/10 bg-card p-3">
        <Input aria-label="搜索动作" placeholder="搜索动作..." value={query.keyword} onChange={(event) => setQuery({ ...query, keyword: event.currentTarget.value })} />
        <div className="grid grid-cols-1 gap-2">
          <FilterSelect label="部位" value={query.part} options={parts} onChange={(part) => setQuery({ ...query, part })} />
          <FilterSelect label="表演用途" value={query.purpose} options={purposes} onChange={(purpose) => setQuery({ ...query, purpose })} />
          <FilterSelect label="当前模型兼容性" value={query.compatibility} options={compatibilities} onChange={(compatibility) => setQuery({ ...query, compatibility })} />
        </div>
        {catalogError ? <p className="text-sm text-rose-300">{catalogError}</p> : null}
        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto">
          {visible.map((item) => (
            <button key={item.key} type="button" className={`w-full rounded-xl border px-3 py-2 text-left ${item.key === selected?.key ? 'border-violet-300 bg-violet-500/15' : 'border-white/10'}`} onClick={() => setSelectedKey(item.key)}>
              <span className="flex items-center justify-between gap-2">
                <span className="truncate text-sm">{item.name}</span>
                <span className={`shrink-0 text-xs ${item.compatibility === 'ready' ? 'text-emerald-200' : 'text-amber-200'}`}>{compatibilityLabel[item.compatibility]}</span>
              </span>
              <span className="mt-1 block text-xs text-muted-foreground">{item.category} · {item.part} · {item.purpose} · {formatMotionSeconds(item.durationMs)}</span>
            </button>
          ))}
          {visible.length === 0 && !catalogError ? <p className="text-sm text-muted-foreground">没有符合筛选的动作。</p> : null}
        </div>
      </section>
      <section className="flex min-h-0 flex-col gap-3 rounded-2xl border border-white/10 bg-card p-3">
        {modelError ? <p className="text-sm text-rose-300">{modelError}</p> : null}
        {selected ? (
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <p className="text-sm font-medium">{selected.name}</p>
              <p className="text-xs text-muted-foreground">{selected.category} · 默认 {formatMotionSeconds(selected.durationMs)} · {compatibilityLabel[selected.compatibility]}</p>
            </div>
            <label className="text-xs text-muted-foreground">
              时长（秒）
              <Input aria-label="动作时长" className="mt-1 w-28" type="number" min={0.05} max={120} step={0.01} value={durationMs / 1000} onChange={(event) => {
                const next = Math.round(Number(event.currentTarget.value) * 1000)
                if (Number.isFinite(next) && selected) setDurationOverride({ key: selected.key, durationMs: Math.min(120_000, Math.max(50, next)) })
              }} />
            </label>
            <label className="text-xs text-muted-foreground">
              幅度 {amplitude}
              <input aria-label="绑定核对幅度" className="mt-2 block" type="range" min={0} max={100} value={amplitude} onChange={(event) => setAmplitude(Number(event.currentTarget.value))} />
            </label>
            <Button type="button" size="sm" variant="outline" onClick={() => setDirection((current) => current === 'increase' ? 'decrease' : 'increase')}>
              {direction === 'increase' ? '向参数增大方向' : '向参数减小方向'}
            </Button>
            <Button type="button" size="sm" variant={probe ? 'default' : 'outline'} onClick={() => setProbe((current) => !current)}>
              {probe ? '关闭绑定核对' : '核对绑定'}
            </Button>
            <Button type="button" size="sm" disabled={saving || compiled?.status !== 'READY' || probe} onClick={() => void save()}>
              {saving ? '正在保存' : '另存为我的动作'}
            </Button>
          </div>
        ) : <p className="text-sm text-muted-foreground">选择模型版本后，这里列出全部预设、模型动作和台词。</p>}
        {selected && selected.missing.length > 0 ? (
          <p className="text-sm text-amber-200">当前模型缺少：{selected.missing.join('、')}。预览不会驱动这些参数，看到的就是替代后的效果。</p>
        ) : null}
        {selected ? (
          <p className="text-xs text-muted-foreground">
            缓动和结束行为由编译器写入动作文件：片段中段保持姿态，结束时回到默认。拖到某一毫秒和从开头播到同一毫秒读的是这份文件。幅度和方向只用于绑定核对，不会写进已保存动作。
          </p>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" variant={scene === 'action' ? 'default' : 'outline'} onClick={() => setScene('action')}>只播放这个动作</Button>
          <Button type="button" size="sm" variant={scene === 'line' ? 'default' : 'outline'} disabled={!dialogue} onClick={() => setScene('line')}>动作后 0.2 秒接台词</Button>
          {!dialogue ? <span className="text-xs text-muted-foreground">当前项目没有台词，不能做配音交接。</span> : null}
        </div>
        {saveMessage ? <p className="text-sm text-violet-100">{saveMessage}</p> : null}
        <CompiledPreview
          projectId={projectId}
          draft={probe ? null : draft}
          modelUrl={modelUrl}
          probe={probe ? probeValues : null}
          onCompiled={setCompiled}
          onParameters={setRanges}
        />
      </section>
    </div>
  )
}

function FilterSelect<Value extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: Value
  options: readonly { id: Value; label: string }[]
  onChange: (value: Value) => void
}) {
  return (
    <Select value={value} onValueChange={(next) => onChange(next as Value)}>
      <SelectTrigger aria-label={label}><SelectValue /></SelectTrigger>
      <SelectContent>
        {options.map((option) => <SelectItem key={option.id} value={option.id}>{option.label}</SelectItem>)}
      </SelectContent>
    </Select>
  )
}

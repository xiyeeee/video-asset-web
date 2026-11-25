import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, Eye, Pencil, Plus, Save, Search } from 'lucide-react'
import { AuthError, isCancelled } from '@/features/auth/auth-api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { getLive2dVersion } from '@/services/live2d/api'
import {
  acceptComboPreview,
  comboDraftKey,
  comboFingerprint,
  conflictSegmentIds,
  emptyComboDraft,
  labelComboClips,
  live2dId,
  placeClip,
  removeClip,
  samplePlayback,
  type ComboDraft,
  type MotionSource,
  type PlaybackSegment,
} from '@/services/live2d/combo-contract'
import {
  comboErrorMessage,
  compileComboMotion,
  createComboMotion,
  fetchComboResource,
  getComboMotion,
  listComboCatalog,
  listModelChoices,
  loadMotionCurves,
  retryComboSave,
  updateComboMotion,
  type ComboCompile,
  type ModelChoice,
} from '@/services/live2d/combo-api'
import type { Live2dHistoryFocus } from '@/services/live2d/contract'
import { ComboTimeline } from './ComboTimeline'
import { Live2DViewport, type ComboSample } from './Live2DViewport'

const choiceValue = (choice: { characterId: string; versionId: string }) => `${choice.characterId}:${choice.versionId}`

const nameLength = (value: string) => [...value.trim()].length

type AudioHandle = {
  playFrom: (timeMs: number) => void
  stop: () => void
}

export function ComboEditor({
  projectId,
  comboId,
  focus,
  autoPlay,
  dirtyRef,
  onBack,
}: {
  projectId: string
  comboId: string | null
  focus: Live2dHistoryFocus | null
  autoPlay: boolean
  dirtyRef: { current: boolean }
  onBack: () => void
}) {
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [loadError, setLoadError] = useState('')
  const [choices, setChoices] = useState<ModelChoice[]>([])
  const [sources, setSources] = useState<MotionSource[]>([])
  const [sourceError, setSourceError] = useState('')
  const [query, setQuery] = useState('')
  const [draft, setDraft] = useState<ComboDraft | null>(null)
  const [savedFingerprint, setSavedFingerprint] = useState('')
  const [compileStatus, setCompileStatus] = useState<'idle' | 'pending' | 'ready' | 'error'>('idle')
  const [preview, setPreview] = useState<ComboCompile | null>(null)
  const [compiledKey, setCompiledKey] = useState('')
  const [playback, setPlayback] = useState<PlaybackSegment[]>([])
  const [motions, setMotions] = useState<PlaybackSegment[]>([])
  const [modelUrl, setModelUrl] = useState<string | null>(null)
  const [modelError, setModelError] = useState('')
  const [modelReady, setModelReady] = useState(false)
  const [modelRetry, setModelRetry] = useState(0)
  const [timeMs, setTimeMs] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [loop, setLoop] = useState(true)
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [saved, setSaved] = useState(false)
  const [editingName, setEditingName] = useState(false)
  const draftRef = useRef<ComboDraft | null>(null)
  const timeRef = useRef(0)
  const loopRef = useRef(true)
  const playingRef = useRef(false)
  const sampleRef = useRef<ComboSample | null>(null)
  const audioRef = useRef<AudioHandle | null>(null)
  const previewUrlRef = useRef<string | null>(null)
  const compileIds = useRef(new Map<string, string>())
  const saveRequestRef = useRef<{ key: string; id: string } | null>(null)
  const playedRef = useRef(false)
  const clockRef = useRef({ at: 0, timeMs: 0 })
  const fingerprint = draft ? comboFingerprint(draft) : ''
  const dirty = fingerprint !== savedFingerprint && draft !== null
  const draftKey = draft ? comboDraftKey(draft) : ''
  const previewCurrent = preview !== null && compiledKey === draftKey
  const modelPreview = useMemo(
    () => modelUrl ? { id: `${draft?.modelVersionId ?? ''}:${modelRetry}`, kind: 'url' as const, url: modelUrl, sample: false } : null,
    [modelUrl, draft?.modelVersionId, modelRetry],
  )

  useEffect(() => {
    if (!dirty) return
    const onLeave = (event: BeforeUnloadEvent) => {
      event.preventDefault()
    }
    window.addEventListener('beforeunload', onLeave)
    return () => window.removeEventListener('beforeunload', onLeave)
  }, [dirty])

  useEffect(() => {
    draftRef.current = draft
    loopRef.current = loop
    playingRef.current = playing
    dirtyRef.current = dirty
    sampleRef.current = (at) => previewCurrent ? samplePlayback(motions, at) : []
  }, [draft, loop, playing, dirty, dirtyRef, motions, previewCurrent])

  useEffect(() => {
    const controller = new AbortController()
    void (async () => {
      try {
        let nextChoices: ModelChoice[] = []
        try {
          nextChoices = await listModelChoices(projectId, controller.signal)
        } catch (error: unknown) {
          if (!comboId || controller.signal.aborted || isCancelled(error)) throw error
          if (!controller.signal.aborted) setSourceError(comboErrorMessage(error, '模型列表加载失败。'))
        }
        const picked = nextChoices.find((item) => item.characterId === focus?.characterId && item.versionId === focus.versionId) ?? nextChoices[0]
        const loaded = comboId ? await getComboMotion(projectId, comboId, controller.signal) : null
        if (controller.signal.aborted) return
        if (!loaded && !picked) throw new Error('还没有已保存的模型，请先生成一个模型。')
        const bound = loaded ? nextChoices.find((item) => item.versionId === loaded.draft.modelVersionId) : null
        const next = loaded
          ? { ...loaded.draft, characterId: bound?.characterId ?? '' }
          : emptyComboDraft('未命名组合', picked?.characterId ?? '', picked?.versionId ?? '')
        const restoredPreview: ComboCompile | null = loaded ? {
          compilationId: '',
          requestId: '',
          status: 'READY',
          modelEntryUrl: loaded.modelEntryUrl,
          issues: [],
          missingCapabilities: [],
          segments: loaded.playback,
        } : null
        setChoices(nextChoices)
        setDraft(next)
        setSavedFingerprint(comboFingerprint(next))
        setModelUrl(loaded?.modelEntryUrl ?? null)
        setPlayback(loaded?.playback ?? [])
        setPreview(restoredPreview)
        setCompiledKey(restoredPreview ? comboDraftKey(next) : '')
        setCompileStatus(loaded ? 'ready' : next.clips.length === 0 ? 'idle' : 'pending')
        setStatus('ready')
      } catch (error: unknown) {
        if (controller.signal.aborted || isCancelled(error)) return
        setStatus('error')
        setLoadError(error instanceof Error && error.message ? comboErrorMessage(error, error.message) : '组合加载失败。')
      }
    })()
    return () => controller.abort()
  }, [projectId, comboId, focus?.characterId, focus?.versionId])

  const modelVersionId = draft?.modelVersionId
  const characterId = draft?.characterId

  useEffect(() => {
    if (!modelVersionId) return
    const controller = new AbortController()
    const versionId = modelVersionId
    void listComboCatalog(projectId, versionId, controller.signal)
      .then((items) => {
        if (controller.signal.aborted) return
        setSources(items)
        setSourceError('')
        setDraft((current) => current && current.modelVersionId === versionId
          ? { ...current, clips: labelComboClips(current.clips, items) }
          : current)
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted || isCancelled(error)) return
        setSourceError(comboErrorMessage(error, '动作素材加载失败。'))
      })
    return () => controller.abort()
  }, [projectId, modelVersionId])

  useEffect(() => {
    if (!characterId || !modelVersionId || previewUrlRef.current) return
    const controller = new AbortController()
    void getLive2dVersion(projectId, characterId, modelVersionId, controller.signal)
      .then((detail) => {
        if (controller.signal.aborted || previewUrlRef.current) return
        setModelUrl(detail.modelEntryUrl)
        setModelError('')
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted || isCancelled(error) || previewUrlRef.current) return
        setModelUrl(null)
        setModelReady(false)
        setModelError(comboErrorMessage(error, '模型加载失败。'))
      })
    return () => controller.abort()
  }, [projectId, characterId, modelVersionId, modelRetry])

  useEffect(() => {
    if (compileStatus !== 'pending') return
    const current = draftRef.current
    if (!current || current.clips.length === 0 || current.name.trim().length < 1) return
    const key = comboDraftKey(current)
    const controller = new AbortController()
    const timer = window.setTimeout(() => {
      const latest = draftRef.current
      if (!latest || comboDraftKey(latest) !== key) return
      const existing = compileIds.current.get(key)
      const requestId = existing ?? live2dId()
      if (!existing) compileIds.current.set(key, requestId)
      void compileComboMotion(projectId, latest, requestId, controller.signal)
        .then((result) => {
          if (result.requestId !== requestId) return
          if (!acceptComboPreview(key, comboDraftKey(draftRef.current ?? latest))) return
          previewUrlRef.current = result.modelEntryUrl
          setPreview(result)
          setCompiledKey(key)
          setMotions([])
          setPlayback(result.segments)
          setModelUrl(result.modelEntryUrl)
          setModelError('')
          setCompileStatus('ready')
          if (result.status === 'READY') setSaveError('')
          if (autoPlay && !playedRef.current) {
            playedRef.current = true
            setPlaying(true)
          }
        })
        .catch((error: unknown) => {
          if (controller.signal.aborted || isCancelled(error)) return
          if (!acceptComboPreview(key, comboDraftKey(draftRef.current ?? latest))) return
          if (error instanceof AuthError && error.code === 'LIVE2D_COMBO_CONFLICT') compileIds.current.delete(key)
          setPreview(null)
          setCompiledKey('')
          setPlayback([])
          previewUrlRef.current = null
          setCompileStatus('error')
          setSaveError(comboErrorMessage(error, '组合编译失败。'))
        })
    }, 300)
    return () => {
      controller.abort()
      window.clearTimeout(timer)
    }
  }, [projectId, draftKey, compileStatus, autoPlay])

  useEffect(() => {
    if (!previewCurrent) return
    const segments = playback
    const controller = new AbortController()
    const context = new AudioContext()
    let closed = false
    const nodes: AudioBufferSourceNode[] = []
    const buffers = new Map<string, AudioBuffer>()
    const stop = () => {
      for (const node of nodes) {
        try {
          node.stop()
        } catch {
          // 已经停止的音源再次停止会抛错，忽略即可。
        }
        node.disconnect()
      }
      nodes.length = 0
    }
    const playFrom = (at: number) => {
      stop()
      if (context.state === 'closed') return
      void context.resume()
      const now = context.currentTime
      for (const segment of segments) {
        if (segment.trackType !== 'DIALOGUE') continue
        const buffer = buffers.get(segment.segmentId)
        if (!buffer) continue
        const end = segment.startTimeMs + segment.durationMs
        if (at >= end) continue
        const source = context.createBufferSource()
        source.buffer = buffer
        source.connect(context.destination)
        const offset = ((segment.sourceStartMs ?? 0) + Math.max(0, at - segment.startTimeMs)) / 1000
        const delay = Math.max(0, segment.startTimeMs - at) / 1000
        const duration = (end - Math.max(at, segment.startTimeMs)) / 1000
        source.start(now + delay, offset, Math.max(duration, 0.001))
        nodes.push(source)
      }
    }
    audioRef.current = { playFrom, stop }
    void (async () => {
      const resolved: PlaybackSegment[] = []
      for (const segment of segments) {
        if (segment.trackType === 'MOTION') {
          resolved.push({ ...segment, motion: await loadMotionCurves(segment.resourceUrl, controller.signal) })
        } else {
          const blob = await fetchComboResource(segment.resourceUrl, controller.signal)
          buffers.set(segment.segmentId, await context.decodeAudioData(await blob.arrayBuffer()))
          resolved.push(segment)
        }
      }
      if (closed) return
      setMotions(resolved)
      if (playingRef.current) playFrom(timeRef.current)
    })().catch((error: unknown) => {
      if (closed || controller.signal.aborted || isCancelled(error)) return
      setSaveError(comboErrorMessage(error, '组合预览资源加载失败。'))
    })
    return () => {
      closed = true
      controller.abort()
      stop()
      audioRef.current = null
      void context.close()
    }
  }, [previewCurrent, playback])

  useEffect(() => {
    if (!playing) {
      audioRef.current?.stop()
      return
    }
    clockRef.current = { at: performance.now(), timeMs: timeRef.current }
    audioRef.current?.playFrom(timeRef.current)
    let frame = 0
    const tick = (now: number) => {
      const duration = Math.max(draftRef.current?.durationMs ?? 1, 1)
      const raw = clockRef.current.timeMs + (now - clockRef.current.at)
      if (raw >= duration) {
        if (!loopRef.current) {
          timeRef.current = duration
          setTimeMs(duration)
          audioRef.current?.stop()
          setPlaying(false)
          return
        }
        const wrapped = raw % duration
        clockRef.current = { at: now, timeMs: wrapped }
        timeRef.current = wrapped
        setTimeMs(wrapped)
        audioRef.current?.playFrom(wrapped)
      } else {
        timeRef.current = raw
        setTimeMs(raw)
      }
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [playing])

  const replaceDraft = (next: ComboDraft) => {
    draftRef.current = next
    previewUrlRef.current = null
    setPlaying(false)
    audioRef.current?.stop()
    setDraft(next)
    setPreview(null)
    setCompiledKey('')
    setPlayback([])
    setMotions([])
    setSaved(false)
    setSaveError('')
    setCompileStatus(next.clips.length === 0 || next.name.trim().length < 1 ? 'idle' : 'pending')
  }

  const seek = (time: number) => {
    const duration = draftRef.current?.durationMs ?? 0
    const next = Math.min(Math.max(0, time), duration)
    timeRef.current = next
    setTimeMs(next)
    if (playingRef.current) {
      clockRef.current = { at: performance.now(), timeMs: next }
      audioRef.current?.playFrom(next)
    }
  }

  const save = async () => {
    if (!draft || saving || !dirty) return
    const length = nameLength(draft.name)
    if (length < 1 || length > 150) {
      setSaveError('组合名称需要 1 到 150 个字符。')
      return
    }
    if (!previewCurrent || !preview || preview.status !== 'READY' || !preview.compilationId) {
      setSaveError(preview?.status === 'CONFLICT' ? '动作片段有冲突，修正后才能保存。' : '请先等待当前时间轴编译完成。')
      return
    }
    const key = comboDraftKey({ ...draft, name: draft.name.trim() })
    const previous = saveRequestRef.current
    const requestId = previous?.key === key ? previous.id : live2dId()
    saveRequestRef.current = { key, id: requestId }
    setSaving(true)
    setSaveError('')
    try {
      const named = { ...draft, name: draft.name.trim() }
      const stored = named.comboId
        ? await updateComboMotion(projectId, named.comboId, named, preview.compilationId, requestId)
        : await createComboMotion(projectId, named, preview.compilationId, requestId)
      const savedDraft = { ...named, comboId: stored }
      setDraft(savedDraft)
      setSavedFingerprint(comboFingerprint(savedDraft))
      setSaved(true)
    } catch (error: unknown) {
      if (error instanceof AuthError && error.code === 'LIVE2D_COMBO_SAVE_FAILED') {
        try {
          const stored = await retryComboSave(projectId, requestId)
          const savedDraft = { ...draft, name: draft.name.trim(), comboId: stored }
          setDraft(savedDraft)
          setSavedFingerprint(comboFingerprint(savedDraft))
          setSaved(true)
          return
        } catch (retryError: unknown) {
          if (!isCancelled(retryError)) setSaveError(comboErrorMessage(retryError, '组合保存失败。'))
          return
        }
      }
      if (!isCancelled(error)) setSaveError(comboErrorMessage(error, '组合保存失败。'))
    } finally {
      setSaving(false)
    }
  }

  const back = () => {
    if (dirty && !window.confirm('组合还有未保存的修改，确定离开吗？')) return
    onBack()
  }

  if (status === 'loading') {
    return <p className="grid flex-1 place-items-center text-sm text-muted-foreground">正在打开组合动作…</p>
  }
  if (status === 'error' || !draft) {
    return (
      <div className="grid flex-1 place-items-center gap-3 text-center">
        <p className="text-sm text-rose-300">{loadError || '组合加载失败。'}</p>
        <Button type="button" variant="outline" onClick={onBack}>返回列表</Button>
      </div>
    )
  }

  const selectedValue = `${draft.characterId}:${draft.modelVersionId}`
  const selected = choices.find((item) => choiceValue(item) === selectedValue)
  const visibleSources = sources.filter((item) => item.name.includes(query.trim()))
  const issues = previewCurrent && preview ? preview.issues : []
  const conflicts = conflictSegmentIds(issues)
  const missing = previewCurrent && preview
    ? [
      ...preview.issues.filter((issue) => issue.code === 'CAPABILITY_MISSING').flatMap((issue) => issue.segmentIds),
      ...(preview.missingCapabilities.includes('MOTION_DURATION_METADATA')
        ? draft.clips.filter((clip) => clip.trackType === 'MOTION' && clip.sourceDurationMs === null)
          .map((clip) => clip.segmentId)
        : []),
    ]
    : []
  const compileMessage = compileStatus === 'pending'
    ? '正在编译预览…'
    : compileStatus === 'error'
      ? (saveError || '编译失败，当前预览已过期。')
      : !previewCurrent && draft.clips.length > 0
        ? '预览待更新'
        : preview?.status === 'CONFLICT'
          ? '预览可用，但冲突未解决，不能保存。'
          : ''

  const addSource = (source: MotionSource) => {
    replaceDraft(placeClip(draft, source, timeRef.current))
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden">
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        <Button type="button" size="icon" variant="outline" aria-label="返回组合列表" onClick={back}><ArrowLeft /></Button>
        {editingName ? (
          <Input
            autoFocus
            aria-label="组合名称"
            className="max-w-xs"
            maxLength={150}
            value={draft.name}
            onChange={(event) => replaceDraft({ ...draft, name: event.currentTarget.value })}
            onBlur={() => setEditingName(false)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') setEditingName(false)
            }}
          />
        ) : (
          <button type="button" className="flex items-center gap-2 text-lg font-medium" onClick={() => setEditingName(true)}>
            {draft.name || '未命名组合'}
            <Pencil className="size-4 text-muted-foreground" />
          </button>
        )}
        {saved && !dirty ? <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs text-emerald-100">已保存</span> : null}
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Select
            value={selectedValue}
            disabled={draft.comboId !== null}
            onValueChange={(value) => {
              const choice = choices.find((item) => choiceValue(item) === value)
              if (!choice || choiceValue(choice) === selectedValue || draft.comboId) return
              setModelReady(false)
              setModelUrl(null)
              setModelError('')
              replaceDraft(emptyComboDraft(draft.name, choice.characterId, choice.versionId))
            }}
          >
            <SelectTrigger className="w-56"><SelectValue placeholder={selected?.label ?? '选择模型版本'} /></SelectTrigger>
            <SelectContent>
              {!selected ? <SelectItem value={selectedValue}>已绑定模型 · {draft.modelVersionId}</SelectItem> : null}
              {choices.map((choice) => (
                <SelectItem key={choiceValue(choice)} value={choiceValue(choice)}>{choice.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button type="button" disabled={saving || !dirty || !previewCurrent || preview?.status !== 'READY' || !preview.compilationId} onClick={() => void save()}>
            <Save />{saving ? '正在保存' : saved && !dirty ? '已保存' : '保存组合'}
          </Button>
        </div>
      </div>
      <div className="grid min-h-0 flex-1 gap-3 overflow-hidden lg:grid-cols-[240px_minmax(0,1fr)]">
        <section className="flex min-h-0 flex-col gap-3 overflow-hidden rounded-2xl border border-white/10 bg-card p-3">
          <div className="relative">
            <Search className="absolute top-2 left-2 size-4 text-muted-foreground" />
            <Input aria-label="搜索动作" className="pl-8" placeholder="搜索动作..." value={query} onChange={(event) => setQuery(event.currentTarget.value)} />
          </div>
          {sourceError ? <p className="text-sm text-rose-300">{sourceError}</p> : null}
          <div className="min-h-0 flex-1 space-y-2 overflow-y-auto">
            {visibleSources.map((source) => (
              <div key={`${source.trackType}:${source.sourceId}`} className="flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm">{source.name}</p>
                  {source.durationMs === null ? <p className="truncate text-xs text-amber-200">缺少动作时长</p> : null}
                </div>
                <Button type="button" size="icon-sm" variant="outline" aria-label={`添加${source.name}`} onClick={() => addSource(source)}>
                  <Plus />
                </Button>
              </div>
            ))}
            {visibleSources.length === 0 && !sourceError ? <p className="text-sm text-muted-foreground">没有匹配的动作。</p> : null}
          </div>
        </section>
        <section className="flex min-h-0 flex-col gap-2 overflow-hidden rounded-2xl border border-white/10 bg-card p-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-medium">模型预览</h2>
            {compileMessage ? <span className="text-xs text-violet-100">{compileMessage}</span> : null}
            {compileStatus === 'error' ? (
              <Button type="button" size="sm" variant="outline" onClick={() => setCompileStatus('pending')}>重新编译</Button>
            ) : null}
          </div>
          {modelError ? <p className="text-sm text-rose-300">{modelError}</p> : null}
          <Live2DViewport
            preview={modelPreview}
            showCenter={false}
            showTests={false}
            fill
            emptyText="选择模型版本后，这里会显示组合预览。"
            sampleRef={sampleRef}
            timeRef={timeRef}
            onModelState={setModelReady}
            onRetry={() => {
              previewUrlRef.current = null
              setModelReady(false)
              setModelError('')
              setModelRetry((current) => current + 1)
            }}
          />
        </section>
      </div>
      {previewCurrent && preview && preview.missingCapabilities.length > 0 ? (
        <div className="shrink-0 rounded-xl border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
          {preview.missingCapabilities.map((code) => (
            <p key={code}>{code === 'MOTION_DURATION_METADATA' ? '有动作缺少时长信息，时间轴上已标出。' : code}</p>
          ))}
        </div>
      ) : null}
      {issues.length > 0 ? (
        <div className="shrink-0 rounded-xl border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-100">
          {issues.map((item) => (
            <p key={`${item.code}:${item.segmentIds.join(',')}`}>{item.message || item.code}</p>
          ))}
          {conflicts.length > 0 ? (
            <Button type="button" size="sm" variant="outline" className="mt-2" onClick={() => {
              const segmentId = conflicts[0]
              if (!segmentId) return
              setSelectedClipId(segmentId)
              const clip = draft.clips.find((item) => item.segmentId === segmentId)
              if (clip) seek(clip.startMs)
            }}><Eye />定位冲突片段</Button>
          ) : null}
        </div>
      ) : null}
      {saveError && compileStatus !== 'error' ? <p className="shrink-0 text-sm text-rose-300">{saveError}</p> : null}
      <ComboTimeline
        draft={draft}
        timeMs={timeMs}
        playing={playing}
        loop={loop}
        selectedClipId={selectedClipId}
        conflictClipIds={conflicts}
        missingClipIds={missing}
        onSeek={seek}
        onTogglePlay={() => {
          if (!previewCurrent || !modelReady) return
          setPlaying((current) => !current)
        }}
        onStop={() => {
          setPlaying(false)
          seek(0)
        }}
        onStep={(delta) => seek(timeRef.current + delta)}
        onLoop={() => setLoop((current) => !current)}
        onSelect={setSelectedClipId}
        onDraft={replaceDraft}
        onRemove={(clipId) => {
          replaceDraft(removeClip(draft, clipId))
          setSelectedClipId(null)
        }}
        onAddTrack={(track) => {
          const source = sources.find((item) => item.track === track)
          if (!source) {
            setSourceError('这个轨道没有可添加的素材。')
            return
          }
          addSource(source)
        }}
      />
    </div>
  )
}

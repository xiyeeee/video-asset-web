import { useEffect, useMemo, useRef, useState } from 'react'
import { Pause, Play, RotateCcw } from 'lucide-react'
import { AuthError, isCancelled } from '@/features/auth/auth-api'
import { Button } from '@/components/ui/button'
import { Live2DViewport, type ParameterRange } from '@/features/live2d/Live2DViewport'
import {
  comboErrorMessage,
  compileComboMotion,
  fetchComboResource,
  loadMotionCurves,
  type ComboCompile,
} from '@/services/live2d/combo-api'
import {
  acceptComboPreview,
  comboDraftKey,
  formatComboClock,
  live2dId,
  samplePlayback,
  type ComboDraft,
  type PlaybackSegment,
} from '@/services/live2d/combo-contract'

type AudioHandle = { playFrom: (timeMs: number) => void; stop: () => void }

export function CompiledPreview({
  projectId,
  draft,
  modelUrl,
  probe,
  onCompiled,
  onParameters,
}: {
  projectId: string
  draft: ComboDraft | null
  modelUrl: string | null
  probe: readonly { id: string; value: number }[] | null
  onCompiled?: (result: ComboCompile | null) => void
  onParameters?: (ranges: readonly ParameterRange[]) => void
}) {
  const [compileStatus, setCompileStatus] = useState<'idle' | 'pending' | 'ready' | 'error'>('idle')
  const [preview, setPreview] = useState<ComboCompile | null>(null)
  const [compiledKey, setCompiledKey] = useState('')
  const [playback, setPlayback] = useState<PlaybackSegment[]>([])
  const [motions, setMotions] = useState<PlaybackSegment[]>([])
  const [entryUrl, setEntryUrl] = useState<string | null>(modelUrl)
  const [message, setMessage] = useState('')
  const [flat, setFlat] = useState(false)
  const [timeMs, setTimeMs] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [modelReady, setModelReady] = useState(false)
  const draftRef = useRef(draft)
  const timeRef = useRef(0)
  const playingRef = useRef(false)
  const sampleRef = useRef<((at: number) => readonly { id: string; value: number }[]) | null>(null)
  const audioRef = useRef<AudioHandle | null>(null)
  const compileIds = useRef(new Map<string, string>())
  const clockRef = useRef({ at: 0, timeMs: 0 })
  const onCompiledRef = useRef(onCompiled)
  const draftKey = draft && draft.clips.length > 0 ? comboDraftKey(draft) : ''
  const previewCurrent = preview !== null && compiledKey === draftKey && draftKey !== ''
  const shownUrl = previewCurrent && entryUrl ? entryUrl : modelUrl
  const modelPreview = useMemo(
    () => shownUrl ? { id: shownUrl, kind: 'url' as const, url: shownUrl, sample: false } : null,
    [shownUrl],
  )

  useEffect(() => {
    draftRef.current = draft
    playingRef.current = playing
    onCompiledRef.current = onCompiled
    sampleRef.current = (at) => {
      if (probe && probe.length > 0) return probe
      return previewCurrent ? samplePlayback(motions, at) : []
    }
  }, [draft, playing, probe, motions, previewCurrent, onCompiled])

  useEffect(() => {
    if (!draftKey) return
    const current = draftRef.current
    if (!current) return
    const key = draftKey
    const controller = new AbortController()
    const timer = window.setTimeout(() => {
      setCompileStatus('pending')
      setPlaying(false)
      const latest = draftRef.current
      if (!latest || comboDraftKey(latest) !== key) return
      const existing = compileIds.current.get(key)
      const requestId = existing ?? live2dId()
      if (!existing) compileIds.current.set(key, requestId)
      void compileComboMotion(projectId, latest, requestId, controller.signal)
        .then((result) => {
          if (result.requestId !== requestId) return
          if (!acceptComboPreview(key, comboDraftKey(draftRef.current ?? latest))) return
          setPreview(result)
          setCompiledKey(key)
          setPlayback(result.segments)
          setMotions([])
          setEntryUrl(result.modelEntryUrl)
          setCompileStatus('ready')
          setMessage(result.status === 'CONFLICT' ? '编译发现冲突，下面是实际能播的结果。' : '')
          onCompiledRef.current?.(result)
        })
        .catch((error: unknown) => {
          if (controller.signal.aborted || isCancelled(error)) return
          if (!acceptComboPreview(key, comboDraftKey(draftRef.current ?? latest))) return
          if (error instanceof AuthError && error.code === 'LIVE2D_COMBO_CONFLICT') compileIds.current.delete(key)
          setPreview(null)
          setCompiledKey('')
          setPlayback([])
          setCompileStatus('error')
          setMessage(comboErrorMessage(error, '动作编译失败。'))
          onCompiledRef.current?.(null)
        })
    }, 300)
    return () => {
      controller.abort()
      window.clearTimeout(timer)
    }
  }, [projectId, draftKey])

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
          // 已经停止的音源再次停止会抛错。
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
        try {
          source.start(now + delay, offset, Math.max(duration, 0.001))
          nodes.push(source)
        } catch {
          source.disconnect()
        }
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
      const duration = draftRef.current?.durationMs ?? 1
      const mid = samplePlayback(resolved, Math.floor(duration / 2))
      const start = samplePlayback(resolved, 0)
      const same = mid.length === start.length && mid.every((point, index) => point.id === start[index]?.id && point.value === start[index]?.value)
      setFlat(resolved.some((item) => item.trackType === 'MOTION') && same)
      if (playingRef.current) playFrom(timeRef.current)
    })().catch((error: unknown) => {
      if (closed || controller.signal.aborted || isCancelled(error)) return
      setMessage(comboErrorMessage(error, '动作或音频资源加载失败。'))
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
        timeRef.current = duration
        setTimeMs(duration)
        audioRef.current?.stop()
        setPlaying(false)
        return
      }
      timeRef.current = raw
      setTimeMs(raw)
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [playing])

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

  const durationMs = draft?.durationMs ?? 0

  return (
    <div className="flex min-h-0 flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" size="icon" aria-label={playing ? '暂停' : '播放'} disabled={!previewCurrent || !modelReady || probe !== null} onClick={() => setPlaying((current) => !current)}>
          {playing ? <Pause /> : <Play />}
        </Button>
        <Button type="button" size="icon" variant="outline" aria-label="重播" disabled={!previewCurrent || !modelReady} onClick={() => {
          seek(0)
          setPlaying(true)
        }}><RotateCcw /></Button>
        <span className="font-mono text-sm text-violet-100">{formatComboClock(timeMs)} / {formatComboClock(durationMs)}</span>
        <span className="text-xs text-muted-foreground">
          {compileStatus === 'pending' ? '正在编译…' : compileStatus === 'error' ? '编译失败' : preview?.status === 'CONFLICT' ? '有冲突，预览的是实际结果' : previewCurrent ? '预览与进度使用同一条曲线' : '选择动作后开始预览'}
        </span>
      </div>
      <input
        aria-label="预览进度"
        type="range"
        min={0}
        max={Math.max(durationMs, 1)}
        step={10}
        value={Math.min(timeMs, durationMs)}
        disabled={!previewCurrent || probe !== null}
        onChange={(event) => seek(Number(event.currentTarget.value))}
      />
      {message ? <p className="text-sm text-rose-200">{message}</p> : null}
      {flat && probe === null ? <p className="text-sm text-amber-200">编译结果没有改变参数，模型上看不到这个动作。</p> : null}
      {probe ? <p className="text-sm text-amber-100">正在核对绑定。自动眨眼、呼吸和默认动作已让位，参数停在当前幅度。</p> : previewCurrent ? <p className="text-xs text-muted-foreground">播放时眼神、头部、表情和口型都由这条编译动作写入；自动眨眼、呼吸和默认动作不再叠加上去。</p> : null}
      <div className="min-h-72">
        <Live2DViewport
          preview={modelPreview}
          showCenter={false}
          showTests={false}
          fill
          emptyText={modelUrl ? '正在准备模型…' : '先选择一个模型版本。'}
          sampleRef={sampleRef}
          timeRef={timeRef}
          onModelState={setModelReady}
          onParameters={onParameters}
          onRetry={() => setEntryUrl(modelUrl)}
        />
      </div>
      {previewCurrent && preview && preview.missingCapabilities.length > 0 ? (
        <div className="rounded-xl border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
          <p>缺少绑定，实际播放不会驱动这些能力：{preview.missingCapabilities.join('、')}</p>
        </div>
      ) : null}
      {previewCurrent && preview && preview.issues.length > 0 ? (
        <div className="rounded-xl border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-100">
          {preview.issues.map((issue) => <p key={`${issue.code}:${issue.segmentIds.join(',')}`}>{issue.message || issue.code}</p>)}
        </div>
      ) : null}
    </div>
  )
}

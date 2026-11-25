import { useRef, useState } from 'react'
import { Pause, Play, Repeat, SkipBack, SkipForward, Square, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  clipEnd,
  comboTracks,
  formatComboClock,
  moveClip,
  snapMs,
  trimClip,
  type ComboClip,
  type ComboDraft,
  type ComboTrack,
} from '@/services/live2d/combo-contract'

const trackClass: Record<ComboTrack, string> = {
  face: 'bg-gradient-to-r from-violet-500 to-fuchsia-500',
  head: 'bg-cyan-400 text-slate-950',
  mouth: 'bg-gradient-to-r from-fuchsia-500 to-pink-400',
  speech: 'bg-gradient-to-r from-sky-500 to-blue-500',
}

const waveform = (seed: string) => {
  let hash = 0
  for (const char of seed) hash = (hash * 33 + char.charCodeAt(0)) >>> 0
  return Array.from({ length: 48 }, (_, index) => {
    hash = (hash * 1664525 + 1013904223 + index) >>> 0
    return 25 + (hash % 70)
  })
}

export function ComboTimeline({
  draft,
  timeMs,
  playing,
  loop,
  selectedClipId,
  conflictClipIds,
  missingClipIds,
  onSeek,
  onTogglePlay,
  onStop,
  onStep,
  onLoop,
  onSelect,
  onDraft,
  onRemove,
  onAddTrack,
}: {
  draft: ComboDraft
  timeMs: number
  playing: boolean
  loop: boolean
  selectedClipId: string | null
  conflictClipIds: readonly string[]
  missingClipIds: readonly string[]
  onSeek: (timeMs: number) => void
  onTogglePlay: () => void
  onStop: () => void
  onStep: (deltaMs: number) => void
  onLoop: () => void
  onSelect: (clipId: string | null) => void
  onDraft: (draft: ComboDraft) => void
  onRemove: (clipId: string) => void
  onAddTrack: (track: ComboTrack) => void
}) {
  const scrollerRef = useRef<HTMLDivElement>(null)
  const [zoom, setZoom] = useState(1)
  const pxPerMs = (180 * zoom) / 1000
  const width = Math.max(draft.durationMs * pxPerMs, 320)
  const seconds = Math.ceil(draft.durationMs / 1000)

  const timeAt = (clientX: number) => {
    const scroller = scrollerRef.current
    if (!scroller) return 0
    const origin = scroller.getBoundingClientRect().left
    return snapMs((clientX - origin + scroller.scrollLeft) / pxPerMs)
  }

  return (
    <section className="rounded-2xl border border-white/10 bg-card p-3">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Button type="button" size="icon" aria-label={playing ? '暂停' : '播放'} onClick={onTogglePlay}>
          {playing ? <Pause /> : <Play />}
        </Button>
        <Button type="button" size="icon" variant="outline" aria-label="停止" onClick={onStop}><Square /></Button>
        <Button type="button" size="icon" variant="outline" aria-label="后退一秒" onClick={() => onStep(-1000)}><SkipBack /></Button>
        <Button type="button" size="icon" variant="outline" aria-label="前进一秒" onClick={() => onStep(1000)}><SkipForward /></Button>
        <span className="px-2 font-mono text-sm text-violet-100">{formatComboClock(timeMs)} / {formatComboClock(draft.durationMs)}</span>
        {selectedClipId ? (
          <Button type="button" size="sm" variant="outline" onClick={() => onRemove(selectedClipId)}>
            <Trash2 />移除片段
          </Button>
        ) : null}
        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs text-muted-foreground">缩放</span>
          <input
            aria-label="时间轴缩放"
            type="range"
            min={0.6}
            max={3}
            step={0.1}
            value={zoom}
            onChange={(event) => setZoom(Number(event.currentTarget.value))}
          />
          <Button type="button" size="icon" variant={loop ? 'default' : 'outline'} aria-pressed={loop} aria-label="循环播放" onClick={onLoop}>
            <Repeat />
          </Button>
        </div>
      </div>
      <div className="flex min-w-0 gap-2">
        <div className="w-28 shrink-0 space-y-2 pt-8">
          {comboTracks.map((track) => (
            <div key={track.id} className="flex h-12 items-center text-sm text-violet-100">{track.label}</div>
          ))}
        </div>
        <div ref={scrollerRef} className="min-w-0 flex-1 overflow-x-auto">
          <div className="relative" style={{ width }}>
            <button
              type="button"
              className="relative h-8 w-full cursor-pointer text-left"
              aria-label="定位播放头"
              onClick={(event) => onSeek(Math.min(timeAt(event.clientX), draft.durationMs))}
            >
              {Array.from({ length: seconds + 1 }, (_, second) => (
                <span key={second} className="absolute top-0 text-xs text-muted-foreground" style={{ left: second * 1000 * pxPerMs }}>
                  {second}秒
                </span>
              ))}
            </button>
            <div
              className="pointer-events-none absolute top-0 bottom-0 z-10 w-px bg-fuchsia-400"
              style={{ left: Math.min(timeMs, draft.durationMs) * pxPerMs }}
            />
            <div className="space-y-2">
              {comboTracks.map((track) => {
                const clips = draft.clips.filter((clip) => clip.track === track.id)
                return (
                  <div key={track.id} className="relative h-12 rounded-lg bg-white/5">
                    {clips.length === 0 ? (
                      <button type="button" className="absolute inset-1 rounded-md border border-dashed border-white/20 text-xs text-muted-foreground" onClick={() => onAddTrack(track.id)}>
                        添加片段
                      </button>
                    ) : null}
                    {clips.map((clip) => (
                      <ClipView
                        key={clip.segmentId}
                        clip={clip}
                        pxPerMs={pxPerMs}
                        selected={clip.segmentId === selectedClipId}
                        conflict={conflictClipIds.includes(clip.segmentId) || missingClipIds.includes(clip.segmentId)}
                        timeAt={timeAt}
                        onSelect={() => onSelect(clip.segmentId)}
                        onDrag={(edge, time, grabMs) => {
                          onDraft(edge === 'move'
                            ? moveClip(draft, clip.segmentId, time - grabMs)
                            : trimClip(draft, clip.segmentId, edge, time))
                        }}
                      />
                    ))}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

function ClipView({
  clip,
  pxPerMs,
  selected,
  conflict,
  timeAt,
  onSelect,
  onDrag,
}: {
  clip: ComboClip
  pxPerMs: number
  selected: boolean
  conflict: boolean
  timeAt: (clientX: number) => number
  onSelect: () => void
  onDrag: (edge: 'move' | 'start' | 'end', timeMs: number, grabMs: number) => void
}) {
  const dragRef = useRef<{ edge: 'move' | 'start' | 'end'; grabMs: number } | null>(null)
  const bars = clip.track === 'speech' ? waveform(clip.segmentId) : []
  return (
    <div
      role="button"
      tabIndex={0}
      className={`absolute top-1 bottom-1 flex items-center overflow-hidden rounded-md px-2 text-xs text-white ${trackClass[clip.track]} ${selected ? 'ring-2 ring-white' : ''} ${conflict ? 'ring-2 ring-rose-300' : ''}`}
      style={{ left: clip.startMs * pxPerMs, width: Math.max(clip.durationMs * pxPerMs, 12) }}
      title={`${clip.label} ${clip.startMs}–${clipEnd(clip)} 毫秒`}
      onPointerDown={(event) => {
        if (event.button !== 0) return
        onSelect()
        const bounds = event.currentTarget.getBoundingClientRect()
        const local = event.clientX - bounds.left
        const edge = local <= 8 ? 'start' : bounds.width - local <= 8 ? 'end' : 'move'
        dragRef.current = { edge, grabMs: timeAt(event.clientX) - clip.startMs }
        event.currentTarget.setPointerCapture(event.pointerId)
      }}
      onPointerMove={(event) => {
        const drag = dragRef.current
        if (!drag) return
        onDrag(drag.edge, timeAt(event.clientX), drag.grabMs)
      }}
      onPointerUp={() => {
        dragRef.current = null
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') onSelect()
      }}
    >
      <span className="pointer-events-none mr-1 opacity-70">||</span>
      {clip.track === 'speech' ? (
        <span className="pointer-events-none flex h-6 min-w-0 flex-1 items-center gap-px">
          {bars.map((height, index) => (
            <span key={index} className="w-0.5 bg-white/80" style={{ height: `${height}%` }} />
          ))}
        </span>
      ) : <span className="pointer-events-none truncate">{clip.label}</span>}
      <span className="pointer-events-none ml-1 opacity-70">||</span>
    </div>
  )
}

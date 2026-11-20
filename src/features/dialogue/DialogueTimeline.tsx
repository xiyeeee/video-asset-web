import { useRef, type KeyboardEvent } from 'react'
import { formatMediaTime } from '@/features/shots/timeline'
import { placeDialogue, speakerLabel, trackTicks, type DialogueLine } from './timeline'

const tone = (speakerId: string | null, index: number) => {
  if (!speakerId) return 'bg-white/30'
  const tones = ['bg-violet-400', 'bg-sky-400', 'bg-amber-300', 'bg-emerald-400']
  return tones[index % tones.length]
}

export function DialogueTimeline({
  lines,
  durationMs,
  selectedId,
  activeIds,
  onChoose,
}: {
  lines: DialogueLine[]
  durationMs: number
  selectedId: string | null
  activeIds: ReadonlySet<string>
  onChoose: (line: DialogueLine) => void
}) {
  const buttons = useRef(new Map<string, HTMLButtonElement>())
  const placed = placeDialogue(lines, durationMs)
  const ticks = trackTicks(durationMs)
  const laneCount = placed.reduce((count, item) => Math.max(count, item.lane + 1), 1)
  const laneHeight = 3.25
  const speakerTone = new Map<string, string>()
  for (const line of lines) {
    const key = line.speakerId ?? 'unknown'
    if (!speakerTone.has(key)) speakerTone.set(key, tone(line.speakerId, speakerTone.size))
  }
  const focusLine = (line: DialogueLine | undefined) => {
    if (!line) return
    onChoose(line)
    buttons.current.get(line.assetId)?.focus()
  }
  const move = (currentId: string | null, offset: number) => {
    const index = lines.findIndex((line) => line.assetId === currentId)
    const next = lines[index + offset] ?? (offset < 0 ? lines[0] : lines[lines.length - 1])
    focusLine(next)
  }
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const currentId = document.activeElement instanceof HTMLButtonElement
      ? [...buttons.current.entries()].find(([, node]) => node === document.activeElement)?.[0] ?? selectedId
      : selectedId
    if (event.key === 'ArrowRight') {
      event.preventDefault()
      move(currentId, 1)
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault()
      move(currentId, -1)
    } else if (event.key === 'Home') {
      event.preventDefault()
      focusLine(lines[0])
    } else if (event.key === 'End') {
      event.preventDefault()
      focusLine(lines[lines.length - 1])
    }
  }

  return (
    <div className="space-y-1">
      <p className="text-xs text-muted-foreground">音轨</p>
      <div className="relative h-4">
        {ticks.map((tick) => (
          <span
            key={tick}
            className="absolute top-0 text-[10px] text-muted-foreground"
            style={{
              left: `${durationMs > 0 ? (tick / durationMs) * 100 : 0}%`,
              transform: tick === 0 ? undefined : tick === ticks[ticks.length - 1] ? 'translateX(-100%)' : 'translateX(-50%)',
            }}
          >
            {formatMediaTime(tick)}
          </span>
        ))}
      </div>
      <div
        role="group"
        aria-label="对白音轨"
        className="relative overflow-hidden rounded-xl border border-white/10 bg-black/40 px-1.5"
        style={{ height: `${laneCount * laneHeight}rem` }}
        onKeyDown={onKeyDown}
      >
        {Array.from({ length: laneCount }, (_, lane) => (
          <span
            key={lane}
            className="absolute right-0 left-0 h-px bg-white/25"
            style={{ top: `${(lane + 0.5) * laneHeight}rem` }}
          />
        ))}
        {placed.map((item) => {
          const playing = activeIds.has(item.line.assetId)
          const selected = item.line.assetId === selectedId
          const label = `${speakerLabel(item.line.speakerId)} ${formatMediaTime(item.line.startMs)} ${item.line.text}`
          return (
            <button
              key={item.line.assetId}
              ref={(node) => {
                if (node) buttons.current.set(item.line.assetId, node)
                else buttons.current.delete(item.line.assetId)
              }}
              type="button"
              title={label}
              aria-label={label}
              aria-pressed={selected}
              className={`absolute z-10 min-w-1.5 max-w-full overflow-hidden rounded px-1 text-left text-[11px] leading-6 text-slate-950 ${speakerTone.get(item.line.speakerId ?? 'unknown')} ${playing ? 'ring-2 ring-inset ring-white' : ''} ${selected ? 'ring-2 ring-inset ring-violet-200' : ''}`}
              style={{
                left: `calc(${item.leftPercent}% + 2px)`,
                width: `max(0.375rem, calc(${item.widthPercent}% - 4px))`,
                top: `${item.lane * laneHeight + 0.75}rem`,
                height: '1.75rem',
              }}
              onClick={() => onChoose(item.line)}
            >
              <span className="block truncate">{item.line.text}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

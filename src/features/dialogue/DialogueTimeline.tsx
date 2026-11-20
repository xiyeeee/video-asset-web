import { useRef, type KeyboardEvent } from 'react'
import { formatMediaTime } from '@/features/shots/timeline'
import { placeDialogue, speakerLabel, type DialogueLine } from './timeline'

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
  const laneCount = placed.reduce((count, item) => Math.max(count, item.lane + 1), 1)
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
    <div
      role="group"
      aria-label="对白时间线"
      className="relative rounded-xl bg-background/50"
      style={{ height: `${laneCount * 2.25}rem` }}
      onKeyDown={onKeyDown}
    >
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
            className={`absolute min-w-2 overflow-hidden rounded-md px-1 text-left text-[11px] leading-8 text-slate-950 ${speakerTone.get(item.line.speakerId ?? 'unknown')} ${playing ? 'ring-2 ring-white' : ''} ${selected ? 'outline outline-2 outline-offset-1 outline-violet-200' : ''}`}
            style={{
              left: `${item.leftPercent}%`,
              width: `${item.widthPercent}%`,
              top: `${item.lane * 2.25}rem`,
              height: '2rem',
            }}
            onClick={() => onChoose(item.line)}
          >
            <span className="block truncate">{item.line.text}</span>
          </button>
        )
      })}
    </div>
  )
}

import { useRef, type KeyboardEvent } from 'react'
import { formatMediaTime } from '@/features/shots/timeline'
import { speakerLabel, type DialogueLine } from './timeline'

export function DialogueLines({
  lines,
  selectedId,
  activeIds,
  onChoose,
}: {
  lines: DialogueLine[]
  selectedId: string | null
  activeIds: ReadonlySet<string>
  onChoose: (line: DialogueLine) => void
}) {
  const buttons = useRef(new Map<string, HTMLButtonElement>())
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
  const onKeyDown = (event: KeyboardEvent<HTMLOListElement>) => {
    const currentId = document.activeElement instanceof HTMLButtonElement
      ? [...buttons.current.entries()].find(([, node]) => node === document.activeElement)?.[0] ?? selectedId
      : selectedId
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      move(currentId, 1)
    } else if (event.key === 'ArrowUp') {
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
    <ol aria-label="台词" className="m-0 list-none space-y-3 px-0.5 py-1" onKeyDown={onKeyDown}>
      {lines.map((line) => {
        const playing = activeIds.has(line.assetId)
        const selected = line.assetId === selectedId
        return (
          <li key={line.assetId}>
            <button
              ref={(node) => {
                if (node) buttons.current.set(line.assetId, node)
                else buttons.current.delete(line.assetId)
              }}
              type="button"
              aria-pressed={selected}
              className={`w-full rounded-2xl border px-4 py-3 text-left ${playing || selected ? 'border-violet-300 bg-violet-400/10' : 'border-white/10 bg-card'}`}
              onClick={() => onChoose(line)}
            >
              <span className="block text-xs text-violet-200">
                {speakerLabel(line.speakerId)} · {formatMediaTime(line.startMs)} – {formatMediaTime(line.endMs)}
              </span>
              <span className="mt-1 block text-sm">{line.text}</span>
            </button>
          </li>
        )
      })}
    </ol>
  )
}

import { useRef, type KeyboardEvent } from 'react'
import { Button } from '@/components/ui/button'
import { formatMediaTime, type FormalShot } from './timeline'

export function ShotTimeline({
  shots,
  selectedId,
  failedUrl,
  onSelect,
  onReload,
}: {
  shots: FormalShot[]
  selectedId: string | null
  failedUrl: string | null
  onSelect: (shot: FormalShot) => void
  onReload: (shot: FormalShot) => void
}) {
  const buttons = useRef(new Map<string, HTMLButtonElement>())
  const highlightedId = selectedId ?? shots[0]?.assetId ?? null
  const focusShot = (shot: FormalShot | undefined) => {
    if (!shot) return
    onSelect(shot)
    buttons.current.get(shot.assetId)?.focus()
  }
  const move = (currentId: string | null, offset: number) => {
    const index = shots.findIndex((shot) => shot.assetId === (currentId ?? highlightedId))
    const next = shots[index + offset] ?? (offset < 0 ? shots[0] : shots[shots.length - 1])
    focusShot(next)
  }
  const onKeyDown = (event: KeyboardEvent<HTMLElement>, currentId: string | null) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      move(currentId, 1)
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      move(currentId, -1)
    } else if (event.key === 'Home') {
      event.preventDefault()
      focusShot(shots[0])
    } else if (event.key === 'End') {
      event.preventDefault()
      focusShot(shots[shots.length - 1])
    }
  }

  return (
    <ol aria-label="分镜时间线" className="m-0 list-none p-0" onKeyDown={(event) => onKeyDown(event, highlightedId)}>
      {shots.map((shot, index) => {
        const active = shot.assetId === highlightedId
        return (
          <li key={shot.assetId} className="grid grid-cols-[4.75rem_1rem_minmax(0,1fr)] gap-x-3">
            <time className="pt-4 text-right text-xs text-violet-200">{formatMediaTime(shot.startMs)}</time>
            <div className="relative flex justify-center">
              {index < shots.length - 1 ? <span className="absolute top-5 bottom-0 w-px bg-white/15" /> : null}
              <span className={`relative z-10 mt-4 h-2.5 w-2.5 rounded-full ${active ? 'bg-violet-300' : 'bg-white/40'}`} />
            </div>
            <article className={`mb-4 overflow-hidden rounded-2xl border bg-card ${active ? 'border-violet-300' : 'border-white/10'}`}>
              <div className="flex flex-col gap-3 p-3 sm:flex-row">
                {failedUrl === shot.frameUrl ? (
                  <div className="flex h-28 w-full items-center justify-center sm:w-44">
                    <Button type="button" variant="outline" onClick={() => onReload(shot)}>重新获取图片</Button>
                  </div>
                ) : (
                  <img
                    src={shot.frameUrl}
                    alt={`镜头 ${shot.shotIndex} 代表帧`}
                    referrerPolicy="no-referrer"
                    className="h-28 w-full rounded-xl object-cover sm:w-44"
                    onError={() => onReload(shot)}
                  />
                )}
                <div className="min-w-0">
                  <button
                    ref={(node) => {
                      if (node) buttons.current.set(shot.assetId, node)
                      else buttons.current.delete(shot.assetId)
                    }}
                    type="button"
                    className="min-h-11 text-left text-sm"
                    aria-current={active ? 'true' : undefined}
                    tabIndex={active ? 0 : -1}
                    onClick={() => onSelect(shot)}
                  >
                    镜头 {shot.shotIndex}
                  </button>
                  <p className="text-xs text-muted-foreground">{formatMediaTime(shot.startMs)} – {formatMediaTime(shot.endMs)}</p>
                  <p className="text-xs text-muted-foreground">代表帧 {formatMediaTime(shot.previewTimestampMs)}</p>
                </div>
              </div>
            </article>
          </li>
        )
      })}
    </ol>
  )
}

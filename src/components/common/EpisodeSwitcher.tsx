import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { AnalysisBadge } from '@/components/common/StatusBadge'
import { cn } from '@/lib/utils'
import type { Episode } from '@/types/domain'

export function EpisodeSwitcher({
  episodes,
  value,
  onChange,
}: {
  episodes: Episode[]
  value: string
  onChange: (episodeId: string) => void
}) {
  const selected = episodes.find((item) => item.id === value)
  const scroll = (direction: -1 | 1) => {
    const index = value === 'all' ? -1 : episodes.findIndex((item) => item.id === value)
    const next = episodes[index + direction]
    if (next) onChange(next.id)
    else if (direction < 0) onChange('all')
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-panel p-3">
      <div className="mb-2 flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">集数切换</p>
        {selected ? (
          <p className="text-sm text-emerald-300">
            第{selected.episodeNumber}集 · <AnalysisBadge status={selected.status} />
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">正在查看全部集数</p>
        )}
      </div>
      <div className="flex items-center gap-2">
        <Button type="button" size="icon-sm" variant="outline" onClick={() => scroll(-1)} aria-label="上一集">
          <ChevronLeft />
        </Button>
        <div className="flex min-w-0 flex-1 gap-2 overflow-x-auto pb-1">
          <button
            type="button"
            className={cn(
              'shrink-0 rounded-full border px-3 py-1.5 text-sm',
              value === 'all' ? 'border-primary bg-primary text-primary-foreground' : 'border-white/10 bg-card text-muted-foreground',
            )}
            onClick={() => onChange('all')}
          >
            全部集数
          </button>
          {episodes.map((episode) => (
            <button
              key={episode.id}
              type="button"
              className={cn(
                'shrink-0 rounded-full border px-3 py-1.5 text-sm',
                value === episode.id ? 'border-primary bg-primary text-primary-foreground' : 'border-white/10 bg-card',
              )}
              onClick={() => onChange(episode.id)}
            >
              第{episode.episodeNumber}集
              <span className="ml-1 text-xs opacity-80">{episode.status === 'COMPLETED' ? '完成' : episode.status === 'FAILED' ? '失败' : `${episode.progress}%`}</span>
            </button>
          ))}
        </div>
        <Button type="button" size="icon-sm" variant="outline" onClick={() => scroll(1)} aria-label="下一集">
          <ChevronRight />
        </Button>
      </div>
    </div>
  )
}

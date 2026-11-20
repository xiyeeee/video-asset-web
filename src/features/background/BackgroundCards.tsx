import { Button } from '@/components/ui/button'
import { formatMediaTime } from '@/features/shots/timeline'
import { personLabel, reviewLabel, subtitleLabel, type BackgroundCard } from './cards'

export function BackgroundCards({
  cards,
  selectedId,
  failedUrl,
  onChoose,
  onReload,
}: {
  cards: BackgroundCard[]
  selectedId: string | null
  failedUrl: string | null
  onChoose: (card: BackgroundCard) => void
  onReload: (imageUrl: string) => void
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {cards.map((card) => (
        <BackgroundCardView
          key={card.assetId}
          card={card}
          selected={card.assetId === selectedId}
          failed={failedUrl === card.imageUrl}
          onChoose={onChoose}
          onReload={onReload}
        />
      ))}
    </div>
  )
}

function BackgroundCardView({
  card,
  selected,
  failed,
  onChoose,
  onReload,
}: {
  card: BackgroundCard
  selected: boolean
  failed: boolean
  onChoose: (card: BackgroundCard) => void
  onReload: (imageUrl: string) => void
}) {
  return (
    <article className={`overflow-hidden rounded-2xl border bg-card ${selected ? 'border-violet-300' : 'border-white/10'}`}>
      {failed ? (
        <div className="flex aspect-video items-center justify-center px-3">
          <Button type="button" variant="outline" onClick={() => onReload(card.imageUrl)}>重新获取图片</Button>
        </div>
      ) : (
        <img
          src={card.imageUrl}
          alt={`镜头 ${card.shotIndex} 背景候选`}
          referrerPolicy="no-referrer"
          className="aspect-video w-full object-cover"
          onError={() => onReload(card.imageUrl)}
        />
      )}
      <div className="space-y-2 p-3">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-medium">镜头 {card.shotIndex}</h3>
          <span className={`rounded-full px-2 py-0.5 text-xs ${card.reviewStatus === 'CLEAN_CANDIDATE' ? 'bg-emerald-400/15 text-emerald-200' : 'bg-amber-300/15 text-amber-100'}`}>
            {reviewLabel(card.reviewStatus)}
          </span>
        </div>
        <p className="text-xs text-muted-foreground">{formatMediaTime(card.startMs)} – {formatMediaTime(card.endMs)}</p>
        <button
          type="button"
          className="text-sm text-violet-200 underline-offset-2 hover:underline"
          onClick={() => onChoose(card)}
        >
          来源时间 {formatMediaTime(card.timestampMs)}
        </button>
        <p className="text-xs text-muted-foreground">{personLabel(card.personStatus)} · {subtitleLabel(card.subtitleStatus)}</p>
      </div>
    </article>
  )
}

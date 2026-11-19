import { toast } from 'sonner'
import { Download } from 'lucide-react'
import { AssetBadge } from '@/components/common/StatusBadge'
import { Waveform } from '@/components/asset/Waveform'
import { VideoPlayer } from '@/components/video/VideoPlayer'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { formatClock } from '@/lib/format'
import { assetTypeLabel, subtypeLabel } from '@/lib/labels'
import type { Asset, Catalog } from '@/types/domain'

function downloadAsset(asset: Asset) {
  const link = document.createElement('a')
  link.href = asset.url
  link.download = asset.name
  link.click()
  toast.success('已开始下载当前演示文件')
}

export function AssetDrawer({
  catalog,
  asset,
  onOpenChange,
}: {
  catalog: Catalog
  asset: Asset | null
  onOpenChange: (open: boolean) => void
}) {
  const project = catalog.projects.find((item) => item.id === asset?.projectId)
  const episode = catalog.episodes.find((item) => item.id === asset?.episodeId)
  const character = catalog.characters.find((item) => item.id === asset?.characterId)
  const visual = asset?.posterUrl || asset?.url
  const isVideo = asset?.type === 'motion' || asset?.type === 'storyboard' || asset?.subtype === 'action'
  const isAudio = asset?.type === 'audio'

  return (
    <Sheet open={Boolean(asset)} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto data-[side=right]:sm:max-w-lg">
        {asset ? (
          <>
            <SheetHeader>
              <SheetTitle>{asset.name}</SheetTitle>
              <SheetDescription>
                {project?.name ?? '未知项目'} · {episode ? `第${episode.episodeNumber}集` : '未知集数'}
              </SheetDescription>
            </SheetHeader>
            <div className="space-y-4 px-4 pb-4">
              {isVideo ? (
                <VideoPlayer src={asset.url} poster={asset.posterUrl} title={asset.name} />
              ) : isAudio ? (
                <div className="rounded-2xl border border-white/10 bg-card p-3">
                  <Waveform url={asset.url} />
                </div>
              ) : visual ? (
                <img src={visual} alt={asset.name} className="w-full rounded-2xl border border-white/10 object-cover" />
              ) : null}
              {asset.note ? <p className="rounded-xl bg-amber-500/10 px-3 py-2 text-sm text-amber-100">{asset.note}</p> : null}
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <dt className="text-muted-foreground">素材类型</dt>
                  <dd>{assetTypeLabel[asset.type]}{asset.subtype ? ` / ${subtypeLabel[asset.subtype] ?? asset.subtype}` : ''}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">处理状态</dt>
                  <dd className="mt-1"><AssetBadge status={asset.status} /></dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">时间戳</dt>
                  <dd>{asset.startTime !== undefined ? `${formatClock(asset.startTime)} - ${formatClock(asset.endTime ?? asset.startTime)}` : '无'}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">文件尺寸</dt>
                  <dd>{asset.width && asset.height ? `${asset.width}×${asset.height}` : asset.fileSize}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">关联角色</dt>
                  <dd>{character?.name ?? '无'}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">关联场景</dt>
                  <dd>{asset.sceneName ?? '无'}</dd>
                </div>
              </dl>
              {asset.text ? <p className="rounded-xl bg-background px-3 py-2 text-sm">{asset.text}</p> : null}
              {asset.novelMatch ? <p className="text-sm text-muted-foreground">原著匹配：{asset.novelMatch}</p> : null}
              <Button type="button" onClick={() => downloadAsset(asset)}>
                <Download />
                下载演示文件
              </Button>
            </div>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  )
}

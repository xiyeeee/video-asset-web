import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { CHARACTER_PAGE_SIZE, characterAssetKey, characterErrorMessage, listCharacterAssets, type CharacterAsset } from '@/services/characters/api'
import type { EpisodeSummary } from '@/services/episodes/api'

export function CharacterSourceDialog({
  open,
  projectId,
  episodes,
  onOpenChange,
  onSelect,
}: {
  open: boolean
  projectId: string
  episodes: EpisodeSummary[]
  onOpenChange: (open: boolean) => void
  onSelect: (asset: CharacterAsset, episode: EpisodeSummary) => void
}) {
  const [episodeId, setEpisodeId] = useState(episodes[0]?.id ?? '')
  const selectedEpisode = episodes.find((episode) => episode.id === episodeId) ?? episodes[0]
  const currentEpisodeId = selectedEpisode?.id ?? ''
  const assets = useQuery({
    queryKey: characterAssetKey(projectId, currentEpisodeId, 1),
    queryFn: ({ signal }) => listCharacterAssets(projectId, currentEpisodeId, 1, CHARACTER_PAGE_SIZE, signal),
    enabled: open && Boolean(projectId && currentEpisodeId),
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>从人物素材选择</DialogTitle>
          <DialogDescription>使用当前项目里已经提取的人物图作为生成来源。</DialogDescription>
        </DialogHeader>
        {episodes.length === 0 ? <p className="text-sm text-muted-foreground">这个项目还没有集数，请先上传视频并提取人物。</p> : (
          <div className="space-y-3">
            <Select value={currentEpisodeId} onValueChange={setEpisodeId}>
              <SelectTrigger className="w-full max-w-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {episodes.map((episode) => (
                  <SelectItem key={episode.id} value={episode.id}>第 {episode.episodeNumber} 集 · {episode.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {assets.isPending ? <p className="text-sm text-muted-foreground">正在读取人物素材…</p> : null}
            {assets.isError ? <p className="text-sm text-rose-300">{characterErrorMessage(assets.error)}</p> : null}
            {assets.data && assets.data.items.length === 0 ? <p className="text-sm text-muted-foreground">这一集还没有人物素材。</p> : null}
            {assets.data && assets.data.items.length > 0 ? (
              <div className="grid max-h-80 grid-cols-3 gap-3 overflow-y-auto sm:grid-cols-4">
                {assets.data.items.map((asset) => (
                  <button
                    key={asset.id}
                    type="button"
                    className="overflow-hidden rounded-xl border border-white/10 bg-background/40 text-left"
                    onClick={() => {
                      if (!selectedEpisode) return
                      onSelect(asset, selectedEpisode)
                      onOpenChange(false)
                    }}
                  >
                    <img src={asset.url} alt="" className="h-28 w-full object-contain" referrerPolicy="no-referrer" />
                    <span className="block truncate px-2 py-1 text-xs text-muted-foreground">人物 {asset.frameCharacterNumber}</span>
                  </button>
                ))}
              </div>
            ) : null}
            {assets.data && assets.data.total > assets.data.items.length ? (
              <p className="text-xs text-muted-foreground">只显示这一集的前 {assets.data.items.length} 张。</p>
            ) : null}
          </div>
        )}
        <div className="flex justify-end">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>关闭</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

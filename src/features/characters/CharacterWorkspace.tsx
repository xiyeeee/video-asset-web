import { useRef, useState } from 'react'
import { EmptyState } from '@/components/common/EmptyState'
import { VideoPlayer } from '@/components/video/VideoPlayer'
import { Button } from '@/components/ui/button'
import { useEpisodePlayback } from '@/features/episodes/use-episodes'
import { episodeErrorMessage } from '@/services/episodes/api'
import { CharacterExtractionPanel } from './CharacterExtractionPanel'
import { CharacterGallery } from './CharacterGallery'

export function CharacterWorkspace({
  projectId,
  episodeId,
  title,
  contentType,
}: {
  projectId: string
  episodeId: string
  title: string
  contentType?: string
}) {
  const seekToken = useRef(0)
  const [seekTo, setSeekTo] = useState<{ id: number; seconds: number } | null>(null)
  const seek = (timestampMs: number) => {
    seekToken.current += 1
    setSeekTo({ id: seekToken.current, seconds: timestampMs / 1000 })
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
      <div className="space-y-4">
        <CharacterPreview projectId={projectId} episodeId={episodeId} title={title} contentType={contentType} seekTo={seekTo} />
        <CharacterExtractionPanel projectId={projectId} episodeId={episodeId} />
      </div>
      <div className="space-y-3">
        <h2 className="font-medium">人物素材</h2>
        <CharacterGallery projectId={projectId} episodeId={episodeId} onSeek={seek} />
      </div>
    </div>
  )
}

function CharacterPreview({
  projectId,
  episodeId,
  title,
  contentType,
  seekTo,
}: {
  projectId: string
  episodeId: string
  title: string
  contentType?: string
  seekTo: { id: number; seconds: number } | null
}) {
  const playback = useEpisodePlayback(projectId, episodeId)
  const [failedUrl, setFailedUrl] = useState<string | null>(null)
  const refreshing = useRef(false)
  const url = playback.data?.url
  if (playback.isPending) return <p className="text-sm text-muted-foreground">正在获取原视频…</p>
  if (playback.isError || !url || failedUrl === url) {
    return (
      <EmptyState
        title="暂时无法预览原视频"
        description={playback.isError ? episodeErrorMessage(playback.error) : '播放地址已失效，请重新获取。'}
        action={<Button onClick={() => { setFailedUrl(null); void playback.refetch() }}>重新获取</Button>}
      />
    )
  }
  return (
    <VideoPlayer
      src={url}
      type={contentType ?? 'video/mp4'}
      title={title}
      caption="正在播放已保存的原视频。"
      seekTo={seekTo}
      onError={() => {
        if (refreshing.current) {
          setFailedUrl(url)
          return
        }
        refreshing.current = true
        void playback.refetch().finally(() => {
          refreshing.current = false
        })
      }}
    />
  )
}

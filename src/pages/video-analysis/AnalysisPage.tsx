import { useRef, useState } from 'react'
import { Link } from 'react-router'
import { EmptyState, PageSkeleton } from '@/components/common/EmptyState'
import { VideoPlayer } from '@/components/video/VideoPlayer'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { AnalysisPanel } from '@/features/analysis/AnalysisPanel'
import { FrameGallery } from '@/features/analysis/FrameGallery'
import { useMediaTarget } from '@/features/analysis/use-media-target'
import { useEpisodePlayback } from '@/features/episodes/use-episodes'
import { episodeErrorMessage } from '@/services/episodes/api'

export function AnalysisPage() {
  const target = useMediaTarget()
  if (target.projects.isLoading) return <PageSkeleton />
  if (target.projects.isError || !target.projects.data) {
    return <EmptyState title="项目列表加载失败" description="请检查网络后重新读取可解析的项目。" action={<Button onClick={() => void target.projects.refetch()}>重试</Button>} />
  }
  if (!target.projectId) {
    return <EmptyState title="还没有可解析的项目" description="先创建一个项目并上传 MP4。" action={<Button asChild><Link to="/projects">前往项目管理</Link></Button>} />
  }

  const projectId = target.projectId
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Select value={projectId} onValueChange={target.setProject}>
          <SelectTrigger className="w-64"><SelectValue /></SelectTrigger>
          <SelectContent>
            {target.project && !target.projects.data.items.some((item) => item.id === projectId) ? (
              <SelectItem value={projectId}>{target.project.name}</SelectItem>
            ) : null}
            {target.projects.data.items.map((project) => <SelectItem key={project.id} value={project.id}>{project.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <p className="text-sm text-muted-foreground">{target.project?.description || '选择已上传的集数后开始首帧解析。'}</p>
      </div>
      {target.episodes.isLoading ? <p className="text-sm text-muted-foreground">正在读取集数…</p> : null}
      {target.episodes.isError ? (
        <EmptyState title="集数加载失败" description={episodeErrorMessage(target.episodes.error)} action={<Button onClick={() => void target.episodes.refetch()}>重试</Button>} />
      ) : null}
      {target.episodes.data && target.episodes.data.items.length === 0 ? (
        <EmptyState title="这个项目还没有集数" description="先上传一份 MP4，再回来解析。" action={<Button asChild><Link to={`/projects/${projectId}`}>去上传</Link></Button>} />
      ) : null}
      {target.episodes.data && target.episodes.data.items.length > 0 ? (
        <div className="flex gap-2 overflow-x-auto">
          {target.episodes.data.items.map((episode) => (
            <button
              key={episode.id}
              type="button"
              className={`shrink-0 rounded-full border px-3 py-1.5 text-sm ${episode.id === target.episodeId ? 'border-primary bg-primary text-primary-foreground' : 'border-white/10 bg-card'}`}
              onClick={() => target.setEpisode(episode.id)}
            >
              第 {episode.episodeNumber} 集
            </button>
          ))}
        </div>
      ) : null}
      {target.episodeId ? <EpisodeAnalysis projectId={projectId} episodeId={target.episodeId} title={target.episode?.title ?? '原视频'} /> : null}
    </div>
  )
}

function EpisodeAnalysis({ projectId, episodeId, title }: { projectId: string; episodeId: string; title: string }) {
  return (
    <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
      <div className="space-y-4">
        <OriginalPreview projectId={projectId} episodeId={episodeId} title={title} />
        <AnalysisPanel projectId={projectId} episodeId={episodeId} />
      </div>
      <div className="space-y-3">
        <h2 className="font-medium">首帧分镜</h2>
        <FrameGallery projectId={projectId} episodeId={episodeId} />
      </div>
    </div>
  )
}

function OriginalPreview({ projectId, episodeId, title }: { projectId: string; episodeId: string; title: string }) {
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
      type="video/mp4"
      title={title}
      caption="正在播放已保存的原视频。"
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

import { Link, useSearchParams } from 'react-router'
import { EmptyState, PageSkeleton } from '@/components/common/EmptyState'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { FrameGallery } from '@/features/analysis/FrameGallery'
import { useMediaTarget } from '@/features/analysis/use-media-target'
import { CharacterWorkspace } from '@/features/characters/CharacterWorkspace'
import { episodeErrorMessage } from '@/services/episodes/api'

export function AssetLibraryPage() {
  const target = useMediaTarget()
  const [params, setParams] = useSearchParams()
  const tab = params.get('tab') === 'characters' ? 'characters' : 'frames'
  const setTab = (value: string) => {
    setParams((current) => {
      const next = new URLSearchParams(current)
      if (value === 'characters') next.set('tab', 'characters')
      else next.delete('tab')
      return next
    }, { replace: true })
  }
  if (target.projects.isLoading) return <PageSkeleton />
  if (target.projects.isError || !target.projects.data) {
    return <EmptyState title="素材库加载失败" description="请检查网络后重新读取项目。" action={<Button onClick={() => void target.projects.refetch()}>重试</Button>} />
  }
  if (!target.projectId) {
    return <EmptyState title="还没有可查看的分镜" description="创建项目并完成首帧解析后，图片会显示在这里。" action={<Button asChild><Link to="/projects">前往项目管理</Link></Button>} />
  }

  const projectId = target.projectId
  return (
    <div className="space-y-4">
      <section className="flex flex-wrap items-center gap-4 rounded-2xl border border-white/10 bg-card p-4">
        <div className="min-w-0 flex-1">
          <Select value={projectId} onValueChange={target.setProject}>
            <SelectTrigger className="w-full max-w-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {target.project && !target.projects.data.items.some((item) => item.id === projectId) ? (
                <SelectItem value={projectId}>{target.project.name}</SelectItem>
              ) : null}
              {target.projects.data.items.map((project) => <SelectItem key={project.id} value={project.id}>{project.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <p className="mt-1 text-sm text-muted-foreground">{target.project?.description || '按集查看已提取的首帧和人物素材。'}</p>
        </div>
        {target.episodeId ? (
          <Button variant="outline" asChild><Link to={`/analysis?project=${projectId}&episode=${target.episodeId}`}>查看解析</Link></Button>
        ) : null}
      </section>
      {target.episodes.isLoading ? <p className="text-sm text-muted-foreground">正在读取集数…</p> : null}
      {target.episodes.isError ? (
        <EmptyState title="集数加载失败" description={episodeErrorMessage(target.episodes.error)} action={<Button onClick={() => void target.episodes.refetch()}>重试</Button>} />
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
      {target.episodes.data && target.episodes.data.items.length === 0 ? (
        <EmptyState title="这个项目还没有集数" description="上传视频并完成解析后，才能看到分镜。" action={<Button asChild><Link to={`/projects/${projectId}`}>去上传</Link></Button>} />
      ) : null}
      {target.episodeId ? (
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="frames">分镜</TabsTrigger>
            <TabsTrigger value="characters">人物</TabsTrigger>
          </TabsList>
          <TabsContent value="frames">
            <FrameGallery projectId={projectId} episodeId={target.episodeId} />
          </TabsContent>
          <TabsContent value="characters">
            <CharacterWorkspace
              key={`${projectId}:${target.episodeId}`}
              projectId={projectId}
              episodeId={target.episodeId}
              title={target.episode?.title ?? '原视频'}
              contentType={target.episode?.contentType}
            />
          </TabsContent>
        </Tabs>
      ) : null}
    </div>
  )
}

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
import { AudioAssets } from '@/features/assets/AudioAssets'
import { BackgroundAssets } from '@/features/assets/BackgroundAssets'
import { CharacterAssets } from '@/features/assets/CharacterAssets'
import { DialogueAssets } from '@/features/assets/DialogueAssets'
import { ShotAssets } from '@/features/assets/ShotAssets'
import { StoryAssets } from '@/features/assets/StoryAssets'
import { useMediaTarget } from '@/features/analysis/use-media-target'
import { episodeErrorMessage } from '@/services/episodes/api'

const assetTabs = ['shots', 'characters', 'dialogue', 'background', 'audio', 'story'] as const

type AssetTab = (typeof assetTabs)[number]

const tabLabel: Record<AssetTab, string> = {
  shots: '分镜',
  characters: '人物',
  dialogue: '对话',
  background: '背景',
  audio: '音频',
  story: '剧情',
}

const resolveTab = (value: string | null): AssetTab => {
  if (value === 'frames') return 'shots'
  return assetTabs.find((item) => item === value) ?? 'shots'
}

export function AssetLibraryPage() {
  const target = useMediaTarget()
  const [params, setParams] = useSearchParams()
  const tab = resolveTab(params.get('tab'))
  const setTab = (value: string) => {
    setParams((current) => {
      const next = new URLSearchParams(current)
      if (value === 'shots') next.delete('tab')
      else next.set('tab', value)
      return next
    }, { replace: true })
  }
  if (target.projects.isLoading) return <PageSkeleton />
  if (target.projects.isError || !target.projects.data) {
    return <EmptyState title="素材库加载失败" description="请检查网络后重新读取项目。" action={<Button onClick={() => void target.projects.refetch()}>重试</Button>} />
  }
  if (!target.projectId) {
    return <EmptyState title="还没有可查看的素材" description="创建项目并上传视频后，提取结果会显示在这里。" action={<Button asChild><Link to="/projects">前往项目管理</Link></Button>} />
  }

  const projectId = target.projectId
  const episodeLabel = target.episode ? `第 ${target.episode.episodeNumber} 集` : undefined
  return (
    <div className="flex flex-col gap-4 xl:h-[calc(100svh-7rem)] xl:min-h-0">
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
          <p className="mt-1 text-sm text-muted-foreground">{target.project?.description || '按集查看已经提取的素材。'}</p>
        </div>
        <Button variant="outline" asChild><Link to="/tasks">任务中心</Link></Button>
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
        <EmptyState title="这个项目还没有集数" description="上传视频后，提取结果会按类型出现在这里。" action={<Button asChild><Link to={`/projects/${projectId}`}>去上传</Link></Button>} />
      ) : null}
      {target.episodeId ? (
        <Tabs value={tab} onValueChange={setTab} className="xl:min-h-0 xl:flex-1">
          <TabsList className="max-w-full overflow-x-auto">
            {assetTabs.map((item) => <TabsTrigger key={item} value={item}>{tabLabel[item]}</TabsTrigger>)}
          </TabsList>
          <TabsContent value="shots" className="xl:min-h-0 xl:flex-1 xl:overflow-auto">
            <ShotAssets key={target.episodeId} projectId={projectId} episodeId={target.episodeId} />
          </TabsContent>
          <TabsContent value="characters" className="xl:min-h-0 xl:flex-1 xl:overflow-hidden">
            <CharacterAssets projectId={projectId} episodeId={target.episodeId} episodeLabel={episodeLabel} />
          </TabsContent>
          <TabsContent value="dialogue" className="xl:min-h-0 xl:flex-1 xl:overflow-auto">
            <DialogueAssets projectId={projectId} episodeId={target.episodeId} />
          </TabsContent>
          <TabsContent value="background"><BackgroundAssets /></TabsContent>
          <TabsContent value="audio">{target.episodeId ? <AudioAssets episodeId={target.episodeId} /> : null}</TabsContent>
          <TabsContent value="story"><StoryAssets /></TabsContent>
        </Tabs>
      ) : null}
    </div>
  )
}

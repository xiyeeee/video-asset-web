import { Link } from 'react-router'
import { toast } from 'sonner'
import { EpisodeSwitcher } from '@/components/common/EpisodeSwitcher'
import { EmptyState, PageSkeleton } from '@/components/common/EmptyState'
import { AnalysisBadge } from '@/components/common/StatusBadge'
import { VideoPlayer } from '@/components/video/VideoPlayer'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useCatalog, usePublishCatalog } from '@/hooks/use-catalog'
import { useSelection } from '@/hooks/use-selection'
import { formatClock, formatTime } from '@/lib/format'
import { assetTypeLabel, assetTypeOrder } from '@/lib/labels'
import { retryAnalysis, startAnalysis } from '@/services/mock/catalog'
import { assetsOfEpisode, countByType } from '@/services/view'
import type { AnalysisStatus } from '@/types/domain'

const stepLabels = ['视频上传', '内容解析', '素材提取', '完成']

function stepState(status: AnalysisStatus, index: number) {
  const activeIndex: Record<AnalysisStatus, number> = {
    PENDING: -1,
    UPLOADING: 0,
    QUEUED: 0,
    ANALYZING: 1,
    EXTRACTING: 2,
    COMPLETED: 4,
    FAILED: 1,
  }
  if (status === 'FAILED' && index === 1) return 'failed'
  if (index < activeIndex[status]) return 'done'
  if (index === activeIndex[status]) return 'active'
  return 'pending'
}

export function AnalysisPage() {
  const { data, isLoading, isError, refetch } = useCatalog()
  const publish = usePublishCatalog()
  const selection = useSelection(data)
  if (isLoading) return <PageSkeleton />
  if (isError || !data || !selection.project) {
    return <EmptyState title="解析页加载失败" description="请重新读取演示数据。" action={<Button onClick={() => void refetch()}>重试</Button>} />
  }
  const episode = selection.episode ?? selection.episodes.find((item) => item.status !== 'PENDING') ?? selection.episodes[0]
  const assets = episode ? assetsOfEpisode(data, episode.id) : []

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Select value={selection.project.id} onValueChange={selection.setProject}>
          <SelectTrigger className="w-64"><SelectValue /></SelectTrigger>
          <SelectContent>
            {data.projects.map((project) => <SelectItem key={project.id} value={project.id}>{project.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <p className="text-sm text-muted-foreground">选择项目和集数后查看模拟解析。这里不会调用真实 AI。</p>
      </div>
      <EpisodeSwitcher episodes={selection.episodes} value={episode?.id ?? 'all'} onChange={selection.setEpisode} />
      {!episode ? <EmptyState title="这个项目还没有集数" description="先到项目管理上传视频。" action={<Button asChild><Link to={`/projects/${selection.project.id}`}>去上传</Link></Button>} /> : null}
      {episode ? (
        <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-4">
            <VideoPlayer src={episode.videoUrl} poster={episode.posterUrl} title={`${selection.project.name} ${episode.title}`} />
            <article className="rounded-2xl border border-white/10 bg-card p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h2 className="font-medium">解析步骤</h2>
                <AnalysisBadge status={episode.status} />
              </div>
              <div className="grid grid-cols-4 gap-2">
                {stepLabels.map((label, index) => {
                  const state = stepState(episode.status, index)
                  return (
                    <div key={label} className={`rounded-xl px-2 py-3 text-center text-sm ${state === 'done' ? 'bg-emerald-500/15 text-emerald-200' : state === 'active' ? 'bg-primary/20 text-violet-100' : state === 'failed' ? 'bg-rose-500/15 text-rose-200' : 'bg-background text-muted-foreground'}`}>
                      {label}
                    </div>
                  )
                })}
              </div>
              <Progress className="mt-4 h-2" value={episode.progress} />
              <p className="mt-2 text-sm text-muted-foreground">进度 {episode.progress}% {episode.errorMessage ? `· ${episode.errorMessage}` : ''}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {episode.status === 'FAILED' ? <Button onClick={() => { retryAnalysis(episode.id); publish(); toast.success('已重新开始解析') }}>重试</Button> : null}
                {episode.status === 'QUEUED' || episode.status === 'PENDING' ? <Button onClick={() => { startAnalysis(episode.id); publish(); toast.success('已开始模拟解析') }}>开始解析</Button> : null}
                <Button variant="outline" asChild><Link to={`/assets?project=${selection.project.id}&episode=${episode.id}`}>前往素材库</Link></Button>
              </div>
            </article>
          </div>
          <div className="space-y-4">
            <article className="rounded-2xl border border-white/10 bg-card p-4">
              <h2 className="mb-3 font-medium">本集素材统计</h2>
              <div className="grid grid-cols-2 gap-2">
                {assetTypeOrder.map((type) => (
                  <div key={type} className="rounded-xl bg-background px-3 py-2">
                    <p className="text-xs text-muted-foreground">{assetTypeLabel[type]}</p>
                    <p className="text-xl font-semibold">{assets.filter((item) => item.type === type).length}</p>
                  </div>
                ))}
              </div>
              <p className="mt-3 text-sm text-muted-foreground">项目内同类型合计 {countByType(data, selection.project.id, 'all')} 项。角色跨集共用同一档案。</p>
            </article>
            <article className="max-h-[420px] overflow-auto rounded-2xl border border-white/10 bg-card p-4">
              <h2 className="mb-3 font-medium">解析日志</h2>
              <ul className="space-y-2">
                {episode.logs.map((item) => (
                  <li key={item.id} className="rounded-xl bg-background px-3 py-2 text-sm">
                    <span className="text-muted-foreground">{formatTime(item.time)}</span>
                    <span className={item.level === 'error' ? 'text-rose-300' : ''}> · {item.message}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-xs text-muted-foreground">时长显示为叙事时长 {formatClock(episode.duration)}，播放器使用可预览的演示文件。</p>
            </article>
          </div>
        </div>
      ) : null}
    </div>
  )
}

import { useState } from 'react'
import { Link } from 'react-router'
import { ArrowDown, ArrowUp } from 'lucide-react'
import { toast } from 'sonner'
import { EpisodeSwitcher } from '@/components/common/EpisodeSwitcher'
import { EmptyState, PageSkeleton } from '@/components/common/EmptyState'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useCatalog, usePublishCatalog } from '@/hooks/use-catalog'
import { useSelection } from '@/hooks/use-selection'
import { formatClock } from '@/lib/format'
import { moveStory, updateStory } from '@/services/mock/catalog'
import type { StoryLine } from '@/types/domain'

export function StoryPage() {
  const { data, isLoading, isError, refetch } = useCatalog()
  const publish = usePublishCatalog()
  const selection = useSelection(data)
  const episode = selection.episode ?? selection.episodes[0]
  const lines = (data?.storyLines ?? [])
    .filter((line) => line.episodeId === episode?.id)
    .sort((a, b) => a.order - b.order)
  const lineSignature = lines.map((line) => `${line.id}:${line.order}:${line.text}:${line.characterId}:${line.sceneName}`).join('|')
  const [drafts, setDrafts] = useState<StoryLine[]>(lines)
  const [activeId, setActiveId] = useState<string | null>(lines[0]?.id ?? null)
  const [signature, setSignature] = useState(lineSignature)
  if (signature !== lineSignature) {
    setSignature(lineSignature)
    setDrafts(lines)
    setActiveId(lines[0]?.id ?? null)
  }

  if (isLoading) return <PageSkeleton />
  if (isError || !data || !selection.project) {
    return <EmptyState title="剧情脚本加载失败" description="请重新读取演示数据。" action={<Button onClick={() => void refetch()}>重试</Button>} />
  }
  const project = selection.project

  const active = drafts.find((line) => line.id === activeId) ?? drafts[0]
  const payload = {
    projectId: project.id,
    episodeId: episode?.id ?? null,
    nodes: drafts.map((line) => ({
      type: 'dialogue',
      id: line.id,
      order: line.order,
      speakerId: line.characterId,
      scene: line.sceneName,
      text: line.text,
      start: line.startTime,
      end: line.endTime,
    })),
  }

  const patch = (id: string, partial: Partial<StoryLine>) => {
    setDrafts((current) => current.map((line) => (line.id === id ? { ...line, ...partial } : line)))
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Select value={selection.project.id} onValueChange={selection.setProject}>
          <SelectTrigger className="w-64"><SelectValue /></SelectTrigger>
          <SelectContent>{data.projects.map((project) => <SelectItem key={project.id} value={project.id}>{project.name}</SelectItem>)}</SelectContent>
        </Select>
        <Button variant="outline" asChild><Link to={`/analysis?project=${project.id}&episode=${episode?.id ?? 'all'}`}>查看对应视频</Link></Button>
      </div>
      <EpisodeSwitcher episodes={selection.episodes} value={episode?.id ?? 'all'} onChange={selection.setEpisode} />
      {!episode || drafts.length === 0 ? (
        <EmptyState title="这一集还没有可编辑台词" description="解析完成的集数会生成台词。排队或失败的集数需要先完成解析。" />
      ) : (
        <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-3">
            {drafts.map((line, index) => {
              const speaker = selection.characters.find((item) => item.id === line.characterId)
              return (
                <article key={line.id} className={`rounded-2xl border p-3 ${active?.id === line.id ? 'border-primary bg-primary/10' : 'border-white/10 bg-card'}`}>
                  <button type="button" className="mb-2 text-left text-sm text-muted-foreground" onClick={() => setActiveId(line.id)}>
                    {line.sceneName} · {speaker?.name ?? '未指定'} · {formatClock(line.startTime)}-{formatClock(line.endTime)}
                  </button>
                  <div className="grid gap-2 md:grid-cols-[160px_1fr]">
                    <Select value={line.characterId} onValueChange={(value) => patch(line.id, { characterId: value })}>
                      <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                      <SelectContent>{selection.characters.map((character) => <SelectItem key={character.id} value={character.id}>{character.name}</SelectItem>)}</SelectContent>
                    </Select>
                    <Textarea value={line.text} onChange={(event) => patch(line.id, { text: event.target.value })} />
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <Input className="max-w-40" value={line.sceneName} onChange={(event) => patch(line.id, { sceneName: event.target.value })} aria-label="场景名" />
                    <Button size="icon-sm" variant="outline" disabled={index === 0} onClick={() => { moveStory(line.id, -1); publish() }} aria-label="上移"><ArrowUp /></Button>
                    <Button size="icon-sm" variant="outline" disabled={index === drafts.length - 1} onClick={() => { moveStory(line.id, 1); publish() }} aria-label="下移"><ArrowDown /></Button>
                    <Button size="sm" variant="outline" asChild>
                      <Link to={`/analysis?project=${project.id}&episode=${episode.id}`}>定位视频 {formatClock(line.startTime)}</Link>
                    </Button>
                  </div>
                </article>
              )
            })}
            <Button onClick={() => {
              updateStory(drafts.map((line) => ({ id: line.id, text: line.text, characterId: line.characterId, sceneName: line.sceneName })))
              publish()
              toast.success('剧情台词已保存')
            }}>保存台词</Button>
          </div>
          <div className="space-y-4">
            <article className="rounded-2xl border border-white/10 bg-card p-4">
              <h2 className="mb-2 font-medium">原著参考</h2>
              <p className="whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{project.novelText || '还没有导入原著。可以在项目管理中导入 TXT。'}</p>
            </article>
            <article className="rounded-2xl border border-white/10 bg-card p-4">
              <h2 className="mb-2 font-medium">剧情 JSON</h2>
              <pre className="max-h-80 overflow-auto rounded-xl bg-background p-3 text-xs">{JSON.stringify(payload, null, 2)}</pre>
            </article>
            <article className="rounded-2xl border border-dashed border-white/15 bg-panel p-4">
              <h2 className="mb-2 font-medium">后续扩展</h2>
              <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
                {['剧情分支', '玩家选项', '双人角色视角', '游戏事件节点'].map((item) => (
                  <span key={item} className="rounded-full border border-white/10 px-3 py-1">{item} · 即将推出</span>
                ))}
              </div>
            </article>
          </div>
        </div>
      )}
    </div>
  )
}

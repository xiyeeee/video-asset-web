import { useEffect } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { EpisodeSwitcher } from '@/components/common/EpisodeSwitcher'
import { EmptyState, PageSkeleton } from '@/components/common/EmptyState'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
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
import { formatDateTime } from '@/lib/format'
import { assetTypeLabel, assetTypeOrder, exportFormatLabel } from '@/lib/labels'
import { buildExportDocument, createExport } from '@/services/mock/catalog'
import type { AssetType, ExportFormat, ExportJob } from '@/types/domain'

const schema = z.object({
  projectId: z.string().min(1, '请选择项目'),
  episodeId: z.string().min(1),
  types: z.array(z.enum(['character', 'scene', 'dialogue', 'audio', 'motion', 'storyboard'])).min(1, '至少选择一种素材'),
  includeRaw: z.boolean(),
  includeJson: z.boolean(),
  format: z.enum(['files', 'story-json', 'unity']),
})

type ExportValues = z.infer<typeof schema>

function downloadJob(job: ExportJob) {
  const documentJson = buildExportDocument(job)
  const blob = new Blob([JSON.stringify(documentJson, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = job.fileName
  link.click()
  URL.revokeObjectURL(url)
  toast.success('已下载演示清单，里面只有元数据')
}

export function ExportPage() {
  const { data, isLoading, isError, refetch } = useCatalog()
  const publish = usePublishCatalog()
  const selection = useSelection(data)
  const form = useForm<ExportValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      projectId: selection.project?.id ?? '',
      episodeId: selection.episodeId,
      types: ['character', 'scene', 'dialogue', 'audio'],
      includeRaw: false,
      includeJson: true,
      format: 'unity',
    },
  })
  const projectId = useWatch({ control: form.control, name: 'projectId' })
  const episodeId = useWatch({ control: form.control, name: 'episodeId' })
  const format = useWatch({ control: form.control, name: 'format' })
  const types = useWatch({ control: form.control, name: 'types' })
  const includeRaw = useWatch({ control: form.control, name: 'includeRaw' })
  const includeJson = useWatch({ control: form.control, name: 'includeJson' })

  const projectIdFromUrl = selection.project?.id
  useEffect(() => {
    if (projectIdFromUrl) form.setValue('projectId', projectIdFromUrl)
    if (selection.episodeId) form.setValue('episodeId', selection.episodeId)
  }, [form, projectIdFromUrl, selection.episodeId])

  if (isLoading) return <PageSkeleton />
  if (isError || !data || !selection.project) {
    return <EmptyState title="导出中心加载失败" description="请重新读取演示数据。" action={<Button onClick={() => void refetch()}>重试</Button>} />
  }
  const currentProjectId = projectId || selection.project.id

  const jobs = data.exportJobs.filter((job) => job.projectId === currentProjectId)
  const episodes = data.episodes.filter((item) => item.projectId === currentProjectId)

  const submit = form.handleSubmit((values) => {
    createExport(values)
    publish()
    toast.success('已创建演示导出任务')
  })

  const toggleType = (type: AssetType, checked: boolean) => {
    const next = checked ? [...types, type] : types.filter((item) => item !== type)
    form.setValue('types', next, { shouldValidate: true })
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
      <form className="space-y-4 rounded-2xl border border-white/10 bg-card p-4" onSubmit={submit}>
        <div className="space-y-1.5">
          <Label>项目</Label>
          <Select value={projectId} onValueChange={(value) => { form.setValue('projectId', value); selection.setProject(value) }}>
            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>{data.projects.map((project) => <SelectItem key={project.id} value={project.id}>{project.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <EpisodeSwitcher episodes={episodes} value={episodeId || 'all'} onChange={(value) => { form.setValue('episodeId', value); selection.setEpisode(value) }} />
        <fieldset className="space-y-2">
          <legend className="text-sm">素材类型</legend>
          {assetTypeOrder.map((type) => (
            <label key={type} className="flex items-center gap-2 text-sm">
              <Checkbox checked={types.includes(type)} onCheckedChange={(checked) => toggleType(type, checked === true)} />
              {assetTypeLabel[type]}
            </label>
          ))}
          <p className="text-xs text-rose-300">{form.formState.errors.types?.message}</p>
        </fieldset>
        <label className="flex items-center gap-2 text-sm"><Checkbox checked={includeRaw} onCheckedChange={(checked) => form.setValue('includeRaw', checked === true)} />包含原始提取和处理中的素材</label>
        <label className="flex items-center gap-2 text-sm"><Checkbox checked={includeJson} onCheckedChange={(checked) => form.setValue('includeJson', checked === true)} />包含剧情 JSON 元数据</label>
        <div className="space-y-1.5">
          <Label>导出格式</Label>
          <Select value={format} onValueChange={(value: ExportFormat) => form.setValue('format', value)}>
            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              {(Object.keys(exportFormatLabel) as ExportFormat[]).map((item) => <SelectItem key={item} value={item}>{exportFormatLabel[item]}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <Button type="submit">创建导出任务</Button>
        <p className="text-xs text-muted-foreground">任务进度是模拟的。完成后下载的 JSON 只描述演示数据，不会伪装成真实素材包。</p>
      </form>
      <section className="space-y-3">
        {jobs.length === 0 ? <EmptyState title="还没有导出任务" description="选择范围后创建一条演示任务。" /> : null}
        {jobs.map((job) => (
          <article key={job.id} className="rounded-2xl border border-white/10 bg-card p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="font-medium">{job.fileName}</h2>
                <p className="text-xs text-muted-foreground">{formatDateTime(job.createdAt)} · {exportFormatLabel[job.format]} · {job.episodeId === 'all' ? '全部集数' : '单集'}</p>
              </div>
              <span className="text-sm text-violet-200">{job.status === 'completed' ? '已完成' : job.status === 'running' ? '生成中' : job.status}</span>
            </div>
            <Progress className="mt-3 h-2" value={job.progress} />
            <div className="mt-3">
              <Button type="button" disabled={job.status !== 'completed'} onClick={() => downloadJob(job)}>下载演示清单</Button>
            </div>
          </article>
        ))}
      </section>
    </div>
  )
}

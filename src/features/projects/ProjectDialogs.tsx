import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { addUploadedEpisodes, createProject, importNovel, updateProject } from '@/services/mock/catalog'
import type { Project } from '@/types/domain'

const projectSchema = z.object({
  name: z.string().trim().min(2, '项目名称至少 2 个字').max(30, '项目名称不超过 30 个字'),
  description: z.string().trim().min(4, '请补充项目简介').max(200, '简介不超过 200 个字'),
})

type ProjectFormValues = z.infer<typeof projectSchema>

export function ProjectFormDialog({
  open,
  project,
  onOpenChange,
  onSaved,
}: {
  open: boolean
  project?: Project
  onOpenChange: (open: boolean) => void
  onSaved: (projectId: string) => void
}) {
  const form = useForm<ProjectFormValues>({
    resolver: zodResolver(projectSchema),
    defaultValues: { name: project?.name ?? '', description: project?.description ?? '' },
  })

  useEffect(() => {
    if (open) form.reset({ name: project?.name ?? '', description: project?.description ?? '' })
  }, [form, open, project])

  const submit = form.handleSubmit((values) => {
    if (project) {
      updateProject(project.id, values)
      toast.success('项目已更新')
      onSaved(project.id)
    } else {
      const created = createProject(values)
      toast.success('项目已创建')
      onSaved(created.id)
    }
    onOpenChange(false)
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{project ? '编辑项目' : '新建项目'}</DialogTitle>
          <DialogDescription>项目对应一部漫剧。视频、角色和素材都会挂在项目下面。</DialogDescription>
        </DialogHeader>
        <form className="space-y-3" onSubmit={submit}>
          <div className="space-y-1.5">
            <Label htmlFor="project-name">项目名称</Label>
            <Input id="project-name" {...form.register('name')} />
            <p className="text-xs text-rose-300">{form.formState.errors.name?.message}</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="project-description">项目简介</Label>
            <Textarea id="project-description" rows={4} {...form.register('description')} />
            <p className="text-xs text-rose-300">{form.formState.errors.description?.message}</p>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              取消
            </Button>
            <Button type="submit">{project ? '保存' : '创建'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  onOpenChange,
  onConfirm,
}: {
  open: boolean
  title: string
  description: string
  confirmLabel: string
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={() => {
              onConfirm()
              onOpenChange(false)
            }}
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function readDuration(file: File) {
  return new Promise<number>((resolve) => {
    const url = URL.createObjectURL(file)
    const video = document.createElement('video')
    video.preload = 'metadata'
    video.onloadedmetadata = () => {
      const duration = Number.isFinite(video.duration) ? video.duration : 0
      URL.revokeObjectURL(url)
      resolve(duration)
    }
    video.onerror = () => {
      URL.revokeObjectURL(url)
      resolve(0)
    }
    video.src = url
  })
}

export function UploadDialog({
  open,
  projects,
  defaultProjectId,
  multiple,
  onOpenChange,
  onUploaded,
}: {
  open: boolean
  projects: Project[]
  defaultProjectId?: string
  multiple: boolean
  onOpenChange: (open: boolean) => void
  onUploaded: (projectId: string, episodeId: string) => void
}) {
  const [projectId, setProjectId] = useState(defaultProjectId ?? projects[0]?.id ?? '')
  const [files, setFiles] = useState<File[]>([])
  const [wasOpen, setWasOpen] = useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) {
      setProjectId(defaultProjectId ?? projects[0]?.id ?? '')
      setFiles([])
    }
  }

  const submit = async () => {
    if (!projectId) {
      toast.error('请先选择项目')
      return
    }
    if (files.length === 0) {
      toast.error('请选择视频文件')
      return
    }
    const payload = await Promise.all(
      files.map(async (file) => ({
        name: file.name,
        url: URL.createObjectURL(file),
        duration: await readDuration(file),
      })),
    )
    const created = addUploadedEpisodes(projectId, payload)
    toast.success(`已加入 ${created.length} 集本地演示队列`)
    onOpenChange(false)
    const first = created[0]
    if (first) onUploaded(projectId, first.id)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{multiple ? '批量上传视频' : '上传单集视频'}</DialogTitle>
          <DialogDescription>文件只保存在当前浏览器会话，用于预览和模拟解析，不会发送到服务器。</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>项目</Label>
            <Select value={projectId} onValueChange={setProjectId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="选择项目" />
              </SelectTrigger>
              <SelectContent>
                {projects.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="video-files">视频文件</Label>
            <Input
              id="video-files"
              type="file"
              accept="video/*"
              multiple={multiple}
              onChange={(event) => setFiles([...(event.target.files ?? [])])}
            />
            <p className="text-xs text-muted-foreground">{files.length > 0 ? `已选择 ${files.length} 个文件` : '支持 mp4、webm 等浏览器可播放的视频'}</p>
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button type="button" onClick={() => void submit()}>
            加入队列
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function NovelDialog({
  open,
  projects,
  defaultProjectId,
  onOpenChange,
  onImported,
}: {
  open: boolean
  projects: Project[]
  defaultProjectId?: string
  onOpenChange: (open: boolean) => void
  onImported: (projectId: string) => void
}) {
  const [projectId, setProjectId] = useState(defaultProjectId ?? projects[0]?.id ?? '')
  const [file, setFile] = useState<File | null>(null)
  const [wasOpen, setWasOpen] = useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) {
      setProjectId(defaultProjectId ?? projects[0]?.id ?? '')
      setFile(null)
    }
  }

  const submit = async () => {
    if (!projectId || !file) {
      toast.error('请选择项目和 TXT 文件')
      return
    }
    if (!file.name.toLowerCase().endsWith('.txt')) {
      toast.error('请上传 TXT 文本')
      return
    }
    const text = await file.text()
    if (!text.trim()) {
      toast.error('小说文件是空的')
      return
    }
    importNovel(projectId, file.name, text)
    toast.success('原著已导入到项目')
    onOpenChange(false)
    onImported(projectId)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>导入原著小说</DialogTitle>
          <DialogDescription>文本会用于台词对照和剧情脚本参考，只保存在本次会话。</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>项目</Label>
            <Select value={projectId} onValueChange={setProjectId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="选择项目" />
              </SelectTrigger>
              <SelectContent>
                {projects.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="novel-file">TXT 文件</Label>
            <Input id="novel-file" type="file" accept=".txt,text/plain" onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button type="button" onClick={() => void submit()}>
            导入
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

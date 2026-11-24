import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { ImageIcon, PersonStanding } from 'lucide-react'
import { EmptyState, PageSkeleton } from '@/components/common/EmptyState'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { AuthError, isCancelled } from '@/features/auth/auth-api'
import { useMediaTarget } from '@/features/analysis/use-media-target'
import { CharacterSourceDialog } from '@/features/live2d/CharacterSourceDialog'
import { Live2DViewport, type ModelPreview } from '@/features/live2d/Live2DViewport'
import { ReferenceColumn } from '@/features/live2d/ReferenceColumn'
import { SettingsColumn } from '@/features/live2d/SettingsColumn'
import { useLive2dTask } from '@/features/live2d/use-live2d-task'
import type { CharacterAsset } from '@/services/characters/api'
import type { EpisodeSummary } from '@/services/episodes/api'
import { live2dErrorMessage, live2dFailureText, uploadLive2dImage } from '@/services/live2d/api'
import { SAMPLE_MODEL_URL, live2dImageIssue, live2dTaskBody, type Live2dSource } from '@/services/live2d/contract'

type ReferenceImage =
  | { kind: 'local'; file: File; previewUrl: string; uploadFileId: string | null }
  | { kind: 'asset'; assetId: string; previewUrl: string; label: string }

export function Live2DPage() {
  const target = useMediaTarget()
  if (target.projects.isLoading) return <PageSkeleton />
  if (target.projects.isError || !target.projects.data) {
    return <EmptyState title="Live2D 工作台加载失败" description="请检查网络后重新读取项目。" action={<Button onClick={() => void target.projects.refetch()}>重试</Button>} />
  }
  if (!target.projectId || !target.projects.data) {
    return <EmptyState title="还没有可生成的项目" description="创建项目后，可以把角色图转成 Live2D 模型。" action={<Button asChild><Link to="/projects">前往项目管理</Link></Button>} />
  }
  return (
    <Live2DWorkbench
      key={target.projectId}
      projectId={target.projectId}
      projectName={target.project?.name}
      projects={target.projects.data.items}
      episodes={target.episodes.data?.items ?? []}
      onProject={target.setProject}
    />
  )
}

function Live2DWorkbench({
  projectId,
  projectName,
  projects,
  episodes,
  onProject,
}: {
  projectId: string
  projectName: string | undefined
  projects: { id: string; name: string }[]
  episodes: EpisodeSummary[]
  onProject: (projectId: string) => void
}) {
  const task = useLive2dTask(projectId)
  const [modelName, setModelName] = useState('')
  const [reference, setReference] = useState<ReferenceImage | null>(null)
  const [picking, setPicking] = useState(false)
  const [notice, setNotice] = useState('')
  const [preview, setPreview] = useState<ModelPreview | null>(null)
  const [preparing, setPreparing] = useState(false)
  const previewUrlRef = useRef('')
  const submitAbortRef = useRef<AbortController | null>(null)
  const busy = preparing || task.busy

  useEffect(() => () => {
    submitAbortRef.current?.abort()
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current)
  }, [])

  const clearResult = () => {
    setPreview(null)
    setNotice('')
    task.clear()
  }

  const replaceLocal = (file: File) => {
    if (busy || submitAbortRef.current) return
    const issue = live2dImageIssue(file)
    if (issue) {
      setNotice(issue)
      return
    }
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current)
    const previewUrl = URL.createObjectURL(file)
    previewUrlRef.current = previewUrl
    setReference({ kind: 'local', file, previewUrl, uploadFileId: null })
    clearResult()
  }

  const chooseAsset = (asset: CharacterAsset, episode: EpisodeSummary) => {
    if (busy || submitAbortRef.current) return
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current)
    previewUrlRef.current = ''
    setReference({
      kind: 'asset',
      assetId: asset.id,
      previewUrl: asset.url,
      label: `第 ${episode.episodeNumber} 集 · 人物 ${asset.frameCharacterNumber}`,
    })
    clearResult()
  }

  const generate = async () => {
    if (!projectId || busy || submitAbortRef.current) return
    const startedProjectId = projectId
    const controller = new AbortController()
    submitAbortRef.current = controller
    setPreparing(true)
    clearResult()
    try {
      const source = await resolveSource(startedProjectId, reference, controller.signal, (uploadFileId) => {
        setReference((current) => current?.kind === 'local' ? { ...current, uploadFileId } : current)
      })
      if (controller.signal.aborted) return
      setPreparing(false)
      const finished = await task.submit(live2dTaskBody(startedProjectId, modelName, source))
      if (finished?.status === 'SUCCEEDED' && finished.result) {
        setPreview({ id: finished.taskId, kind: 'url', url: finished.result.modelEntryUrl, sample: false })
      }
    } catch (error) {
      if (controller.signal.aborted || isCancelled(error)) return
      if (error instanceof AuthError) {
        const message = live2dErrorMessage(error)
        if (message) setNotice(message)
        return
      }
      setNotice(error instanceof Error && error.message ? error.message : '暂时无法完成操作，请稍后重试。')
    } finally {
      submitAbortRef.current = null
      if (!controller.signal.aborted) setPreparing(false)
    }
  }

  const failure = task.task?.status === 'FAILED'
    ? live2dFailureText(task.task.error?.code ?? null, task.task.error?.message ?? '')
    : task.error

  return (
    <div className="flex flex-col gap-4 lg:h-[calc(100svh-7rem)] lg:min-h-0">
      <div className="flex flex-wrap items-center gap-3">
        <Select value={projectId} onValueChange={onProject}>
          <SelectTrigger className="w-full max-w-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            {projectName && !projects.some((item) => item.id === projectId) ? (
              <SelectItem value={projectId}>{projectName}</SelectItem>
            ) : null}
            {projects.map((project) => <SelectItem key={project.id} value={project.id}>{project.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="flex min-w-0 flex-1 gap-2">
          <Button type="button" className="h-10 flex-1 max-w-xs"><ImageIcon />图片转 Live2D</Button>
          <Button type="button" variant="outline" className="h-10 flex-1 max-w-xs" disabled title="动作生成将在后续接入">
            <PersonStanding />动作生成
          </Button>
        </div>
      </div>
      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[280px_minmax(0,1fr)_300px]">
        <ReferenceColumn
          previewUrl={reference?.previewUrl ?? ''}
          label={reference?.kind === 'asset' ? reference.label : reference?.kind === 'local' ? reference.file.name : ''}
          disabled={busy}
          onUpload={replaceLocal}
          onChooseAsset={() => setPicking(true)}
        />
        <section className="flex min-h-0 flex-col gap-3 rounded-2xl border border-white/10 bg-card p-4">
          <h2 className="font-medium">模型预览</h2>
          <Live2DViewport preview={preview} />
        </section>
        <SettingsColumn
          modelName={modelName}
          onModelName={setModelName}
          busy={busy}
          status={task.task?.status ?? null}
          stage={task.task?.stage ?? null}
          failure={failure}
          notice={notice}
          onGenerate={() => void generate()}
          onImport={(files) => {
            setNotice('')
            setPreview({ id: crypto.randomUUID(), kind: 'files', files, sample: false })
          }}
          onSample={() => {
            setNotice('')
            setPreview({ id: 'sample', kind: 'url', url: SAMPLE_MODEL_URL, sample: true })
          }}
        />
      </div>
      <CharacterSourceDialog
        open={picking}
        projectId={projectId}
        episodes={episodes}
        onOpenChange={setPicking}
        onSelect={chooseAsset}
      />
    </div>
  )
}

const resolveSource = async (
  projectId: string,
  reference: ReferenceImage | null,
  signal: AbortSignal,
  rememberUpload: (uploadFileId: string) => void,
): Promise<Live2dSource> => {
  if (!reference) throw new Error('请先上传图片或从人物素材选择。')
  if (reference.kind === 'asset') return { sourceAssetId: reference.assetId }
  if (reference.uploadFileId) return { uploadFileId: reference.uploadFileId }
  const uploadFileId = await uploadLive2dImage(projectId, reference.file, signal)
  rememberUpload(uploadFileId)
  return { uploadFileId }
}

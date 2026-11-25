import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { Button } from '@/components/ui/button'
import { EmptyState, PageSkeleton } from '@/components/common/EmptyState'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useMediaTarget } from '@/features/analysis/use-media-target'
import { MotionLibrary, type MotionEntry } from '@/features/live2d/MotionLibrary'
import { isCancelled } from '@/features/auth/auth-api'
import { BasicMotionStudio } from '@/features/motions/BasicMotionStudio'
import { comboErrorMessage, listModelChoices, type ModelChoice } from '@/services/live2d/combo-api'

export function MotionLibraryPage() {
  const target = useMediaTarget()
  if (target.projects.isLoading) return <PageSkeleton />
  if (target.projects.isError || !target.projects.data) {
    return <EmptyState title="动作库加载失败" description="请检查网络后重新读取项目。" action={<Button onClick={() => void target.projects.refetch()}>重试</Button>} />
  }
  if (!target.projectId) {
    return <EmptyState title="还没有项目" description="创建项目并生成模型后，可以在这里预览动作。" action={<Button asChild><Link to="/projects">前往项目管理</Link></Button>} />
  }
  return (
    <MotionLibraryScreen
      key={target.projectId}
      projectId={target.projectId}
      projects={target.projects.data.items}
      onProject={target.setProject}
    />
  )
}

function MotionLibraryScreen({
  projectId,
  projects,
  onProject,
}: {
  projectId: string
  projects: { id: string; name: string }[]
  onProject: (projectId: string) => void
}) {
  const [params, setParams] = useSearchParams()
  const [mode, setMode] = useState<'basic' | 'reaction'>('basic')
  const [choices, setChoices] = useState<ModelChoice[]>([])
  const [choiceError, setChoiceError] = useState('')
  const requested = params.get('version')
  const [versionId, setVersionId] = useState(requested ?? '')
  const dirtyRef = useRef(false)
  const [entry, setEntry] = useState<MotionEntry>({ kind: 'list', focus: null })

  useEffect(() => {
    const controller = new AbortController()
    void listModelChoices(projectId, controller.signal)
      .then((items) => {
        if (controller.signal.aborted) return
        setChoices(items)
        setChoiceError('')
        setVersionId((current) => items.some((item) => item.versionId === current) ? current : items.find((item) => item.versionId === requested)?.versionId ?? items[0]?.versionId ?? '')
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted || isCancelled(error)) return
        setChoiceError(comboErrorMessage(error, '模型版本加载失败。'))
      })
    return () => controller.abort()
  }, [projectId, requested])

  const choice = choices.find((item) => item.versionId === versionId) ?? null
  const focus = choice ? { characterId: choice.characterId, versionId: choice.versionId } : null

  const chooseVersion = (nextVersion: string) => {
    setVersionId(nextVersion)
    setParams((current) => {
      const next = new URLSearchParams(current)
      next.set('project', projectId)
      next.set('version', nextVersion)
      return next
    }, { replace: true })
    setEntry({ kind: 'list', focus: choices.find((item) => item.versionId === nextVersion) ? { characterId: choices.find((item) => item.versionId === nextVersion)?.characterId ?? '', versionId: nextVersion } : null })
  }

  return (
    <div className="flex h-[calc(100svh-8rem)] min-h-0 flex-col gap-3">
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        <Select value={projectId} onValueChange={onProject}>
          <SelectTrigger className="w-56" aria-label="项目"><SelectValue /></SelectTrigger>
          <SelectContent>
            {projects.map((project) => <SelectItem key={project.id} value={project.id}>{project.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={versionId} onValueChange={chooseVersion}>
          <SelectTrigger className="w-64" aria-label="模型版本"><SelectValue placeholder="选择模型版本" /></SelectTrigger>
          <SelectContent>
            {choices.map((item) => <SelectItem key={item.versionId} value={item.versionId}>{item.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button type="button" variant={mode === 'basic' ? 'default' : 'outline'} onClick={() => setMode('basic')}>基础动作</Button>
        <Button type="button" variant={mode === 'reaction' ? 'default' : 'outline'} onClick={() => setMode('reaction')}>组合反应</Button>
      </div>
      {choiceError ? <p className="text-sm text-rose-300">{choiceError}</p> : null}
      {mode === 'basic' ? (
        <BasicMotionStudio projectId={projectId} choice={choice} />
      ) : (
        <MotionLibrary
          projectId={projectId}
          entry={{ ...entry, focus }}
          dirtyRef={dirtyRef}
          presentation="reactions"
        />
      )}
    </div>
  )
}

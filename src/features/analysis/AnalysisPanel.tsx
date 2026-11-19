import { useQueryClient, useMutation } from '@tanstack/react-query'
import { Link } from 'react-router'
import { Button } from '@/components/ui/button'
import { AuthError, isCancelled } from '@/features/auth/auth-api'
import { formatDateTime } from '@/lib/format'
import {
  analysisErrorMessage,
  analysisStatusLabel,
  analysisTaskKey,
  frameListKey,
  retryAnalysis,
  startAnalysis,
  taskErrorMessage,
  type AnalysisTask,
} from '@/services/analysis/api'
import { useAnalysisTask } from './use-analysis'

const stages = ['等待解析', '正在提取首帧', '完成']

const stageState = (task: AnalysisTask | null, index: number) => {
  if (!task) return 'pending'
  if (task.status === 'SUCCEEDED') return 'done'
  const active = task.status === 'RUNNING' || (task.status === 'FAILED' && task.startedAt) ? 1 : 0
  if (task.status === 'FAILED' && index === active) return 'failed'
  if (index < active || (task.status === 'RUNNING' && index === 0)) return 'done'
  if (index === active) return 'active'
  return 'pending'
}

export function AnalysisPanel({ projectId, episodeId }: { projectId: string; episodeId: string }) {
  const queryClient = useQueryClient()
  const task = useAnalysisTask(projectId, episodeId)
  const remember = (next: AnalysisTask) => {
    queryClient.setQueryData(analysisTaskKey(projectId, episodeId), next)
    if (next.status === 'SUCCEEDED') {
      void queryClient.invalidateQueries({ queryKey: frameListKey(projectId, episodeId) })
    }
  }
  const start = useMutation({
    mutationFn: () => startAnalysis(projectId, episodeId),
    onSuccess: remember,
  })
  const retry = useMutation({
    mutationFn: () => {
      const current = task.data
      if (!current) throw new AuthError('缺少可重试的任务', 404, 'NOT_FOUND')
      return retryAnalysis(projectId, episodeId, current.id)
    },
    onSuccess: remember,
  })
  const submitError = start.error ?? retry.error
  const submitting = start.isPending || retry.isPending

  return (
    <article className="rounded-2xl border border-white/10 bg-card p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="font-medium">首帧解析</h2>
        {task.data ? <span className="text-sm text-violet-200">{analysisStatusLabel(task.data.status)}</span> : null}
      </div>
      <div className="grid grid-cols-3 gap-2">
        {stages.map((label, index) => {
          const state = stageState(task.data ?? null, index)
          return (
            <div key={label} className={`rounded-xl px-2 py-3 text-center text-sm ${state === 'done' ? 'bg-emerald-500/15 text-emerald-200' : state === 'active' ? 'bg-primary/20 text-violet-100' : state === 'failed' ? 'bg-rose-500/15 text-rose-200' : 'bg-background text-muted-foreground'}`}>
              {label}
            </div>
          )
        })}
      </div>
      {task.isPending ? <p className="mt-3 text-sm text-muted-foreground">正在读取解析状态…</p> : null}
      {task.isError ? (
        <div className="mt-3 space-y-2">
          <p className="text-sm text-rose-300">解析状态读取失败。{analysisErrorMessage(task.error)}</p>
          <Button type="button" variant="outline" onClick={() => void task.refetch()}>重新查询</Button>
        </div>
      ) : null}
      {task.data ? (
        <p className="mt-3 text-sm text-muted-foreground">
          任务 {task.data.id} · 已开始处理 {task.data.attemptCount} 次
          {task.data.finishedAt ? ` · 结束于 ${formatDateTime(task.data.finishedAt)}` : ''}
        </p>
      ) : null}
      {task.data?.status === 'FAILED' ? <p className="mt-2 text-sm text-rose-300">{taskErrorMessage(task.data.errorCode)}</p> : null}
      {submitError && !isCancelled(submitError) ? <p className="mt-2 text-sm text-rose-300">{analysisErrorMessage(submitError)}</p> : null}
      <div className="mt-3 flex flex-wrap gap-2">
        {!task.isPending && !task.isError && task.data === null ? (
          <Button type="button" disabled={submitting} onClick={() => start.mutate()}>{submitting ? '正在提交' : '开始解析'}</Button>
        ) : null}
        {task.data?.status === 'FAILED' ? (
          <Button type="button" disabled={submitting} onClick={() => retry.mutate()}>{submitting ? '正在提交' : '重试'}</Button>
        ) : null}
        {submitError ? <Button type="button" variant="outline" onClick={() => void task.refetch()}>重新查询</Button> : null}
        <Button type="button" variant="outline" asChild>
          <Link to={`/assets?project=${projectId}&episode=${episodeId}`}>前往素材库</Link>
        </Button>
      </div>
    </article>
  )
}

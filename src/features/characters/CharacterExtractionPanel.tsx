import { useRef } from 'react'
import { Link } from 'react-router'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { AuthError, isCancelled } from '@/features/auth/auth-api'
import { formatDateTime } from '@/lib/format'
import {
  characterAssetPrefix,
  characterErrorMessage,
  characterProgressText,
  characterStatusLabel,
  characterTaskErrorMessage,
  characterTaskKey,
  retryCharacterExtraction,
  startCharacterExtraction,
  type CharacterTask,
} from '@/services/characters/api'
import { useCharacterTask } from './use-characters'

export function CharacterExtractionPanel({
  projectId,
  episodeId,
  libraryHref,
}: {
  projectId: string
  episodeId: string
  libraryHref?: string
}) {
  const queryClient = useQueryClient()
  const task = useCharacterTask(projectId, episodeId)
  const lock = useRef(false)
  const remember = async (episode: string, next: CharacterTask) => {
    queryClient.setQueryData(characterTaskKey(projectId, episode), next)
    if (next.status === 'SUCCEEDED') {
      await queryClient.invalidateQueries({ queryKey: characterAssetPrefix(projectId, episode) })
    }
  }
  const start = useMutation({
    mutationFn: () => startCharacterExtraction(projectId, episodeId).then((next) => remember(episodeId, next)),
  })
  const retry = useMutation({
    mutationFn: () => {
      const current = queryClient.getQueryData<CharacterTask | null>(characterTaskKey(projectId, episodeId))
      if (!current) throw new AuthError('缺少可重试的任务', 404, 'NOT_FOUND')
      return retryCharacterExtraction(projectId, episodeId, current.id).then((next) => remember(episodeId, next))
    },
  })
  const submit = (action: () => void) => {
    if (lock.current) return
    lock.current = true
    action()
  }
  const release = () => {
    lock.current = false
  }
  const submitting = start.isPending || retry.isPending
  const current = task.data
  const processing = current?.status === 'PENDING' || current?.status === 'RUNNING'
  const progress = current ? characterProgressText(current) : ''
  const submitError = !current ? start.error : current.status === 'FAILED' ? retry.error : null

  return (
    <article className="rounded-2xl border border-white/10 bg-card p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="font-medium">人物提取</h2>
        {current ? <span className="text-sm text-violet-200">{characterStatusLabel(current)}</span> : null}
      </div>
      {task.isPending ? <p className="text-sm text-muted-foreground">正在读取人物提取状态…</p> : null}
      {task.isError ? (
        <div className="space-y-2">
          <p className="text-sm text-rose-300">人物提取状态读取失败。{characterErrorMessage(task.error)}</p>
          <Button type="button" variant="outline" onClick={() => void task.refetch()}>重新查询</Button>
        </div>
      ) : null}
      {current ? (
        <p className="text-sm text-muted-foreground">
          任务 {current.id}
          {current.finishedAt ? ` · 结束于 ${formatDateTime(current.finishedAt)}` : ''}
        </p>
      ) : null}
      {progress ? <p className="mt-2 text-sm text-violet-100">{progress}</p> : null}
      {current?.status === 'FAILED' ? (
        <p className="mt-2 text-sm text-rose-300">{characterTaskErrorMessage(current.errorCode)}</p>
      ) : null}
      {current?.status === 'SUCCEEDED' && current.assetCount !== null && current.assetCount > 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">已提取 {current.assetCount} 张人物素材</p>
      ) : null}
      {submitError && !isCancelled(submitError) ? (
        <p className="mt-2 text-sm text-rose-300">{characterErrorMessage(submitError)}</p>
      ) : null}
      <div className="mt-3 flex flex-wrap gap-2">
        {!task.isPending && !task.isError && current === null ? (
          <Button
            type="button"
            disabled={submitting}
            onClick={() => submit(() => start.mutate(undefined, { onSettled: release }))}
          >
            {submitting ? '正在提交' : submitError ? '再次提交' : '提取人物素材'}
          </Button>
        ) : null}
        {processing ? <Button type="button" disabled>提取中</Button> : null}
        {current?.status === 'FAILED' ? (
          <Button
            type="button"
            disabled={submitting}
            onClick={() => submit(() => retry.mutate(undefined, { onSettled: release }))}
          >
            {submitting ? '正在提交' : '重试'}
          </Button>
        ) : null}
        {submitError ? <Button type="button" variant="outline" onClick={() => void task.refetch()}>重新查询</Button> : null}
        {libraryHref ? (
          <Button type="button" variant="outline" asChild>
            <Link to={libraryHref}>查看人物素材</Link>
          </Button>
        ) : null}
      </div>
    </article>
  )
}

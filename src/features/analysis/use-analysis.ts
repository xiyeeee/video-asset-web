import { useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { isProjectId } from '@/features/projects/use-projects'
import {
  analysisTaskKey,
  frameListKey,
  getAnalysisTask,
  listFrames,
  type AnalysisTask,
} from '@/services/analysis/api'

const serverId = (value: string | undefined) => Boolean(value && /^[1-9]\d*$/.test(value))

const activeStatus = (task: AnalysisTask | null | undefined) =>
  task?.status === 'PENDING' || task?.status === 'RUNNING'

export const useAnalysisTask = (projectId: string | undefined, episodeId: string | undefined) => {
  const queryClient = useQueryClient()
  const enabled = isProjectId(projectId) && serverId(episodeId)
  const query = useQuery({
    queryKey: analysisTaskKey(projectId ?? '', episodeId ?? ''),
    queryFn: ({ signal }) => {
      if (!projectId || !episodeId) throw new Error('缺少项目或集数')
      return getAnalysisTask(projectId, episodeId, signal)
    },
    enabled,
    refetchInterval: (current) => (activeStatus(current.state.data) ? 2_500 : false),
  })

  const status = query.data?.status
  const taskId = query.data?.id
  useEffect(() => {
    if (status === 'SUCCEEDED' && projectId && episodeId) {
      void queryClient.invalidateQueries({ queryKey: frameListKey(projectId, episodeId) })
    }
  }, [episodeId, projectId, queryClient, status, taskId])

  return query
}

export const useFrames = (projectId: string | undefined, episodeId: string | undefined) => useQuery({
  queryKey: frameListKey(projectId ?? '', episodeId ?? ''),
  queryFn: ({ signal }) => {
    if (!projectId || !episodeId) throw new Error('缺少项目或集数')
    return listFrames(projectId, episodeId, signal)
  },
  enabled: isProjectId(projectId) && serverId(episodeId),
  staleTime: (query) => {
    const expires = query.state.data?.[0]?.expiresInSeconds
    if (!expires) return 0
    return Math.max(0, expires * 1000 - 15_000)
  },
  gcTime: 60_000,
})

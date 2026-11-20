import { useQuery } from '@tanstack/react-query'
import { activeTask, findShotTask } from '@/services/extraction/api'
import { listEpisodeShots, shotAssetKey } from '@/services/shots/api'

const activeStatus = (status: string | undefined) => status === 'PENDING' || status === 'RUNNING'

export const useShotAssets = (episodeId: string) => useQuery({
  queryKey: shotAssetKey(episodeId),
  queryFn: ({ signal }) => listEpisodeShots(episodeId, signal),
  enabled: /^[1-9]\d*$/.test(episodeId),
  refetchInterval: (query) => (activeStatus(query.state.data?.status) ? 2_500 : false),
  staleTime: (query) => {
    const expires = query.state.data?.expiresInSeconds
    if (!expires) return 0
    return Math.max(0, expires * 1000 - 15_000)
  },
  gcTime: 60_000,
})

export const useShotTask = (episodeId: string, assetActive: boolean) => useQuery({
  queryKey: ['shot-task', episodeId],
  queryFn: ({ signal }) => findShotTask(episodeId, signal),
  enabled: /^[1-9]\d*$/.test(episodeId),
  refetchInterval: (query) => (assetActive || (query.state.data && activeTask(query.state.data.status)) ? 2_500 : false),
})

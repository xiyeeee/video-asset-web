import { useQuery } from '@tanstack/react-query'
import { signedImageStaleMs } from '@/features/background/cards'
import { activeTask, findExtractionTask } from '@/services/extraction/api'
import { backgroundAssetKey, listEpisodeBackgrounds } from '@/services/background/api'

const activeStatus = (status: string | undefined) => status === 'PENDING' || status === 'RUNNING'

export const useBackgroundAssets = (episodeId: string) => useQuery({
  queryKey: backgroundAssetKey(episodeId),
  queryFn: ({ signal }) => listEpisodeBackgrounds(episodeId, signal),
  enabled: /^[1-9]\d*$/.test(episodeId),
  refetchInterval: (query) => (activeStatus(query.state.data?.status) ? 2_500 : false),
  staleTime: (query) => signedImageStaleMs(query.state.data?.expiresInSeconds ?? null),
  gcTime: 60_000,
})

export const useBackgroundTask = (episodeId: string, assetActive: boolean) => useQuery({
  queryKey: ['background-task', episodeId],
  queryFn: ({ signal }) => findExtractionTask(episodeId, 'BACKGROUND', signal),
  enabled: /^[1-9]\d*$/.test(episodeId),
  refetchInterval: (query) => (assetActive || (query.state.data && activeTask(query.state.data.status)) ? 2_500 : false),
})

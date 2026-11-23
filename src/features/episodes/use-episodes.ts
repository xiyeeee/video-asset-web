import { useQuery } from '@tanstack/react-query'
import { isProjectId } from '@/features/projects/use-projects'
import {
  EPISODE_PAGE_SIZE,
  episodePlaybackKey,
  episodeQueryKey,
  getEpisodePlayback,
  listEpisodes,
} from '@/services/episodes/api'

export { EPISODE_PAGE_SIZE }

const numericId = (value: string | undefined) => Boolean(value && /^[1-9]\d*$/.test(value))

export const useEpisodeList = (projectId: string, page: number, size = EPISODE_PAGE_SIZE) => useQuery({
  queryKey: episodeQueryKey({ projectId, page, size }),
  queryFn: ({ signal }) => listEpisodes({ projectId, page, size }, signal),
  enabled: isProjectId(projectId),
  refetchInterval: (query) => query.state.data?.items.some((episode) =>
    episode.extractionStatus === 'QUEUED' || episode.extractionStatus === 'RUNNING',
  ) ? 3_000 : false,
  placeholderData: (previous) => (previous?.items[0]?.projectId === projectId ? previous : undefined),
})

export const useEpisodePlayback = (projectId: string, episodeId: string | undefined) => useQuery({
  queryKey: episodePlaybackKey(projectId, episodeId ?? ''),
  queryFn: ({ signal }) => {
    if (!episodeId) throw new Error('缺少集数')
    return getEpisodePlayback(projectId, episodeId, signal)
  },
  enabled: isProjectId(projectId) && numericId(episodeId),
  staleTime: (query) => {
    const playback = query.state.data
    if (!playback) return 0
    return Math.max(0, playback.expiresInSeconds * 1000 - 15_000)
  },
  gcTime: 60_000,
  refetchOnWindowFocus: false,
})

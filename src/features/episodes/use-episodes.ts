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

export const useEpisodeList = (projectId: string, page: number) => useQuery({
  queryKey: episodeQueryKey({ projectId, page, size: EPISODE_PAGE_SIZE }),
  queryFn: ({ signal }) => listEpisodes({ projectId, page, size: EPISODE_PAGE_SIZE }, signal),
  enabled: isProjectId(projectId),
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

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { isProjectId } from '@/features/projects/use-projects'
import {
  CHARACTER_PAGE_SIZE,
  characterAssetKey,
  characterAssetPrefix,
  characterTaskKey,
  getCharacterTask,
  getLatestCharacterTask,
  listCharacterAssets,
  type CharacterTask,
} from '@/services/characters/api'

const numericId = (value: string | undefined) => Boolean(value && /^[1-9]\d*$/.test(value))

const activeTask = (task: CharacterTask | null | undefined) =>
  task?.status === 'PENDING' || task?.status === 'RUNNING'

export const useCharacterTask = (projectId: string, episodeId: string) => {
  const queryClient = useQueryClient()
  const enabled = isProjectId(projectId) && numericId(episodeId)
  return useQuery({
    queryKey: characterTaskKey(projectId, episodeId),
    enabled,
    queryFn: async ({ signal }) => {
      const key = characterTaskKey(projectId, episodeId)
      const cached = queryClient.getQueryData<CharacterTask | null>(key)
      const task = cached && activeTask(cached)
        ? await getCharacterTask(projectId, episodeId, cached.id, signal)
        : await getLatestCharacterTask(projectId, episodeId, signal)
      if (task?.status === 'SUCCEEDED' && cached?.status !== 'SUCCEEDED') {
        await queryClient.invalidateQueries({ queryKey: characterAssetPrefix(projectId, episodeId) })
      }
      return task
    },
    refetchInterval: (query) => (activeTask(query.state.data) ? 2_500 : false),
  })
}

export const useCharacterAssets = (projectId: string, episodeId: string, page: number) => useQuery({
  queryKey: characterAssetKey(projectId, episodeId, page),
  queryFn: ({ signal }) => listCharacterAssets(projectId, episodeId, page, CHARACTER_PAGE_SIZE, signal),
  enabled: isProjectId(projectId) && numericId(episodeId),
  staleTime: (query) => {
    const expires = query.state.data?.items.reduce<number | null>((soonest, item) => (
      soonest === null ? item.expiresInSeconds : Math.min(soonest, item.expiresInSeconds)
    ), null)
    if (expires == null) return 0
    return Math.max(0, expires * 1000 - 15_000)
  },
  gcTime: 60_000,
  placeholderData: (previous, previousQuery) => {
    const key = previousQuery?.queryKey
    if (!previous || !key || key[1] !== projectId || key[2] !== episodeId) return undefined
    return previous
  },
})

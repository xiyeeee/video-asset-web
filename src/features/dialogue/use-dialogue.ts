import { useQuery } from '@tanstack/react-query'
import { activeTask, findExtractionTask } from '@/services/extraction/api'
import { dialogueAssetKey, listEpisodeDialogue } from '@/services/dialogue/api'

const activeStatus = (status: string | undefined) => status === 'PENDING' || status === 'RUNNING'

export const useDialogueAssets = (episodeId: string) => useQuery({
  queryKey: dialogueAssetKey(episodeId),
  queryFn: ({ signal }) => listEpisodeDialogue(episodeId, signal),
  enabled: /^[1-9]\d*$/.test(episodeId),
  refetchInterval: (query) => (activeStatus(query.state.data?.status) ? 2_500 : false),
})

export const useDialogueTask = (episodeId: string, assetActive: boolean) => useQuery({
  queryKey: ['dialogue-task', episodeId],
  queryFn: ({ signal }) => findExtractionTask(episodeId, 'DIALOGUE', signal),
  enabled: /^[1-9]\d*$/.test(episodeId),
  refetchInterval: (query) => (assetActive || (query.state.data && activeTask(query.state.data.status)) ? 2_500 : false),
})

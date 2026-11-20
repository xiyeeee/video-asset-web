import { useQuery } from '@tanstack/react-query'
import {
  activeTask,
  capabilityKey,
  extractionBoardKey,
  listExtractionCapabilities,
  loadExtractionBoard,
} from '@/services/extraction/api'

export const useExtractionCapabilities = () => useQuery({
  queryKey: capabilityKey,
  queryFn: ({ signal }) => listExtractionCapabilities(signal),
})

export const useExtractionBoard = () => useQuery({
  queryKey: extractionBoardKey,
  queryFn: ({ signal }) => loadExtractionBoard(signal),
  refetchInterval: (query) => (
    query.state.data?.tasks.some((task) => activeTask(task.status)) ? 3_000 : false
  ),
})

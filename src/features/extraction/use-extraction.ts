import { useQuery } from '@tanstack/react-query'
import {
  activeTask,
  capabilityKey,
  extractionBoardKey,
  getExtractionTask,
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

export const useExtractionTask = (taskId: string | undefined) => useQuery({
  queryKey: ['extraction-task', taskId],
  queryFn: ({ signal }) => {
    if (!taskId) throw new Error('缺少任务')
    return getExtractionTask(taskId, signal)
  },
  enabled: Boolean(taskId),
  refetchInterval: (query) => (query.state.data && activeTask(query.state.data.status) ? 2_500 : false),
})

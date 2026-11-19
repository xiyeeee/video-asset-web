import { useQuery } from '@tanstack/react-query'
import { listProjects, getProject, projectDetailKey, projectQueryKey, type ProjectQuery } from '@/services/projects/api'

export const PROJECT_PAGE_SIZE = 20

const numericId = (projectId: string | undefined) => Boolean(projectId && /^[1-9]\d*$/.test(projectId))

export const useProjectList = (query: ProjectQuery) => useQuery({
  queryKey: projectQueryKey(query),
  queryFn: () => listProjects(query),
  placeholderData: (previous) => previous,
})

export const useProject = (projectId: string | undefined) => useQuery({
  queryKey: projectDetailKey(projectId ?? ''),
  queryFn: () => {
    if (!projectId) throw new Error('缺少项目 ID')
    return getProject(projectId)
  },
  enabled: numericId(projectId),
})

export const isProjectId = numericId

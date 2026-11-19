import { useSearchParams } from 'react-router'
import { useEpisodeList } from '@/features/episodes/use-episodes'
import { useProject, useProjectList } from '@/features/projects/use-projects'

const serverId = (value: string | null): value is string => Boolean(value && /^[1-9]\d*$/.test(value))

export function useMediaTarget() {
  const [params, setParams] = useSearchParams()
  const projects = useProjectList({ q: '', page: 1, size: 100 })
  const requestedProject = params.get('project')
  const projectId = serverId(requestedProject) ? requestedProject : projects.data?.items[0]?.id
  const listed = projects.data?.items.find((item) => item.id === projectId)
  const projectQuery = useProject(listed ? undefined : projectId)
  const episodes = useEpisodeList(projectId ?? '', 1, 100)
  const requestedEpisode = params.get('episode')
  const episodeId = serverId(requestedEpisode) ? requestedEpisode : episodes.data?.items[0]?.id
  const episode = episodes.data?.items.find((item) => item.id === episodeId)
  const project = listed ?? projectQuery.data

  const setProject = (nextProjectId: string) => {
    setParams((current) => {
      const next = new URLSearchParams(current)
      next.set('project', nextProjectId)
      next.delete('episode')
      return next
    }, { replace: true })
  }

  const setEpisode = (nextEpisodeId: string) => {
    setParams((current) => {
      const next = new URLSearchParams(current)
      if (projectId) next.set('project', projectId)
      next.set('episode', nextEpisodeId)
      return next
    }, { replace: true })
  }

  return { projects, episodes, projectId, project, episodeId, episode, setProject, setEpisode }
}

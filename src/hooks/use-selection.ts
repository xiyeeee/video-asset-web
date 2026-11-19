import { useSearchParams } from 'react-router'
import type { AssetStatus, AssetType, Catalog } from '@/types/domain'
import { assetTypeOrder } from '@/lib/labels'
import { charactersOf, episodesOf, projectById } from '@/services/view'

export function useSelection(catalog: Catalog | undefined) {
  const [params, setParams] = useSearchParams()

  const update = (partial: Record<string, string | null>) => {
    setParams(
      (current) => {
        const next = new URLSearchParams(current)
        Object.entries(partial).forEach(([key, value]) => {
          if (value === null || value === '') next.delete(key)
          else next.set(key, value)
        })
        return next
      },
      { replace: true },
    )
  }

  const requestedProject = params.get('project')
  const project = catalog ? projectById(catalog, requestedProject) : undefined
  const episodes = catalog && project ? episodesOf(catalog, project.id) : []
  const episodeParam = params.get('episode') ?? 'all'
  const episodeId = episodeParam === 'all' || episodes.some((item) => item.id === episodeParam) ? episodeParam : 'all'
  const episode = episodes.find((item) => item.id === episodeId)
  const typeParam = params.get('type')
  const assetType = assetTypeOrder.find((item) => item === typeParam) ?? 'character'
  const characters = catalog && project ? charactersOf(catalog, project.id) : []
  const characterParam = params.get('character')
  const characterId =
    characterParam === 'all'
      ? null
      : characters.some((item) => item.id === characterParam)
        ? characterParam
        : assetType === 'character'
          ? (characters[0]?.id ?? null)
          : null
  const statusParam = params.get('status')
  const statuses: Array<AssetStatus | 'all'> = ['all', 'RAW', 'PROCESSING', 'REVIEW', 'READY', 'FAILED']
  const status = statuses.find((item) => item === statusParam) ?? 'all'
  const subtype = params.get('subtype') ?? 'all'
  const scene = params.get('scene')
  const keyword = params.get('q') ?? ''
  const assetId = params.get('asset')

  const setProject = (projectId: string) => {
    update({ project: projectId, episode: 'all', character: null, scene: null, q: null, asset: null })
  }

  const setEpisode = (nextEpisode: string) => update({ episode: nextEpisode, scene: null, asset: null })
  const setAssetType = (type: AssetType) => update({ type, subtype: 'all', scene: null, asset: null })

  return {
    params,
    update,
    project,
    episodes,
    episodeId,
    episode,
    assetType,
    characters,
    characterId,
    status,
    subtype,
    scene,
    keyword,
    assetId,
    setProject,
    setEpisode,
    setAssetType,
  }
}

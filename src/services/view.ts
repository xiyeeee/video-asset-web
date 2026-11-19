import type { AssetStatus, AssetType, Catalog } from '@/types/domain'

export function projectById(catalog: Catalog, projectId: string | null) {
  return catalog.projects.find((item) => item.id === projectId) ?? catalog.projects[0]
}

export function episodesOf(catalog: Catalog, projectId: string) {
  return catalog.episodes.filter((item) => item.projectId === projectId).sort((a, b) => a.episodeNumber - b.episodeNumber)
}

export function charactersOf(catalog: Catalog, projectId: string) {
  return catalog.characters.filter((item) => item.projectId === projectId)
}

export function assetsOfEpisode(catalog: Catalog, episodeId: string) {
  return catalog.assets.filter((item) => item.episodeId === episodeId)
}

export function countByType(catalog: Catalog, projectId: string, episodeId: string | 'all', type?: AssetType) {
  return catalog.assets.filter((asset) => {
    if (asset.projectId !== projectId) return false
    if (episodeId !== 'all' && asset.episodeId !== episodeId) return false
    if (type && asset.type !== type) return false
    return true
  }).length
}

export function filterAssets(
  catalog: Catalog,
  query: {
    projectId: string
    episodeId: string | 'all'
    type: AssetType
    characterId?: string | null
    scene?: string | null
    subtype?: string | null
    status?: AssetStatus | 'all'
    keyword?: string
  },
) {
  const keyword = query.keyword?.trim().toLowerCase() ?? ''
  return catalog.assets.filter((asset) => {
    if (asset.projectId !== query.projectId) return false
    if (query.episodeId !== 'all' && asset.episodeId !== query.episodeId) return false
    if (asset.type !== query.type) return false
    if (query.characterId && asset.characterId !== query.characterId) return false
    if (query.scene && asset.sceneName !== query.scene) return false
    if (query.subtype && query.subtype !== 'all' && asset.subtype !== query.subtype) return false
    if (query.status && query.status !== 'all' && asset.status !== query.status) return false
    if (!keyword) return true
    const character = catalog.characters.find((item) => item.id === asset.characterId)
    const haystack = `${asset.name} ${asset.text ?? ''} ${asset.sceneName ?? ''} ${character?.name ?? ''}`.toLowerCase()
    return haystack.includes(keyword)
  })
}

export function sceneNamesOf(catalog: Catalog, projectId: string, episodeId: string | 'all') {
  const names = new Set<string>()
  catalog.assets.forEach((asset) => {
    if (asset.projectId !== projectId || asset.type !== 'scene' || !asset.sceneName) return
    if (episodeId !== 'all' && asset.episodeId !== episodeId) return
    names.add(asset.sceneName)
  })
  return [...names]
}

export function completedEpisodeCount(catalog: Catalog, projectId: string) {
  return catalog.episodes.filter((item) => item.projectId === projectId && item.status === 'COMPLETED').length
}

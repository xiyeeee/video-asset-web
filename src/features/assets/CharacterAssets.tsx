import { CharacterGallery } from '@/features/characters/CharacterGallery'

export function CharacterAssets({
  projectId,
  episodeId,
  episodeLabel,
}: {
  projectId: string
  episodeId: string
  episodeLabel?: string
}) {
  return <CharacterGallery projectId={projectId} episodeId={episodeId} episodeLabel={episodeLabel} />
}

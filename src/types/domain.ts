export type AnalysisStatus =
  | 'PENDING'
  | 'UPLOADING'
  | 'QUEUED'
  | 'ANALYZING'
  | 'EXTRACTING'
  | 'COMPLETED'
  | 'FAILED'

export type AssetStatus = 'RAW' | 'PROCESSING' | 'REVIEW' | 'READY' | 'FAILED'

export type AssetType = 'character' | 'scene' | 'dialogue' | 'audio' | 'motion' | 'storyboard'

export type ExportFormat = 'files' | 'story-json' | 'unity'

export type ExportJobStatus = 'queued' | 'running' | 'completed' | 'failed'

export interface AnalysisLog {
  id: string
  time: string
  level: 'info' | 'warn' | 'error'
  message: string
}

export interface Project {
  id: string
  name: string
  coverUrl: string
  description: string
  novelName?: string
  novelText?: string
  tags: string[]
  createdAt: string
  updatedAt: string
}

export interface Episode {
  id: string
  projectId: string
  episodeNumber: number
  title: string
  videoUrl: string
  posterUrl: string
  duration: number
  resolution: string
  status: AnalysisStatus
  progress: number
  uploadedAt?: string
  errorMessage?: string
  logs: AnalysisLog[]
}

export interface Character {
  id: string
  projectId: string
  name: string
  role: string
  hue: number
  avatarUrl: string
  episodeIds: string[]
  summary: string
}

export interface Asset {
  id: string
  projectId: string
  episodeId: string
  characterId?: string
  storyLineId?: string
  type: AssetType
  subtype?: string
  name: string
  url: string
  posterUrl?: string
  status: AssetStatus
  startTime?: number
  endTime?: number
  width?: number
  height?: number
  duration?: number
  fileSize: string
  sceneName?: string
  text?: string
  novelMatch?: string
  audioAssetId?: string
  createdAt: string
  note?: string
}

export interface StoryLine {
  id: string
  projectId: string
  episodeId: string
  order: number
  characterId: string
  sceneName: string
  text: string
  startTime: number
  endTime: number
  novelExcerpt: string
}

export interface ExportJob {
  id: string
  projectId: string
  episodeId: string
  types: AssetType[]
  includeRaw: boolean
  includeJson: boolean
  format: ExportFormat
  status: ExportJobStatus
  progress: number
  createdAt: string
  fileName: string
}

export interface SessionUser {
  name: string
  email: string
  storageUsedGb: number
  storageTotalGb: number
}

export interface Catalog {
  user: SessionUser
  projects: Project[]
  episodes: Episode[]
  characters: Character[]
  assets: Asset[]
  storyLines: StoryLine[]
  exportJobs: ExportJob[]
}

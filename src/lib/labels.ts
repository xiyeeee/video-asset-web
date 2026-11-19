import type { AnalysisStatus, AssetStatus, AssetType, ExportFormat } from '@/types/domain'

export const assetTypeOrder: AssetType[] = [
  'character',
  'scene',
  'dialogue',
  'audio',
  'motion',
  'storyboard',
]

export const assetTypeLabel: Record<AssetType, string> = {
  character: '角色素材',
  scene: '场景背景',
  dialogue: '对话台词',
  audio: '音频素材',
  motion: '动作参考',
  storyboard: '分镜片段',
}

export const analysisLabel: Record<AnalysisStatus, string> = {
  PENDING: '等待上传',
  UPLOADING: '上传中',
  QUEUED: '排队中',
  ANALYZING: '解析中',
  EXTRACTING: '提取中',
  COMPLETED: '解析完成',
  FAILED: '解析失败',
}

export const assetStatusLabel: Record<AssetStatus, string> = {
  RAW: '原始提取',
  PROCESSING: '处理中',
  REVIEW: '待审核',
  READY: '可用于游戏',
  FAILED: '处理失败',
}

export const exportFormatLabel: Record<ExportFormat, string> = {
  files: '图片和音频文件',
  'story-json': '剧情 JSON',
  unity: 'Unity 资源包结构',
}

export const subtypeLabel: Record<string, string> = {
  illustration: '立绘',
  expression: '表情',
  avatar: '头像',
  action: '动作',
  indoor: '室内',
  outdoor: '室外',
  transition: '过渡',
  voice: '角色语音',
  bgm: '环境声',
  sfx: '音效',
  clip: '片段',
}

export const characterSubtypes = ['all', 'illustration', 'expression', 'avatar', 'action'] as const

export function isActiveAnalysis(status: AnalysisStatus) {
  return status === 'UPLOADING' || status === 'QUEUED' || status === 'ANALYZING' || status === 'EXTRACTING'
}

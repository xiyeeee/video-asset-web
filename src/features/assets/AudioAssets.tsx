import { UnavailableAssets } from './UnavailableAssets'

export function AudioAssets() {
  return (
    <UnavailableAssets
      type="AUDIO"
      title="音频"
      description="人物语音、音乐、音效和环境声还不能提取。支持后会按 VOICE、BGM、SFX、AMBIENCE 展示，并提供试听和下载。"
    />
  )
}

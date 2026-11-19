export function formatClock(seconds: number) {
  const safe = Number.isFinite(seconds) ? Math.max(0, Math.round(seconds)) : 0
  const minutes = Math.floor(safe / 60)
  const remain = safe % 60
  return `${minutes}:${remain.toString().padStart(2, '0')}`
}

export function formatDateTime(iso: string) {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '—'
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')
  const hour = `${date.getHours()}`.padStart(2, '0')
  const minute = `${date.getMinutes()}`.padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day} ${hour}:${minute}`
}

export function formatTime(iso: string) {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '--:--:--'
  return date.toLocaleTimeString('zh-CN', { hour12: false })
}

export const DEMO_VIDEO_URL = '/mock/demo.mp4'
export const DEMO_AUDIO_URL = '/mock/demo-voice.wav'
export const DEMO_VIDEO_SECONDS = 5

import { useEffect, useState } from 'react'

export const useDeadline = () => {
  const [deadline, setDeadline] = useState(0)
  const [now, setNow] = useState(() => Date.now())
  const remaining = Math.max(0, Math.ceil((deadline - now) / 1000))

  useEffect(() => {
    if (!deadline) return
    const tick = () => {
      const currentTime = Date.now()
      setNow(currentTime)
      if (currentTime >= deadline) window.clearInterval(timer)
    }
    const timer = window.setInterval(tick, 250)
    window.addEventListener('focus', tick)
    document.addEventListener('visibilitychange', tick)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener('focus', tick)
      document.removeEventListener('visibilitychange', tick)
    }
  }, [deadline])

  const start = (seconds: number) => {
    const currentTime = Date.now()
    setNow(currentTime)
    setDeadline(currentTime + seconds * 1000)
  }

  return { remaining, start }
}

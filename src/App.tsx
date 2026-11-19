import { Button } from '@/components/ui/button'
import { Route, Routes } from 'react-router'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
    </Routes>
  )
}

function HomePage() {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-6 p-6">
      <h1 className="text-3xl font-semibold tracking-tight">视频转素材</h1>
      <Button type="button">开始使用</Button>
    </main>
  )
}

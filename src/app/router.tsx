import { Route, Routes } from 'react-router'
import { Link } from 'react-router'
import { AppShell } from '@/layouts/AppShell'
import { EmptyState } from '@/components/common/EmptyState'
import { Button } from '@/components/ui/button'
import { DashboardPage } from '@/pages/dashboard/DashboardPage'
import { ProjectsPage } from '@/pages/projects/ProjectsPage'
import { ProjectDetailPage } from '@/pages/projects/ProjectDetailPage'
import { AnalysisPage } from '@/pages/video-analysis/AnalysisPage'
import { AssetLibraryPage } from '@/pages/asset-library/AssetLibraryPage'
import { StoryPage } from '@/pages/story-editor/StoryPage'
import { ExportPage } from '@/pages/export-center/ExportPage'

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<DashboardPage />} />
        <Route path="projects" element={<ProjectsPage />} />
        <Route path="projects/:projectId" element={<ProjectDetailPage />} />
        <Route path="analysis" element={<AnalysisPage />} />
        <Route path="assets" element={<AssetLibraryPage />} />
        <Route path="story" element={<StoryPage />} />
        <Route path="export" element={<ExportPage />} />
        <Route path="*" element={<EmptyState title="页面不存在" description="请从左侧导航进入工作台。" action={<Button asChild><Link to="/">回到工作台</Link></Button>} />} />
      </Route>
    </Routes>
  )
}

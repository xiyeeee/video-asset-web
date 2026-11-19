# 前端架构

视频转游戏素材工作台是一个 Vite + React 19 单页应用。本阶段只有前端，业务数据来自浏览器内的 Mock 仓库，页面通过 TanStack Query 读取快照。

## 技术选型

- React 19、TypeScript 严格模式、Vite
- Tailwind CSS 4 与 shadcn/ui（Radix）
- React Router 8、Zustand、TanStack Query、Axios（客户端已预留）
- React Hook Form、Zod、Motion、Vidstack、wavesurfer.js、Lucide

## 运行时结构

`src/main.tsx` 挂载 QueryClient、TooltipProvider、BrowserRouter 和 Toast。`src/app/router.tsx` 把六个一级页面放进 `AppShell`。

`AppShell` 提供左侧导航、折叠状态、顶部标题和任务通知。折叠状态由 Zustand 持久化到 `localStorage`。当前项目、集数、素材分类和筛选项放在 URL 查询参数里，刷新后仍能回到同一视图。

## 数据边界

`src/services/mock/catalog.ts` 是唯一会改业务数据的地方。组件不直接写死项目、集数或素材列表。

页面调用 `useCatalog()` 取得快照。创建、编辑、上传、解析和导出先改 Mock 仓库，再 `setQueryData` 发布新快照。解析中的集数和导出任务由 `useTaskSimulation()` 每 900ms 推进一次，用来演示进度，不代表真实 AI。

`src/services/api` 尚未接后端。后续可以用同一批页面动作替换 `catalog.ts` 里的函数，并让 Query 改为请求 Axios。

## 目录

```text
src/
├── app/router.tsx
├── layouts/AppShell.tsx
├── pages/
│   ├── dashboard/
│   ├── projects/
│   ├── video-analysis/
│   ├── asset-library/
│   ├── story-editor/
│   └── export-center/
├── features/
│   ├── projects/ProjectDialogs.tsx
│   └── assets/AssetDrawer.tsx
├── components/
│   ├── ui/
│   ├── common/
│   ├── video/VideoPlayer.tsx
│   └── asset/Waveform.tsx
├── services/mock/
│   ├── artwork.ts
│   └── catalog.ts
├── services/view.ts
├── stores/ui-store.ts
├── hooks/
├── types/domain.ts
└── lib/
```

全局主题在 `src/index.css`。深色工作台色值是背景 `#0B1020`、面板 `#151B30`、卡片 `#1C2440`、强调色 `#8B5CF6`。

## 演示媒体

- `public/mock/demo.mp4`：约 5 秒的本地片花，给 Vidstack 播放。
- `public/mock/demo-voice.wav`：本地生成的演示音色，给 wavesurfer 试听。
- 角色和场景图是运行时生成的 SVG 数据地址，用来区分集数和角色，不是从成片提取的图片。

用户上传的视频会变成浏览器对象 URL，只存在于当前会话，不会发到服务器。

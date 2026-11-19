---
name: init-video-assets-web
description: Initializes the 视频转素材 frontend in video-assets-web with Vite, React 19, Tailwind CSS, shadcn/ui Radix, React Router, Zustand, TanStack Query, Axios, Vidstack, wavesurfer.js, and Motion. Use when setting up or completing the video-assets-web frontend scaffold, installing its selected dependencies, or following the 视频转素材 initialization prompt.
disable-model-invocation: true
---

你正在初始化「视频转素材」项目前端。这个项目用于上传漫剧视频，按集查看提取进度，并预览分镜、角色、背景和台词。

本轮目标：在本地创建或完善独立前端工程，安装已经选定的依赖，验证开发环境和生产构建。

一、检查当前目录

- 如果当前目录已经是这个项目的前端工程，直接在现有工程上配置，保留项目名、已有代码和 pnpm 锁文件。
- 如果当前目录是项目父目录且还没有前端工程，用 pnpm 和 Vite 的 react-ts 模板创建 `video-assets-web`。先检查目标目录，避免覆盖现有文件或重复嵌套。
- 使用 React 19、React DOM 19、TypeScript、Vite 和 pnpm。保留 Vite 模板的 TypeScript 和 ESLint 配置。

二、按既定选型安装和配置

- 样式：`tailwindcss`、`@tailwindcss/vite`。把 Tailwind 插件接入 Vite，并在全局 CSS 中引入 Tailwind。
- 路径别名：配置 `@/` 指向 `src/`，确保 Vite 和 TypeScript 的解析一致。
- UI：初始化 shadcn/ui，使用其 Radix UI 方案。通过 CLI 添加 `button`、`tabs`、`select`、`dialog`、`progress`。组件依赖由 CLI 管理。
- 路由：`react-router`，用于左侧一级导航和工作台页面。
- 客户端状态：`zustand`，用于当前集数、素材筛选和预览状态。
- 请求与缓存：`axios`、`@tanstack/react-query`，用于上传、任务查询和素材列表。
- 视频播放器：`@vidstack/react`，后续用于原视频预览和分镜定位。
- 音频波形：`wavesurfer.js`，后续用于原声和台词片段预览。
- 动效：`motion`，后续用于面板切换。
- 实时进度：后续使用 SSE，浏览器通过原生 `EventSource` 连接。上传后续使用原生文件选择、`FormData` 和 Axios。

三、完成最小可运行入口

- 初始化 React Router 和 `QueryClientProvider`，首页显示「视频转素材」和一个可见的 shadcn 按钮，用于验证组件、样式和路径别名。
- Zustand、播放器、波形和动效依赖这轮一并安装，等对应功能开发时再接入。
- 本轮交付范围是工程初始化。工作台正式页面、模拟数据、后端联调和实时进度连接留到后续开发。

四、验收

- 实际运行 `pnpm dev`，确认首页能够打开。
- 运行 `pnpm build` 和 `pnpm lint`，解决本轮引入的错误。
- 最后说明实际修改的文件、安装的依赖和验证结果。遇到版本兼容问题时，说明具体冲突以及如何处理。

最终将提示词放在skills文件夹下

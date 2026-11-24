# Live2D 工作台

页面在 `/live2d`。本地图片走 `POST /api/projects/{projectId}/files` 取得 `uploadFileId`，人物素材使用 `sourceAssetId`。生成与状态推送见 `docs/frontend-api.md` 的 Live2D 一节。Python 与 Java 的内部任务字段见 `video-asset-ai/docs/live2d-python.md`。页面只消费 Java 网关返回的 `taskId`、`status`、`stage`、`result.modelId` 和 `result.modelEntryUrl`。提交后通过 WebSocket 接收状态，终态后关闭连接。

## 本地启动

```bash
cd video-asset-web
pnpm dev
```

开发服务默认是 `http://localhost:5173/live2d`。接口代理到 `API_PROXY_TARGET`，未设置时是 `http://127.0.0.1:18080`。

播放器使用 `pixi-live2d-display` 的 Cubism 4 运行时。官方 `live2dcubismcore.min.js` 属于 Live2D 可再分发核心，不放进仓库。本机验证时复制到：

```bash
mkdir -p public/live2d/samples/model
cp ../video-asset-ai/outputs/live2d-eval/attempts/alternative/live2dcubismcore.min.js public/live2d/live2dcubismcore.min.js
cp -R ../video-asset-ai/outputs/live2d-eval/attempts/alternative/adapter-runtime/. public/live2d/samples/model/
```

`public/live2d/samples/model/model.model3.json` 会作为「加载示例模型」，界面标注「示例模型」。也可以用「导入已有模型」选择含有一个 `.model3.json` 的目录，例如 Haru。

## 人工验收

1. 登录后打开 Live2D 工作台，确认左侧导航与素材库同级，并默认停在「图片转 Live2D」。「动作生成」和「生成动作」保持不可用。
2. 切换项目后，参考图、任务状态和画布应清空，旧的任务连接不再改当前项目。
3. 上传 PNG、JPEG 或 WebP，或从当前项目人物素材选择一张图，填写模型名称后提交。生成过程中按钮不可再次提交。
4. 任务成功后，中间画布加载 `result.modelEntryUrl`。相对的 moc、贴图和动作文件都能显示。失败原因出现在右侧，预览加载失败出现在画布上，两者分开。
5. 模型加载后，只显示它实际具备的眨眼、张嘴、转头按钮，点击后能看到对应变化。
6. 可以用示例模型或导入目录单独验证第 5 步。

## 当前验证

- 契约检查覆盖单来源提交、终态停止、项目切换丢弃、本站与对象存储的鉴权区分、相对路径解析和按参数显示测试按钮。
- 示例模型来自 `video-asset-ai/outputs/live2d-eval/attempts/alternative/adapter-runtime`，包含 `ParamEyeLOpen`、`ParamMouthOpenY` 和 `ParamAngleX`。它不是 Haru。
- Java 网关与 Python 已通过预制拆层结果联调。完整浏览器链路及任意新图片的自动拆层仍需在配置好的环境中验证。

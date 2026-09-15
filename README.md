# 拾忆 Web 原型

当前版本实现简洁收集入口、文字/链接/图片/录音保存、关键词检索、资料编辑、主题关联、回收站恢复及行动计划。生产运行于 Sites Worker，使用平台身份头及 R2 保存用户资料。

## 作业公开演示版（GitHub + Cloudflare Pages）

项目同时提供一个不依赖 ChatGPT 登录的公开演示版本。运行 `npm run build:pages` 会生成 `dist-pages/`：访问者打开首页后直接进入老师演示空间，可以体验保存、搜索、行动计划、图片预览、删除和恢复。演示数据只保留在当前浏览器页面中，刷新即重置，不会产生 AI 接口费用，也不会读取私人数据。

在 Cloudflare Pages 连接此 GitHub 仓库时使用以下设置：

- Production branch：`main`
- Framework preset：`None`
- Build command：`npm run build:pages`
- Build output directory：`dist-pages`

第一次部署成功后，在 Pages 项目的 Custom domains 中添加 `sungongqin.icu`。根域名需要由同一个 Cloudflare 账号管理该域名区域并使用 Cloudflare 名称服务器；Cloudflare 会在确认后创建所需的 DNS 记录和 HTTPS 证书。

## 开发

无需额外 npm 依赖。运行 `npm run build` 后运行 `npm run dev`，本机预览地址为 `http://127.0.0.1:4173`。本机预览使用合成账号和内存测试存储，重启进程会清空，仅供开发验证，不能作为生产服务运行。

运行 `npm test` 执行服务端用例。前端源文件在 `web/`，Worker 在 `src/worker.js`；构建产物在 `dist/server/index.js`。构建把界面资源嵌入 Worker，无外部 CDN 依赖。

## 线上配置

`.openai/hosting.json` 绑定现有私有 Site 和 `BUCKET`，由平台提供 R2。所有资料接口在服务端检查平台转发的用户身份；记录和文件均使用用户哈希前缀。不能将该 Worker 直接暴露在允许访客伪造身份头的独立代理后面。

AI 通过服务端的 `OPENAI_API_KEY`、`AI_MODEL`（默认 gpt-4.1-mini）、`TRANSCRIBE_MODEL`（默认 gpt-4o-mini-transcribe）配置。密钥不得写入仓库或前端。未配置时明确返回 503，原始内容不受影响。实际模型可用性及质量还需配置后验证。

当 OpenAI Developers 插件不可用时，用户可双击 `scripts/save-openai-key.command`，将项目 API Key 保存到 Git 已忽略的 `work/secrets/openai-api-key.txt`。部署配置成功后删除该临时文件。配置过程不得在终端输出、提交或把密钥发到聊天中。

当前登录为 ChatGPT 平台登录，不是独立邮箱密码注册；私有原型访问范围未扩大。行动计划保存但不发送系统通知。网盘和商品链接不自动解析目标内容。AI 问答最多使用最近 40 条或指定匹配的 20 条文字资料，不是全库向量检索。

删除为软删除，用户可在回收站恢复，原始文件仍保留。导出功能包含 JSON 文字资料及链接，不含原始附件。适用于小范围试用，不应宣称为完整生产级信息管理服务。

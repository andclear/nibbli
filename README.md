# 🐰 小兔几 (Nibbli)

> 一站式 AI 角色卡工具箱 —— 本地优先、插件驱动、零后端依赖

小兔几是一个基于浏览器的 AI 工具平台，专注于角色卡创作与优化。所有数据存储在用户本地 IndexedDB 中，支持 Vercel 等平台的纯静态部署，无需搭建后端服务。

## ✨ 核心特性

- **🧩 插件系统** — 单文件 `.js` 插件架构，配置/提示词/代码合一，支持导入、导出与在线编辑
- **🤖 多模型兼容** — 兼容所有 OpenAI 格式 API（OpenAI / DeepSeek等），自动拉取模型列表
- **🎭 内置工具集** — 角色设定、世界书、首条消息、正则脚本、风格包等角色卡全链路工具
- **📋 快速回复生成器** — 可视化配置 SillyTavern Quick Reply 按钮，实时预览与 JSON 导出
- **🎬 小剧场** — 社区创意分享空间，支持投稿与浏览
- **📊 执行历史** — 自动记录每次工具执行的输入输出，支持筛选与重新执行
- **🎨 主题切换** — 多套精心调色的暗色主题
- **📱 PWA 支持** — 可添加到手机/桌面主屏幕，离线可用
- **🔌 第三方插件** — 开放的插件开发规范，附带面向 AI 的开发文档，让 AI 也能帮你写插件

## 🛠️ 技术栈

| 类别 | 技术 |
|------|------|
| 框架 | React 19 + TypeScript |
| 构建 | Vite |
| 样式 | Tailwind CSS v4 + shadcn/ui |
| 状态 | Zustand (persist) |
| 存储 | IndexedDB (Dexie.js) |
| AI | OpenAI SDK (兼容格式) |
| Markdown | react-markdown + remark-gfm |
| PWA | vite-plugin-pwa + Workbox |

## 🚀 快速开始

你可以直接通过：

https://tools.laopobao.online/

来使用小兔几工具。

### 环境要求

- Node.js ≥ 18
- npm ≥ 9

### 本地开发

```bash
# 克隆仓库
git clone https://github.com/your-username/nibbli.git
cd nibbli

# 安装依赖
npm install

# 启动开发服务器
npm run dev
```

访问 `http://localhost:5173` 即可使用。

### 构建部署

```bash
# 构建生产包
npm run build

# 本地预览生产包
npm run preview
```

构建产物在 `dist/` 目录下，可直接部署到 Vercel、Netlify、Cloudflare Pages 等任何静态托管平台。

## 📦 项目结构

```
src/
├── core/           # 核心层：数据库、LLM 客户端、插件加载器、解析器
├── tools/          # 工具定义层
│   ├── builtins/   # 内置工具（角色设定、世界书、正则等）
│   ├── registry.ts # 工具注册中心
│   └── index.ts    # 统一导出
├── store/          # Zustand 状态管理
├── ui/
│   ├── components/ # 通用 UI 组件
│   └── pages/      # 页面组件
├── components/     # shadcn/ui 基础组件
└── App.tsx         # 路由入口
```

## 🧩 插件开发

小兔几支持通过单个 `.js` 文件开发第三方插件，无需克隆源码。

- 📖 **完整开发文档**：运行项目后访问 `/plugin-doc` 页面，或查看 `docs/standalone-plugin-guide.md`
- 🤖 **AI 友好规范**：`docs/ai-plugin-prompt.md` 是面向 AI 的精简版规范，复制给 AI 即可辅助编写插件

### 插件文件结构

```javascript
/*---CONFIG---
{ "id": "my_tool", "name": "工具名", "inputs": [...] }
---END_CONFIG---*/

/*---PROMPT---
系统提示词（纯文本 Markdown，无需转义）
---END_PROMPT---*/

/*---EXECUTE---
var result = await context.llmClient.chat.completions.create({...});
return result.choices[0].message.content;
---END_EXECUTE---*/
```

## ⚙️ 环境变量

| 变量 | 说明 | 必需 |
|------|------|------|
| `DATABASE_URL` | Neon 数据库连接串（仅小剧场功能需要） | 否 |

> 将环境变量配置在项目根目录的 `.env` 文件中。大部分功能无需后端数据库，纯前端即可运行。

## 📄 许可证

MIT License
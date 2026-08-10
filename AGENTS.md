# AGENTS.md

## Project Overview

AI 前端每日学习实验室 — 基于 Next.js App Router 的 MCP（Model Context Protocol）学习与演示平台。包含三个核心部分：

- **前端仪表盘**（`src/`）：Next.js 应用，展示每日学习卡片、打卡日历、技能矩阵与模块导航
- **MCP 示例**（`demos/`）：独立 TypeScript 脚本，演示 MCP Server/Client 通过 stdio 通信
- **学习笔记**（`content/daily/`）：按日期组织的 Markdown 笔记，由前端在构建期解析渲染

## Build & Dev Commands

```bash
# 主应用（根目录）
npm install              # 安装依赖
npm run dev              # 启动开发服务器（localhost:3000）
npm run build            # 生产构建
npm run start            # 启动生产服务器
npm run lint             # ESLint 检查

# MCP 演示（独立子包）
cd demos/day1-mcp
npm install              # 安装演示依赖
npm run server           # 启动 MCP Server
npm run client           # 运行测试 Client
```

## Project Structure

```
├── src/app/              # Next.js App Router 页面
│   ├── layout.tsx        # 根布局（暗色主题、全局导航）
│   ├── page.tsx          # 首页仪表盘
│   ├── day/[dayNum]/     # 动态路由：每日学习详情
│   └── modules/          # 模块列表页
├── src/components/       # UI 组件（Tailwind 原子类，无第三方 UI 库）
├── src/hooks/            # React Hooks（useMCPTool 等）
├── src/lib/              # 工具函数（content.ts, markdown.ts, constants.ts）
├── content/daily/        # Markdown 笔记（YYYY-MM-DD.md 命名）
├── demos/day1-mcp/       # MCP Server/Client 示例（独立 package.json）
└── public/               # 静态资源
```

## Tech Stack

- **Framework**: Next.js 16 + React 19 (App Router, Server Components)
- **Styling**: Tailwind CSS v4（暗色主题，zinc/emerald 配色）
- **Language**: TypeScript strict mode, `@/*` 路径别名指向 `src/`
- **Content**: gray-matter 解析 frontmatter, shiki 代码高亮, date-fns 日期计算
- **MCP Demo**: `@modelcontextprotocol/sdk` v1.12, tsx 运行, stdio 传输

## Coding Conventions

### General
- TypeScript 严格模式开启（`noEmit`），由 Next.js 插件负责编译
- 源码路径统一使用 `@/*` 别名（指向 `src/`）
- 新增第三方库必须在对应包的 `dependencies` 或 `devDependencies` 中声明
- 修改依赖后提交更新后的 `package-lock.json`

### UI Components
- 样式完全通过 Tailwind 原子类内联，不使用 CSS Modules / SCSS
- 典型卡片模式：`rounded-xl bg-zinc-800/50 border border-zinc-700/50 hover:border-emerald-500/30`
- 配色体系：zinc 系列中性色 + emerald 系列强调色
- 全局暗色模式（`<html className="dark">`），无亮/暗切换
- 不引入第三方 UI 组件库，所有组件自研

### Content & Markdown
- 每日笔记文件命名：`YYYY-MM-DD.md`（存放于 `content/daily/`）
- 笔记章节结构：今日主题 → 核心概念 → 代码实践 → 思考题 → 延伸阅读
- 笔记顶部以引用块标注元数据（预计用时、难度、日期）
- Markdown 渲染样式统一走 `.prose` 选择器（定义在 `src/app/globals.css`）

### MCP Demo
- Server 能力通过 `server.setRequestHandler` 绑定到 SDK 的 RequestSchema
- Tool 参数使用 JSON Schema 在 `inputSchema` 中声明类型和描述
- 文件系统访问先 `path.resolve(ROOT_DIR, ...)` 再校验防止路径穿越
- 脚本顶部保留中文注释说明用途与运行命令

## Architecture Notes

- **依赖方向单向**：`app → components/hooks → lib`，lib 不反向引用 UI 代码
- **数据获取**：`src/lib/content.ts` 通过 `fs` + `gray-matter` 在构建期扫描 `content/daily/*.md`，生成 `DayContent[]` 供服务端组件调用
- **多包结构**：主应用与 `demos/` 各自维护独立的 `package.json`，互不共享依赖
- **`demos/` 被 `tsconfig.json` 的 `exclude` 排除**，不参与 Next.js 构建

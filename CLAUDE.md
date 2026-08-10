# CLAUDE.md

## Project Summary

AI 前端每日学习实验室：Next.js 16 (App Router) + Tailwind CSS v4 + MCP 协议学习平台。
中文项目，所有注释、文档和 UI 文案使用中文。

## Commands

```bash
npm run dev          # 开发服务器 localhost:3000
npm run build        # 生产构建
npm run lint         # ESLint
cd demos/day1-mcp && npm run server   # MCP 示例服务器
cd demos/day1-mcp && npm run client   # MCP 测试客户端
```

## Key Architecture

- **三层结构**：前端仪表盘 (`src/`) → 内容数据 (`content/daily/*.md`) → MCP 演示 (`demos/`)
- **依赖方向**：`app → components/hooks → lib`，lib 绝不反向引用 UI 代码
- **数据流**：`src/lib/content.ts` 用 `fs` + `gray-matter` 在构建期扫描 Markdown，生成 `DayContent[]` 供服务端组件调用
- **多包隔离**：`demos/` 有独立 `package.json`，被 `tsconfig.json` exclude，不参与 Next.js 构建

## Routing

| 路由 | 文件 | 说明 |
|------|------|------|
| `/` | `src/app/page.tsx` | 仪表盘（统计、进度条、日历、技能矩阵） |
| `/day/[dayNum]` | `src/app/day/[dayNum]/page.tsx` | 每日学习详情（动态路由） |
| `/modules` | `src/app/modules/page.tsx` | 模块列表 |

## Coding Rules

### TypeScript
- 严格模式 + `noEmit`，路径别名 `@/*` → `src/`
- 新增依赖必须声明在 `package.json`，修改后提交 `package-lock.json`

### Styling
- **只用 Tailwind 原子类**，禁止 CSS Modules / SCSS / 独立 CSS 文件（`globals.css` 除外）
- 配色：zinc 中性色 + emerald 强调色，全局暗色模式（`<html className="dark">`）
- 不引入第三方 UI 组件库

### Markdown 内容
- 笔记命名：`content/daily/YYYY-MM-DD.md`
- 章节结构：今日主题 → 核心概念 → 代码实践 → 思考题 → 延伸阅读
- 渲染样式统一走 `.prose` 选择器（`src/app/globals.css`）

### MCP Demo
- Tool 参数用 JSON Schema 声明在 `inputSchema`
- 文件访问必须 `path.resolve(ROOT_DIR, ...)` + 前缀校验防路径穿越
- 脚本顶部保留中文注释

## File Reference

| 文件 | 作用 |
|------|------|
| `src/app/layout.tsx` | 根布局：暗色主题、全局导航栏 |
| `src/lib/constants.ts` | 配置常量（MODULES、SKILLS、TOTAL_DAYS 等） |
| `src/lib/content.ts` | Markdown 内容扫描与统计计算 |
| `src/lib/markdown.ts` | Markdown 解析与 HTML 渲染 |
| `src/hooks/useMCPTool.ts` | MCP 工具调用 Hook（`{ data, loading, error, execute }`） |
| `src/app/globals.css` | Tailwind 导入 + CSS 变量 + `.prose` 排版 |
| `demos/day1-mcp/file-system-server.ts` | MCP Server：文件系统工具 |
| `demos/day1-mcp/test-client.ts` | MCP Client：验证用测试脚本 |

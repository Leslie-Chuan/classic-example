---
kind: frontend_style
name: 基于 Tailwind CSS v4 + 暗色主题的 Next.js 前端样式体系
category: frontend_style
scope:
    - '**'
source_files:
    - src/app/globals.css
    - postcss.config.mjs
    - package.json
    - src/app/layout.tsx
    - src/components/DayCard.tsx
---

## 1. 系统/技术栈

- **框架**：Next.js 16（App Router）+ React 19。
- **样式方案**：Tailwind CSS v4，通过 `@tailwindcss/postcss` PostCSS 插件引入；在 `src/app/globals.css` 中用 `@import "tailwindcss"` 加载。
- **主题模式**：全局强制暗色模式——`layout.tsx` 的 `<html>` 根节点设置 `className="dark"`，配合 `globals.css` 中的 CSS 变量与 Tailwind 的 zinc/emerald 色系实现统一暗色主题。
- **Markdown 渲染样式**：自定义 `.prose` 规则覆盖默认 prose 样式，形成项目内统一的笔记阅读外观。

## 2. 关键文件

| 文件 | 作用 |
|---|---|
| `src/app/globals.css` | 全局样式入口：Tailwind 导入、CSS 变量、body 背景/前景色、`.prose` Markdown 排版样式 |
| `postcss.config.mjs` | 仅启用 `@tailwindcss/postcss`，无其他预处理插件 |
| `package.json` | 声明依赖 `tailwindcss ^4`、`@tailwindcss/postcss ^4`、`shiki`（代码高亮）、`date-fns`、`gray-matter` |
| `src/app/layout.tsx` | 根布局：注入 `lang="zh-CN"`、`className="dark"`、全局 header/main 容器、zinc 色系背景与文字 |
| `src/components/*.tsx` | 各页面组件，全部使用 Tailwind 原子类进行内联样式 |

## 3. 架构与设计约定

### 3.1 设计令牌（Design Tokens）
- 通过 CSS 自定义属性集中定义基础色彩：
  - `--color-bg: #09090b`（zinc-950 级别背景）
  - `--color-fg: #fafafa`（zinc-100 级别前景）
- body 直接使用这两个变量作为背景与文字颜色，确保全局一致。

### 3.2 配色体系
- 主色调：**zinc** 系列用于中性色（背景 `bg-zinc-950`、卡片 `bg-zinc-800/50`、边框 `border-zinc-700/50`、文字 `text-zinc-400/500/200` 等）。
- 强调色：**emerald** 系列用于品牌高亮（`text-emerald-400`、`hover:border-emerald-500/30`、链接 `#34d399` 等），贯穿导航、标签、交互反馈。
- 代码块与引用：使用 `#18181b`（zinc-900）背景 + `#34d399` emerald 文本，与整体暗色主题保持一致。

### 3.3 组件级样式约定
- 所有 UI 组件位于 `src/components/`，样式完全通过 Tailwind 原子类内联，不额外创建独立 CSS 模块。
- 典型卡片模式：`p-4 rounded-xl bg-zinc-800/50 border border-zinc-700/50 hover:border-emerald-500/30 hover:bg-zinc-800 transition-all` —— 半透明背景 + 细边框 + emerald 悬停高亮 + 过渡动画。
- 响应式与布局：使用 Tailwind 内置断点与 flex/grid 工具类，未引入第三方 UI 库。

### 3.4 Markdown 内容样式
- 通过 `.prose` 选择器集中定制 Markdown 渲染输出：标题字号/间距/颜色、段落行高 1.75、列表缩进、blockquote 左侧 emerald 边框、code/pre 深色背景、表格行悬停高亮等。
- 该样式由 `src/lib/markdown.ts` 解析 Markdown 后注入到页面，再由 `globals.css` 统一渲染。

## 4. 约定与约束

- **必须使用 Tailwind 原子类**：组件文件中未见任何自定义 class 名（除 `.prose` 外），所有视觉表现通过 Tailwind 工具类组合完成。
- **全局暗色模式不可切换**：`layout.tsx` 固定 `<html className="dark">`，项目中没有提供明/暗主题切换逻辑。
- **无独立 theme 配置文件**：未创建 `tailwind.config.*`，完全依赖 Tailwind v4 默认主题及 CSS 变量扩展。
- **无 CSS Modules / SCSS / Sass**：PostCSS 配置仅包含 `@tailwindcss/postcss`，未发现 scss/sass/css-modules 相关依赖或用法。
- **无外部 UI 组件库**：未引入 shadcn/ui、Ant Design、MUI 等，所有交互组件（DayCard、ProgressCalendar、SkillMatrix、MCPPlayground 等）均为自研并基于 Tailwind 手写。
- **Markdown 样式统一收敛于 `.prose`**：所有由 `gray-matter` 解析的内容都走同一套排版样式，避免散落的 HTML 样式。
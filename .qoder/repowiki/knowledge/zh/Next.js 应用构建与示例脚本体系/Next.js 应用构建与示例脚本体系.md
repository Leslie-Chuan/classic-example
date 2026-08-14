---
kind: build_system
name: Next.js 应用构建与示例脚本体系
slug: build_system
category: build_system
scope:
    - '**'
---

## 1. 使用的系统/方法

本项目采用 **Next.js 16**（App Router）作为主应用的构建与运行框架，依赖 npm scripts 驱动开发、构建、启动和代码检查流程。演示子项目 `demos/day1-mcp` 使用独立的 `package.json` + `tsx` 直接执行 TypeScript 源文件，无需预编译。

- 主应用：`next dev` / `next build` / `next start` 三个标准生命周期。
- 演示程序：通过 `tsx` 以 ESM 模式直接运行 `file-system-server.ts` 与 `test-client.ts`。
- 样式管线：Tailwind CSS v4 通过 `@tailwindcss/postcss` 在 PostCSS 阶段处理。
- 类型检查：TypeScript 启用 `strict` 与 `isolatedModules`，并通过 Next.js 插件集成；`noEmit: true` 表示仅做类型校验，不输出 JS。

## 2. 关键文件

- `package.json`：定义根项目脚本、依赖版本（Next 16、React 19、Shiki、gray-matter、date-fns）及 ESLint/Tailwind/TS 等开发依赖。
- `next.config.ts`：当前为空配置对象，未添加自定义构建选项。
- `tsconfig.json`：根 TS 配置，目标 ES2017，模块解析为 `bundler`，路径别名 `@/* → ./src/*`，排除 `demos` 目录。
- `demos/tsconfig.json`：演示子项目的独立 TS 配置，目标 ES2022，关闭 strict，同样 `noEmit`。
- `demos/day1-mcp/package.json`：MCP 演示的独立包，依赖 `@modelcontextprotocol/sdk`，提供 `server` 与 `test` 两个脚本。
- `eslint.config.mjs`：基于 `eslint-config-next` 的 Flat Config，覆盖默认忽略规则，保留 `.next`、`out`、`build`、`next-env.d.ts` 的忽略。
- `postcss.config.mjs`：注册 `@tailwindcss/postcss` 插件。

## 3. 架构与约定

- **单仓多包结构**：根目录维护 Next.js 站点，`demos/` 下按天组织独立可运行的示例子包，每个示例自带 `package.json`，互不干扰。
- **脚本即入口**：所有构建/运行命令均通过 `npm run <script>` 暴露，无 Makefile、Dockerfile、CI 流水线或发布脚本。
- **增量类型检查**：根 `tsconfig.json` 开启 `incremental: true`，配合 Next 内置构建加速。
- **路径别名统一**：通过 `@/*` 指向 `src/*`，组件与库引用统一使用该别名。
- **演示与主站解耦**：演示代码被 `tsconfig.json` 的 `exclude: ["demos"]` 排除在主站类型检查之外，避免引入额外依赖影响主站构建。

## 4. 约定与约束

- 开发环境通过 `npm run dev` 启动 Next 开发服务器，生产构建通过 `npm run build` 生成静态产物，部署后由 `npm run start` 启动服务。
- 代码质量检查通过 `npm run lint` 调用 ESLint，遵循 Next 官方规则集（core-web-vitals + typescript）。
- 样式必须经 Tailwind 管道处理，新增 CSS 应使用 Tailwind 类名而非手写 CSS（项目已集成 PostCSS 插件）。
- 演示程序必须以 ESM 形式编写（`demos/day1-mcp/package.json` 声明 `"type": "module"`），并通过 `tsx` 直接执行。
- 仓库中不存在 Dockerfile、Makefile、CI/CD 配置文件（如 GitHub Actions、Jenkinsfile）、版本号自动化脚本或跨平台编译配置——因此本仓库的构建体系仅限于本地 npm scripts 层面。

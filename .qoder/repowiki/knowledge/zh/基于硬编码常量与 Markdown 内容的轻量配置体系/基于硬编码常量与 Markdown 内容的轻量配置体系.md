---
kind: configuration_system
name: 基于硬编码常量与 Markdown 内容的轻量配置体系
category: configuration_system
scope:
    - '**'
source_files:
    - next.config.ts
    - package.json
    - src/lib/constants.ts
    - src/lib/content.ts
    - src/lib/markdown.ts
    - demos/day1-mcp/package.json
---

## 1. 使用的系统/方法

本项目是一个 Next.js 学习实验室，**没有引入专门的配置框架或环境变量管理库**。运行时配置通过以下三种方式组合实现：

- **Next.js 默认配置**：`next.config.ts` 存在但为空对象（仅占位），未启用任何自定义构建选项。
- **TypeScript 模块常量**：业务配置以 `export const` 形式集中在 `src/lib/constants.ts`，作为模块级单例被多处 import。
- **文件系统内容驱动**：`content/daily/*.md` 目录下的 Markdown 文件即“数据配置”，由 `src/lib/content.ts` 在构建/渲染时通过 `fs` 同步读取并解析（gray-matter + date-fns）。

项目根目录不存在 `.env`、`.env.local`、`config/`、`*.yaml`、`*.toml`、`application.properties` 等常见配置文件。`package.json` 中的脚本仅为 `dev/build/start/lint` 四命令，无环境区分。

## 2. 关键文件

| 文件 | 作用 |
|---|---|
| `next.config.ts` | Next.js 配置入口，当前为空对象，未覆盖任何默认行为 |
| `package.json` | 依赖声明与 npm scripts，无 env 相关字段 |
| `src/lib/constants.ts` | 集中定义学习计划模块、技能清单、起始日期、总天数等静态配置 |
| `src/lib/content.ts` | 从 `process.cwd()/content/daily` 扫描 Markdown 文件，解析为 DayContent 列表；计算进度、连续打卡等统计 |
| `src/lib/markdown.ts` | Shiki 高亮器初始化（主题、语言列表）与 Markdown→HTML 转换逻辑 |
| `demos/day1-mcp/package.json` | 独立 MCP 示例的包配置，使用 `tsx` 直接运行 TS 文件，无额外配置 |

## 3. 架构与约定

- **配置即代码**：所有可变的业务参数（模块划分、日期范围、技能项、总天数）都以 TypeScript 常量导出，编译期类型检查保证一致性。
- **内容即配置**：每日学习笔记本身是“配置”——文件名 `YYYY-MM-DD.md` 决定 dayNum，通过 `LEARN_START_DATE` 与 `date-fns` 计算偏移；新增一天只需新增一个 Markdown 文件，无需修改代码。
- **路径约定**：内容根目录通过 `path.join(process.cwd(), "content/daily")` 定位，要求部署时 `content/` 目录与构建产物同级。
- **无分层配置**：不存在 dev/prod/stage 多环境切换；`next.config.ts` 为空意味着所有环境共用同一份构建配置。
- **MCP 示例独立**：`demos/day1-mcp/` 是独立的 Node 子工程，通过 `tsx` 直接执行 TS 源文件，不共享主项目的配置体系。

## 4. 约定与约束

- **Markdown 文件命名必须为 `YYYY-MM-DD.md`**：`content.ts` 中通过 `file.replace(".md", "")` 直接当作日期字符串传给 `parseISO`，不符合该格式的文件会被忽略或导致日期解析错误。
- **每个 Markdown 首行必须是 `# 标题`**：`getDayByNumber` 用正则 `/^#\s+(.+)$/m` 提取标题，缺失则回退为 `Day ${dayNum}`。
- **学习计划变更需同时更新 `constants.ts` 与 `TOTAL_DAYS`**：`getModuleForDay` 使用硬编码的区间边界（56/84/113/141），新增模块需要手动维护这些数字。
- **Shiki 语言白名单**：`markdown.ts` 中显式注册的语言列表即为支持的高亮语言，新增语言需在 `createHighlighter({ langs: [...] })` 中添加。
- **无敏感信息注入**：全仓库未发现 `process.env.*` 引用，因此不存在 secrets 管理、环境变量加载或运行时配置覆盖机制。
- **构建时而非运行时读取内容**：`content.ts` 使用 `fs.readFileSync` 同步读取文件，这意味着内容在 Next.js 构建阶段就被打包进产物，不支持热重载新笔记（除非重启 dev server）。
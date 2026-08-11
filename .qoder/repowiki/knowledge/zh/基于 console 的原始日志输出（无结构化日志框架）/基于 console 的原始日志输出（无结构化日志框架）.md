---
kind: logging_system
name: 基于 console 的原始日志输出（无结构化日志框架）
category: logging_system
scope:
    - '**'
source_files:
    - demos/day2-mcp-server/frontend-helper-server.ts
    - demos/day1-mcp/file-system-server.ts
    - demos/day1-mcp/test-client.ts
    - demos/day3-mcp-client/smart-client.ts
    - package.json
---

## 1. 使用的系统/方法

本仓库**没有引入任何第三方日志框架**（如 pino、winston、bunyan、log4js、morgan、debug 等）。所有日志输出均直接使用 Node.js / 浏览器原生的 `console.log`、`console.error`，以及 MCP Server 启动时的 `process.exit(1)` 退出码。

- 依赖清单（`package.json`）中不存在任何日志相关依赖。
- Next.js 前端代码（`src/`）中未出现任何 `console.*` 调用——前端通过 UI 展示内容，不产生运行时日志。
- 教学示例脚本（`demos/day*-*/`）是唯一的日志输出来源，且全部为人类可读的控制台文本。

## 2. 关键文件

| 文件 | 作用 |
|---|---|
| `demos/day1-mcp/file-system-server.ts` | MCP Server 启动时打印 `console.error("File System MCP Server running on stdio")` |
| `demos/day1-mcp/test-client.ts` | 演示用 Client，大量 `console.log` 输出工具发现、调用结果 |
| `demos/day2-mcp-server/frontend-helper-server.ts` | MCP Server；注释明确说明“日志只能写 stderr，stdout 被 JSON-RPC 协议独占”，仅用 `console.error` |
| `demos/day3-mcp-client/smart-client.ts` | MCP Client；区分 Transport 错误与业务错误，分别以 `console.error` / `console.log` 输出 |
| `package.json` | 确认无任何日志库依赖 |

## 3. 架构与约定

- **stdio 传输约束**：MCP 使用 stdio JSON-RPC 协议，Server 的 stdout 通道被 JSON-RPC 消息独占，因此日志必须写入 stderr。`frontend-helper-server.ts` 中的注释显式声明了这一约束：“日志只能写 stderr，stdout 被 JSON-RPC 协议独占”。
- **错误分类输出**：Client 将错误分为两类并采用不同输出方式——Transport 级异常（连接断开、JSON-RPC 解析失败）走 `console.error`；业务级错误（`isError: true`）走 `console.log` 并附带前缀提示。
- **无结构化字段**：日志均为纯字符串拼接，不包含时间戳、级别、traceId、请求 ID、模块名等结构化字段。
- **无日志级别管理**：没有 debug/info/warn/error 分级开关，也没有环境变量控制日志粒度。
- **无统一 logger 模块**：`src/lib/` 下仅有 `constants.ts`、`content.ts`、`markdown.ts`，不存在 `logger.ts`、`logging.ts` 等集中化日志初始化文件。

## 4. 约定与约束

- **约束（由实现强制）**：在 MCP Server 中，禁止向 `stdout` 写入日志，因为该通道承载 JSON-RPC 协议帧；应使用 `console.error`（stderr）输出诊断信息（见 `demos/day2-mcp-server/frontend-helper-server.ts` 第 220–228 行注释及实现）。
- **约定（观察到的模式）**：教学脚本中的日志全部面向人类阅读，包含 emoji 前缀（如 `📦`、`⚠️`、`✓`）和分节标题（如 `── 能力发现（listTools）──`），便于课堂演示时快速定位输出段落。
- **约束（由项目性质决定）**：Next.js 应用本身（`src/app/`、`src/components/`、`src/hooks/`）不产生服务端或客户端日志输出，日志职责完全集中在 `demos/` 下的独立 Node 脚本中。
- **无持久化/聚合**：日志直接输出到进程标准流，未被重定向至文件、远程收集器或监控系统。

综上，该项目属于“无日志框架”的轻量学习仓库，日志实践仅为满足 MCP stdio 协议约束的最小化 `console.error`/`console.log` 输出，不具备生产级日志系统的特征。
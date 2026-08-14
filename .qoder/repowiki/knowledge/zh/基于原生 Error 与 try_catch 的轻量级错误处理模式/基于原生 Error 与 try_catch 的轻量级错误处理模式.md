---
kind: error_handling
name: 基于原生 Error 与 try/catch 的轻量级错误处理模式
slug: error_handling
category: error_handling
scope:
    - '**'
---

## 1. 整体方法
仓库未引入专用错误库或统一错误类型体系，而是采用 TypeScript/JavaScript 原生的 `Error` + `try/catch/finally` 模式。错误以字符串消息形式在调用链中传播，最终通过 `console.error` 或组件状态展示给终端用户。

## 2. 关键位置与文件
- **MCP Server（demos/day1-mcp/file-system-server.ts）**：所有 Tool/Resource 处理器在参数校验失败、未知工具或资源时直接 `throw new Error(...)`，例如路径越界抛出 `Access denied: path outside project root`，未知 tool/resource 抛出 `Unknown tool/resource`。进程启动后通过 `main().catch(console.error)` 兜底捕获未处理异常。
- **MCP Client（demos/day1-mcp/test-client.ts）**：作为测试脚本，同样使用 `main().catch(console.error)` 作为全局错误出口，无自定义重试或降级逻辑。
- **React Hook（src/hooks/useMCPTool.ts）**：封装 MCP Tool 调用的核心错误处理点。每次 `execute` 调用先 `setError(null)`，再用 `AbortController` 实现超时（默认 30s），网络请求非 `res.ok` 时抛出自定义 `Error('MCP Server error: ${status} ${statusText}')`；`catch` 块将任意异常归一化为 `Error` 并写入 `error` 状态，`finally` 重置 `loading`。Hook 返回 `{ data, loading, error, execute }` 三元组供组件消费。
- **Markdown 渲染（src/lib/markdown.ts）**：对 Shiki 高亮调用使用内联 `try/catch`，当语言未加载或高亮失败时回退为纯文本 `<pre><code>` 输出，保证渲染流程不因单个代码块失败而中断。
- **演示组件（src/components/MCPPlayground.tsx）**：在模拟环境中通过字符串拼接生成错误提示（如 `Error: 文件 "..." 不存在`），属于 UI 层错误文案而非运行时异常。

## 3. 架构与约定
- **Server 侧**：每个 Tool/Resource 处理器内部自行校验输入并在非法时立即 `throw`，由 @modelcontextprotocol/sdk 框架负责将其转换为协议错误响应；没有统一的中间件或错误码枚举。
- **Client 侧**：HTTP 层统一检查 `res.ok` 并包装为带状态码信息的 `Error`；异步调用通过 AbortController 支持超时取消。
- **UI 侧**：React Hook 将错误收敛到单一 `error` 字段，组件只需读取该字段决定是否显示错误信息，不向上冒泡异常。
- **渲染侧**：局部 `try/catch` 保护第三方库调用，失败即降级，避免单点故障影响整页渲染。

## 4. 约定与约束
- 服务端工具/资源处理器必须对路径等输入做边界校验，越界时抛出带明确语义的 `Error`（如 `Access denied: path outside project root`）。
- 客户端 HTTP 调用必须检查 `res.ok`，非成功状态需抛出自包含状态信息的 `Error`，以便上层区分网络错误与业务错误。
- 所有顶层入口函数（`main`）必须以 `.catch(console.error)` 收尾，确保未捕获异常不会静默失败。
- React Hook 暴露的 `error` 字段类型为 `Error | null`，调用方应始终判空后再渲染错误 UI。
- Markdown 高亮等可选功能必须用 `try/catch` 包裹，失败时回退到安全降级输出，不得中断主流程。
- 仓库未定义统一错误类、错误码常量或全局错误处理器，因此新增模块时应遵循上述就近 `throw` + 就近 `catch` 的模式，避免散落裸 `throw`。
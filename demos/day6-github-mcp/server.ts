// Day 6：协议层 — MCP Server 组装
// 将领域层和编排层组装为完整的 MCP Server
// 这一层应该"薄而稳定"，不包含业务逻辑
// 架构位置：Transport & Protocol Layer

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

import { issueTools } from "./domain/issues.js";
import {
  authenticate,
  filterToolsByScope,
  assertToolPermission,
  checkRateLimit,
  normalizeError,
  type AuthContext,
} from "./orchestration/gateway.js";

// ═══════════════════════════════════════════════
// 步骤 1：认证上下文初始化
// ═══════════════════════════════════════════════

const MOCK_AUTH_HEADER = process.env.MOCK_AUTH_HEADER || "Bearer ghp_demo_readonly";

let authContext: AuthContext;
try {
  authContext = authenticate(MOCK_AUTH_HEADER);
  console.error(`[Server] Token 认证成功，scopes: [${authContext.scopes.join(", ")}]`);
} catch (e) {
  console.error("[Server] 认证失败，使用最小权限模式");
  authContext = { token: "none", scopes: [], rateLimitRemaining: 0, rateLimitReset: 0 };
}

// ═══════════════════════════════════════════════
// 步骤 2：权限过滤 — 决定暴露哪些 Tool
// ═══════════════════════════════════════════════
// 这正是 GitHub MCP 在 initialize 阶段做的事情

const allTools = [...issueTools];
const exposedTools = filterToolsByScope(allTools, authContext);

console.error(`[Server] 已注册 ${allTools.length} 个 Tool，当前 token 可访问 ${exposedTools.length} 个`);
exposedTools.forEach((t) => console.error(`  - ${t.name} (${t.requiredScopes.join(", ")})`));

const hiddenTools = allTools.filter((t) => !exposedTools.includes(t));
if (hiddenTools.length > 0) {
  console.error(`[Server] 隐藏的 Tool（权限不足）:`);
  hiddenTools.forEach((t) => console.error(`  ✗ ${t.name} (需要: ${t.requiredScopes.join(", ")})`));
}

// ═══════════════════════════════════════════════
// 步骤 3：MCP Server 初始化
// ═══════════════════════════════════════════════

const server = new Server(
  { name: "github-like-mcp-server", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

// ═══════════════════════════════════════════════
// 步骤 4：Tool 发现（返回过滤后的列表）
// ═══════════════════════════════════════════════

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: exposedTools.map((t) => ({
    name: t.name,
    description: t.description,
    inputSchema: t.inputSchema,
  })),
}));

// ═══════════════════════════════════════════════
// 步骤 5：Tool 调用（权限检查 → 速率限制 → 执行 → 错误处理）
// ═══════════════════════════════════════════════

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  // 1. 查找 Tool 定义
  const tool = exposedTools.find((t) => t.name === name);
  if (!tool) {
    return {
      content: [{ type: "text" as const, text: `错误: Tool "${name}" 不存在或当前 token 无权访问` }],
      isError: true,
    };
  }

  try {
    // 2. 双重权限检查（防御性编程）
    assertToolPermission(tool, authContext);

    // 3. 速率限制检查
    checkRateLimit(authContext);

    // 4. 执行业务逻辑（领域层 handler）
    return await tool.handler(args);
  } catch (err) {
    // 5. 统一错误处理 → LLM 友好格式
    const normalized = normalizeError(err);
    return {
      content: [{ type: "text" as const, text: normalized.message }],
      isError: normalized.isError,
    };
  }
});

// ═══════════════════════════════════════════════
// 步骤 6：启动 stdio Transport
// ═══════════════════════════════════════════════

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("GitHub-like MCP Server running on stdio");
}

main().catch(console.error);

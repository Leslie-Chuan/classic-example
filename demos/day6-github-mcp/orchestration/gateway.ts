// Day 6：编排层 — 权限过滤、速率限制、错误统一处理
// 这是 GitHub MCP 架构中最值得学习的部分
// 架构位置：Orchestration Layer（编排中间层）

import type { ToolDefinition } from "../domain/issues.js";

// ═══════════════════════════════════════════════
// 认证上下文
// ═══════════════════════════════════════════════

export interface AuthContext {
  token: string;
  scopes: string[];
  rateLimitRemaining: number;
  rateLimitReset: number;
}

// ═══════════════════════════════════════════════
// 自定义错误类型（MCP 专用）
// ═══════════════════════════════════════════════
// 每种错误类型对应不同的处理策略和 LLM 友好消息

export class MCPAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MCPAuthError";
  }
}

export class MCPRateLimitError extends Error {
  constructor(public resetAt: number) {
    super(`API 速率限制已达上限。请在 ${new Date(resetAt).toLocaleTimeString()} 后重试。`);
    this.name = "MCPRateLimitError";
  }
}

export class MCPScopeError extends Error {
  constructor(toolName: string, missing: string[]) {
    super(`调用 "${toolName}" 需要以下权限: ${missing.join(", ")}。当前 token 不具备这些权限。`);
    this.name = "MCPScopeError";
  }
}

// ═══════════════════════════════════════════════
// 模拟 Token 存储
// ═══════════════════════════════════════════════
// 生产环境中从 OAuth 流程或密钥管理器获取

const DEFAULT_TOKENS: AuthContext[] = [
  {
    token: "ghp_demo_readonly",
    scopes: ["repo"],
    rateLimitRemaining: 5,
    rateLimitReset: Date.now() + 3600000,
  },
  {
    token: "ghp_demo_full",
    scopes: ["repo", "issues:write"],
    rateLimitRemaining: 100,
    rateLimitReset: Date.now() + 3600000,
  },
];

function loadMockTokens(): AuthContext[] {
  const raw = process.env.MOCK_TOKENS;
  if (raw) {
    try { return JSON.parse(raw); } catch {}
  }
  return DEFAULT_TOKENS;
}

const mockTokens = loadMockTokens();

// ═══════════════════════════════════════════════
// 认证中间件
// ═══════════════════════════════════════════════

export function authenticate(tokenHeader?: string): AuthContext {
  if (!tokenHeader) {
    throw new MCPAuthError("缺少 Authorization 头");
  }
  const token = tokenHeader.replace(/^Bearer\s+/i, "");
  const ctx = mockTokens.find((t) => t.token === token);
  if (!ctx) {
    throw new MCPAuthError("无效的 token");
  }
  return { ...ctx }; // 返回副本，避免多个 Server 实例共享状态
}

// ═══════════════════════════════════════════════
// 速率限制中间件
// ═══════════════════════════════════════════════

export function checkRateLimit(ctx: AuthContext): void {
  if (ctx.rateLimitRemaining <= 0) {
    throw new MCPRateLimitError(ctx.rateLimitReset);
  }
  ctx.rateLimitRemaining--;
}

// ═══════════════════════════════════════════════
// 权限过滤：根据 scope 决定暴露哪些 Tool
// ═══════════════════════════════════════════════
// GitHub MCP 最精妙的设计：initialize 阶段就过滤掉不可用的工具
// 让模型只看到"它能做的事"，避免无效的 LLM 往返

export function filterToolsByScope(
  allTools: ToolDefinition[],
  ctx: AuthContext
): ToolDefinition[] {
  return allTools.filter((tool) => {
    const missing = tool.requiredScopes.filter((s) => !ctx.scopes.includes(s));
    return missing.length === 0;
  });
}

// 双重权限检查（防御性编程）
export function assertToolPermission(tool: ToolDefinition, ctx: AuthContext): void {
  const missing = tool.requiredScopes.filter((s) => !ctx.scopes.includes(s));
  if (missing.length > 0) {
    throw new MCPScopeError(tool.name, missing);
  }
}

// ═══════════════════════════════════════════════
// 统一错误翻译器
// ═══════════════════════════════════════════════
// 将底层错误翻译为 LLM 友好的 MCP 错误格式
// 错误信息本身就是 Prompt 的一部分

export function normalizeError(err: unknown): { message: string; isError: true } {
  if (err instanceof MCPAuthError) {
    return { message: `🔒 认证失败: ${err.message}`, isError: true };
  }
  if (err instanceof MCPRateLimitError) {
    return { message: `⏳ ${err.message}`, isError: true };
  }
  if (err instanceof MCPScopeError) {
    return { message: `🛡️ 权限不足: ${err.message}`, isError: true };
  }
  if (err instanceof Error) {
    return { message: `❌ 执行错误: ${err.message}`, isError: true };
  }
  return { message: "❌ 未知错误", isError: true };
}

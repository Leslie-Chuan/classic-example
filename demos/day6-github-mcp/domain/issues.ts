// Day 6：领域层 — 模块化 Tool 定义
// 设计要点：每个 Tool 附带 requiredScopes 元数据，供编排层做权限过滤
// 架构位置：Domain Layer（业务逻辑层）

import { z } from "zod";

// ═══════════════════════════════════════════════
// 输入校验 Schema（Zod 运行时校验）
// ═══════════════════════════════════════════════

export const CreateIssueSchema = z.object({
  owner: z.string().describe("仓库所有者"),
  repo: z.string().describe("仓库名"),
  title: z.string().min(1).max(256).describe("Issue 标题"),
  body: z.string().optional().describe("Issue 内容（Markdown）"),
  labels: z.array(z.string()).optional().describe("标签列表"),
});

export const ListIssuesSchema = z.object({
  owner: z.string(),
  repo: z.string(),
  state: z.enum(["open", "closed", "all"]).default("open"),
  per_page: z.number().min(1).max(100).default(30),
});

export const CloseIssueSchema = z.object({
  owner: z.string(),
  repo: z.string(),
  issue_number: z.number().int().positive(),
});

// ═══════════════════════════════════════════════
// Tool 元数据类型（领域层核心抽象）
// ═══════════════════════════════════════════════

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: object;
  requiredScopes: string[]; // OAuth scope 要求，供编排层过滤
  handler: (args: unknown) => Promise<{ content: Array<{ type: "text"; text: string }> }>;
}

// ═══════════════════════════════════════════════
// 模拟 GitHub API 数据存储
// ═══════════════════════════════════════════════

type Issue = {
  number: number;
  title: string;
  body?: string;
  state: "open" | "closed";
  labels: string[];
  created_at: string;
};

const mockDB = new Map<string, Issue[]>();
let globalIssueCounter = 100;

function getRepoKey(owner: string, repo: string) {
  return `${owner}/${repo}`;
}

// ═══════════════════════════════════════════════
// Tool 实现
// ═══════════════════════════════════════════════

export const createIssueTool: ToolDefinition = {
  name: "github_create_issue",
  description: "在指定仓库创建一个新的 Issue。需要 repo + issues:write 权限。",
  inputSchema: {
    type: "object",
    properties: {
      owner: { type: "string", description: "仓库所有者用户名" },
      repo: { type: "string", description: "仓库名称" },
      title: { type: "string", description: "Issue 标题" },
      body: { type: "string", description: "Issue 正文（支持 Markdown）" },
      labels: { type: "array", items: { type: "string" }, description: "标签列表" },
    },
    required: ["owner", "repo", "title"],
  },
  requiredScopes: ["repo", "issues:write"],
  handler: async (args) => {
    const parsed = CreateIssueSchema.parse(args);
    const key = getRepoKey(parsed.owner, parsed.repo);

    const issue: Issue = {
      number: ++globalIssueCounter,
      title: parsed.title,
      body: parsed.body,
      state: "open",
      labels: parsed.labels || [],
      created_at: new Date().toISOString(),
    };

    const issues = mockDB.get(key) || [];
    issues.push(issue);
    mockDB.set(key, issues);

    return {
      content: [{
        type: "text" as const,
        text: `✅ Issue #${issue.number} 已创建\n标题: ${issue.title}\n状态: ${issue.state}\n标签: ${issue.labels.join(", ") || "无"}`,
      }],
    };
  },
};

export const listIssuesTool: ToolDefinition = {
  name: "github_list_issues",
  description: "列出仓库中的 Issue，支持按状态过滤。只需要 repo 读权限。",
  inputSchema: {
    type: "object",
    properties: {
      owner: { type: "string" },
      repo: { type: "string" },
      state: { type: "string", enum: ["open", "closed", "all"], default: "open" },
      per_page: { type: "number", default: 30 },
    },
    required: ["owner", "repo"],
  },
  requiredScopes: ["repo"],
  handler: async (args) => {
    const parsed = ListIssuesSchema.parse(args);
    const key = getRepoKey(parsed.owner, parsed.repo);
    const issues = mockDB.get(key) || [];

    const filtered =
      parsed.state === "all" ? issues : issues.filter((i) => i.state === parsed.state);
    const paginated = filtered.slice(0, parsed.per_page);

    const lines = paginated.map(
      (i) => `#${i.number} [${i.state.toUpperCase()}] ${i.title} | 标签: ${i.labels.join(", ") || "无"}`
    );

    return {
      content: [{
        type: "text" as const,
        text: `找到 ${paginated.length} 个 Issue（共 ${filtered.length} 个）:\n${lines.join("\n") || "（无）"}`,
      }],
    };
  },
};

export const closeIssueTool: ToolDefinition = {
  name: "github_close_issue",
  description: "关闭指定 Issue。需要 repo + issues:write 权限。",
  inputSchema: {
    type: "object",
    properties: {
      owner: { type: "string" },
      repo: { type: "string" },
      issue_number: { type: "number", description: "Issue 编号" },
    },
    required: ["owner", "repo", "issue_number"],
  },
  requiredScopes: ["repo", "issues:write"],
  handler: async (args) => {
    const parsed = CloseIssueSchema.parse(args);
    const key = getRepoKey(parsed.owner, parsed.repo);
    const issues = mockDB.get(key) || [];
    const issue = issues.find((i) => i.number === parsed.issue_number);

    if (!issue) {
      return { content: [{ type: "text" as const, text: `❌ Issue #${parsed.issue_number} 不存在` }] };
    }
    if (issue.state === "closed") {
      return { content: [{ type: "text" as const, text: `ℹ️ Issue #${issue.number} 已经是关闭状态` }] };
    }

    issue.state = "closed";
    return {
      content: [{ type: "text" as const, text: `✅ Issue #${issue.number} 已关闭\n标题: ${issue.title}` }],
    };
  },
};

// 导出问题域的所有 Tool
export const issueTools = [createIssueTool, listIssuesTool, closeIssueTool];

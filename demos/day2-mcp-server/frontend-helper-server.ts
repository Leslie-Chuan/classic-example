// Day 2：搭建第一个 MCP Server（Node.js 版）
// 三层架构：Transport → Protocol → Handler
// 3 个 Tool：analyze_deps / check_outdated / suggest_component_path

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

// ═══════════════════════════════════════════════
// 步骤 1：定义 Tool 的 Schema（Zod 运行时校验）
// ═══════════════════════════════════════════════
// Schema 是 MCP 的核心契约：LLM 用它生成参数，Client 用它校验，Server 用它防御

const AnalyzeDepsSchema = z.object({
  packageJsonPath: z.string().describe("package.json 的绝对路径"),
  depth: z.number().min(1).max(3).optional().default(2)
    .describe("依赖分析深度，1=直接依赖，2=包含子依赖"),
});

const CheckOutdatedSchema = z.object({
  cwd: z.string().describe("执行 npm outdated 的工作目录"),
});

const SuggestComponentPathSchema = z.object({
  componentName: z.string().describe("组件名，例如 UserProfile"),
  framework: z.enum(["react", "vue", "svelte"]).describe("前端框架"),
  feature: z.string().optional().describe("所属业务域，例如 user-auth"),
});

type ToolName = "analyze_deps" | "check_outdated" | "suggest_component_path";

// ═══════════════════════════════════════════════
// 步骤 2：初始化 Server + 声明 Capabilities
// ═══════════════════════════════════════════════
// capabilities 是 Server 的"自我介绍"，Client 据此决定显示哪些交互入口

const server = new Server(
  { name: "frontend-helper-server", version: "1.0.0" },
  { capabilities: { tools: {} } }  // 声明支持 Tool 调用
);

// ═══════════════════════════════════════════════
// 步骤 3：注册 Tool 列表处理器（能力发现）
// ═══════════════════════════════════════════════
// Client 调用 listTools 时触发，返回所有可用 Tool 及其 JSON Schema

server.setRequestHandler(ListToolsRequestSchema, async () => {
  const tools: Tool[] = [
    {
      name: "analyze_deps",
      description: "分析 package.json 的依赖结构，返回依赖数量、占比、冗余提示",
      inputSchema: {
        type: "object",
        properties: {
          packageJsonPath: { type: "string" },
          depth: { type: "number", minimum: 1, maximum: 3 },
        },
        required: ["packageJsonPath"],
      },
    },
    {
      name: "check_outdated",
      description: "在指定目录运行 npm outdated，返回可升级依赖列表及严重程度",
      inputSchema: {
        type: "object",
        properties: { cwd: { type: "string" } },
        required: ["cwd"],
      },
    },
    {
      name: "suggest_component_path",
      description: "根据组件名和框架，生成推荐的项目文件路径",
      inputSchema: {
        type: "object",
        properties: {
          componentName: { type: "string" },
          framework: { type: "string", enum: ["react", "vue", "svelte"] },
          feature: { type: "string" },
        },
        required: ["componentName", "framework"],
      },
    },
  ];
  return { tools };
});

// ═══════════════════════════════════════════════
// 步骤 4：注册 Tool 调用处理器（业务逻辑）
// ═══════════════════════════════════════════════
// Client 调用 callTool 时触发，switch 分发到具体 Tool 实现

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name as ToolName) {

      // ── Tool 1: 依赖分析 ──────────────────
      case "analyze_deps": {
        const { packageJsonPath, depth } = AnalyzeDepsSchema.parse(args);
        const fs = await import("fs/promises");
        const raw = await fs.readFile(packageJsonPath, "utf-8");
        const pkg = JSON.parse(raw);

        const deps = Object.keys(pkg.dependencies || {});
        const devDeps = Object.keys(pkg.devDependencies || {});
        const redundancy = detectRedundancy([...deps, ...devDeps]);

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              totalDirect: deps.length + devDeps.length,
              prodCount: deps.length,
              devCount: devDeps.length,
              prodRatio: +(deps.length / (deps.length + devDeps.length || 1)).toFixed(2),
              devRatio: +(devDeps.length / (deps.length + devDeps.length || 1)).toFixed(2),
              redundancyHints: redundancy,
              analyzedDepth: depth,
            }, null, 2),
          }],
        };
      }

      // ── Tool 2: 过时依赖检查 ──────────────
      case "check_outdated": {
        const { cwd } = CheckOutdatedSchema.parse(args);
        const { execSync } = await import("child_process");
        let stdout: string;
        try {
          stdout = execSync("npm outdated --json", {
            cwd, encoding: "utf-8", timeout: 15000,
          });
        } catch (e: any) {
          // npm outdated 非零退出码 = 有过时依赖，stdout 仍有 JSON
          stdout = e.stdout || "{}";
        }
        const outdated = JSON.parse(stdout || "{}");
        const summary = Object.entries(outdated).map(([pkg, info]: [string, any]) => ({
          package: pkg,
          current: info.current,
          wanted: info.wanted,
          latest: info.latest,
          severity: calcUpgradeSeverity(info.current, info.wanted, info.latest),
        }));

        return {
          content: [{
            type: "text",
            text: JSON.stringify({ outdatedCount: summary.length, packages: summary }, null, 2),
          }],
        };
      }

      // ── Tool 3: 组件路径建议 ──────────────
      case "suggest_component_path": {
        const { componentName, framework, feature } = SuggestComponentPathSchema.parse(args);
        const base = feature ? `src/features/${feature}/components` : `src/components`;
        const ext = framework === "vue" ? ".vue" : framework === "svelte" ? ".svelte" : ".tsx";
        const testExt = framework === "react" ? ".test.tsx" : ".spec" + ext;

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              component: `${base}/${componentName}/${componentName}${ext}`,
              test: `${base}/${componentName}/${componentName}${testExt}`,
              index: `${base}/${componentName}/index.ts`,
              story: framework === "react"
                ? `${base}/${componentName}/${componentName}.stories.tsx`
                : null,
              rationale: `遵循 ${framework} 社区推荐的扁平化目录结构，组件及附属文件聚合在同一目录。`,
            }, null, 2),
          }],
        };
      }

      default:
        throw new Error(`未知工具: ${name}`);
    }
  } catch (err: any) {
    return {
      content: [{ type: "text", text: `执行失败: ${err.message}` }],
      isError: true,
    };
  }
});

// ═══════════════════════════════════════════════
// 步骤 5：辅助函数
// ═══════════════════════════════════════════════

function detectRedundancy(deps: string[]): string[] {
  const hints: string[] = [];
  const set = new Set(deps.map((d) => d.toLowerCase()));
  if (set.has("moment") && set.has("dayjs"))
    hints.push("moment 与 dayjs 功能重叠，建议统一为 dayjs");
  if (set.has("lodash") && set.has("underscore"))
    hints.push("lodash 与 underscore 功能重叠");
  if (set.has("axios") && deps.includes("node-fetch"))
    hints.push("axios 与 fetch 共存，评估是否可以统一");
  return hints;
}

function calcUpgradeSeverity(current: string, wanted: string, latest: string): "patch" | "minor" | "major" {
  const cur = current.split(".").map(Number);
  const lat = latest.split(".").map(Number);
  if (cur[0] !== lat[0]) return "major";
  if (cur[1] !== lat[1]) return "minor";
  return "patch";
}

// ═══════════════════════════════════════════════
// 步骤 6：启动 stdio Transport
// ═══════════════════════════════════════════════
// 日志只能写 stderr，stdout 被 JSON-RPC 协议独占

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Frontend Helper MCP Server running on stdio");
}

main().catch((err) => {
  console.error("Server fatal error:", err);
  process.exit(1);
});

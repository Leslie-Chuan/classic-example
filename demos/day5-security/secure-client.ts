// Day 5：带权限管控的 MCP Client Gateway
// 四层防御：Transport → Discovery → Execution → Audit
//
// 核心设计：
//   Server 端不做权限校验 → Client 必须在调用前拦截
//   权限规则：路径白名单 + 风险分级 + 用户确认 + 调用次数限制
//
// 运行方式: npx tsx secure-client.ts

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import type { TextContent } from "@modelcontextprotocol/sdk/types.js";
import * as path from "node:path";

// ═══════════════════════════════════════════════
// 第 1 层：权限规则配置（Discovery 层）
// ═══════════════════════════════════════════════
// 生产环境中，这些规则应从配置文件或管理后台动态加载

interface PermissionRule {
  toolPattern: RegExp;
  allowedPaths?: string[];
  requireConfirmation: boolean;
  riskLevel: "low" | "medium" | "high";
  maxCalls?: number;
}

const PROJECT_ROOT = path.resolve(import.meta.dirname, "../..");

const PERMISSION_RULES: PermissionRule[] = [
  {
    toolPattern: /^read_file$/,
    allowedPaths: [PROJECT_ROOT],
    requireConfirmation: false,
    riskLevel: "low",
  },
  {
    toolPattern: /^list_directory$/,
    allowedPaths: [PROJECT_ROOT],
    requireConfirmation: false,
    riskLevel: "low",
  },
  {
    toolPattern: /^write_file$/,
    allowedPaths: [path.join(PROJECT_ROOT, "sandbox")],
    requireConfirmation: true,
    riskLevel: "high",
  },
  {
    toolPattern: /^execute_command$/,
    requireConfirmation: true,
    riskLevel: "high",
    maxCalls: 3,
  },
];

// ═══════════════════════════════════════════════
// 第 2 层：审计日志（Audit 层）
// ═══════════════════════════════════════════════

interface AuditRecord {
  timestamp: string;
  tool: string;
  args: Record<string, unknown>;
  decision: "allow" | "deny" | "confirm_allow" | "confirm_deny";
  reason: string;
}

const auditLog: AuditRecord[] = [];

function recordAudit(record: AuditRecord) {
  auditLog.push(record);
  const icon = record.decision === "deny" || record.decision === "confirm_deny" ? "🚫" : "✅";
  console.log(`  ${icon} [AUDIT] ${record.decision.toUpperCase()} | ${record.tool} | ${record.reason}`);
}

// ═══════════════════════════════════════════════
// 路径安全工具函数
// ═══════════════════════════════════════════════

function extractPath(args: Record<string, unknown>): string | null {
  const pathKeys = ["filepath", "dirpath", "path", "file", "directory"];
  for (const key of pathKeys) {
    if (typeof args[key] === "string") return args[key] as string;
  }
  return null;
}

function isPathAllowed(target: string, allowedPaths: string[]): boolean {
  const resolved = path.resolve(target);
  return allowedPaths.some((allowed) => {
    const resolvedAllowed = path.resolve(allowed);
    return resolved === resolvedAllowed || resolved.startsWith(resolvedAllowed + path.sep);
  });
}

// ═══════════════════════════════════════════════
// 第 3 层：权限引擎（Execution 层）
// ═══════════════════════════════════════════════

class PermissionEngine {
  private callCounters = new Map<string, number>();

  evaluate(toolName: string, args: Record<string, unknown>): {
    allowed: boolean;
    reason: string;
    requireConfirm: boolean;
  } {
    // 1. 查找匹配的规则
    const rule = PERMISSION_RULES.find((r) => r.toolPattern.test(toolName));
    if (!rule) {
      return { allowed: false, reason: `工具 "${toolName}" 未在权限规则中注册（默认拒绝）`, requireConfirm: false };
    }

    // 2. 调用次数检查
    const currentCount = this.callCounters.get(toolName) || 0;
    if (rule.maxCalls !== undefined && currentCount >= rule.maxCalls) {
      return { allowed: false, reason: `"${toolName}" 调用次数已达上限 (${rule.maxCalls})`, requireConfirm: false };
    }

    // 3. 路径白名单检查
    if (rule.allowedPaths && rule.allowedPaths.length > 0) {
      const targetPath = extractPath(args);
      if (targetPath && !isPathAllowed(targetPath, rule.allowedPaths)) {
        return {
          allowed: false,
          reason: `路径 "${targetPath}" 不在允许列表内`,
          requireConfirm: false,
        };
      }
    }

    // 4. 确认拦截
    if (rule.requireConfirmation) {
      return { allowed: true, reason: `高风险操作（${rule.riskLevel}），需用户确认`, requireConfirm: true };
    }

    return { allowed: true, reason: `低风险操作（${rule.riskLevel}），直接放行`, requireConfirm: false };
  }

  incrementCounter(toolName: string) {
    this.callCounters.set(toolName, (this.callCounters.get(toolName) || 0) + 1);
  }
}

// ═══════════════════════════════════════════════
// Secure MCP Gateway
// ═══════════════════════════════════════════════

class SecureMCPGateway {
  private client: Client;
  private permission = new PermissionEngine();

  constructor(private serverCommand: string, private serverArgs: string[]) {
    this.client = new Client({ name: "secure-gateway", version: "1.0.0" });
  }

  async connect() {
    const transport = new StdioClientTransport({
      command: this.serverCommand,
      args: this.serverArgs,
      cwd: PROJECT_ROOT,
    });
    await this.client.connect(transport);

    const { tools } = await this.client.listTools();
    console.log("\n  === 能力发现 + 风险分析 ===");
    for (const tool of tools) {
      const rule = PERMISSION_RULES.find((r) => r.toolPattern.test(tool.name));
      const riskLabel = rule ? `[${rule.riskLevel.toUpperCase()}]` : "[UNKNOWN-默认拒绝]";
      const riskIcon = riskLabel.includes("HIGH") ? "🔴" : riskLabel.includes("LOW") ? "🟢" : "🟡";
      console.log(`  ${riskIcon} ${riskLabel} ${tool.name}: ${tool.description}`);
    }
    console.log("  =============================\n");
  }

  /**
   * 带权限管控的工具调用
   * demoMode: true 时自动确认高风险操作（用于自动化演示）
   */
  async callTool(
    toolName: string,
    args: Record<string, unknown>,
    demoMode: boolean = true,
  ): Promise<string> {
    const evaluation = this.permission.evaluate(toolName, args);

    // 被规则拒绝
    if (!evaluation.allowed) {
      recordAudit({
        timestamp: new Date().toISOString(),
        tool: toolName,
        args,
        decision: "deny",
        reason: evaluation.reason,
      });
      return `[拒绝] ${evaluation.reason}`;
    }

    // 需要用户确认
    if (evaluation.requireConfirm) {
      if (demoMode) {
        // Demo 模式：模拟用户确认（自动放行）
        console.log(`  ⚠️  高风险操作: ${toolName}(${JSON.stringify(args)})`);
        console.log(`  📋 原因: ${evaluation.reason}`);
        console.log(`  👤 用户确认: [自动放行 - Demo模式]`);
        recordAudit({
          timestamp: new Date().toISOString(),
          tool: toolName,
          args,
          decision: "confirm_allow",
          reason: evaluation.reason,
        });
      } else {
        // 生产模式应使用 readline 或 UI 弹窗
        recordAudit({
          timestamp: new Date().toISOString(),
          tool: toolName,
          args,
          decision: "confirm_deny",
          reason: "生产模式需要用户交互确认",
        });
        return `[拒绝] 需要用户确认（非 Demo 模式）`;
      }
    } else {
      recordAudit({
        timestamp: new Date().toISOString(),
        tool: toolName,
        args,
        decision: "allow",
        reason: evaluation.reason,
      });
    }

    // 执行调用
    this.permission.incrementCounter(toolName);
    const result = await this.client.callTool({ name: toolName, arguments: args });
    const text = (result.content as TextContent[]).map((c) => c.text).join("\n");
    return text;
  }

  async disconnect() {
    await this.client.close();
  }

  printAuditSummary() {
    console.log("\n  === 审计日志摘要 ===");
    const allowCount = auditLog.filter((r) => r.decision === "allow" || r.decision === "confirm_allow").length;
    const denyCount = auditLog.filter((r) => r.decision === "deny" || r.decision === "confirm_deny").length;
    console.log(`  允许: ${allowCount} 次 | 拒绝: ${denyCount} 次`);

    // 按工具分组统计
    const byTool = new Map<string, { allow: number; deny: number }>();
    for (const r of auditLog) {
      const entry = byTool.get(r.tool) || { allow: 0, deny: 0 };
      if (r.decision === "allow" || r.decision === "confirm_allow") entry.allow++;
      else entry.deny++;
      byTool.set(r.tool, entry);
    }
    console.log("\n  按工具统计:");
    for (const [tool, stats] of byTool) {
      console.log(`    ${tool}: ✅ ${stats.allow} 次 | 🚫 ${stats.deny} 次`);
    }
    console.log("  ==================\n");
  }
}

// ═══════════════════════════════════════════════
// 主流程：5 个安全场景演示
// ═══════════════════════════════════════════════

async function main() {
  console.log("=== Day 5: MCP 安全模型 — 权限管控实战 ===\n");

  const serverPath = path.resolve(import.meta.dirname, "file-server.ts");
  const gateway = new SecureMCPGateway("npx", ["tsx", serverPath]);
  await gateway.connect();

  // ── 场景 1: 合法读取（低风险，直接放行）──
  console.log("--- 场景 1: 读取项目文件（低风险，白名单内）---");
  const r1 = await gateway.callTool("read_file", {
    filepath: path.join(PROJECT_ROOT, "package.json"),
  });
  const preview = r1.slice(0, 150);
  console.log(`  📄 文件内容（前 150 字符）: ${preview}...\n`);

  // ── 场景 2: 路径逃逸（被规则拒绝）──
  console.log("--- 场景 2: 尝试读取 /etc/passwd（路径逃逸）---");
  const r2 = await gateway.callTool("read_file", { filepath: "/etc/passwd" });
  console.log(`  ${r2}\n`);

  // ── 场景 3: 越权写入（路径不在允许列表）──
  console.log("--- 场景 3: 尝试写入 /tmp（越权写入）---");
  const r3 = await gateway.callTool("write_file", {
    filepath: "/tmp/hacked.txt",
    content: "malicious content",
  });
  console.log(`  ${r3}\n`);

  // ── 场景 4: 合法写入沙箱（高风险，自动确认）──
  console.log("--- 场景 4: 写入沙箱目录（高风险，Demo 模式自动确认）---");
  // 先确保 sandbox 目录存在
  const fs = await import("node:fs/promises");
  await fs.mkdir(path.join(PROJECT_ROOT, "sandbox"), { recursive: true });
  const r4 = await gateway.callTool("write_file", {
    filepath: path.join(PROJECT_ROOT, "sandbox/test.txt"),
    content: "Hello from secure gateway!",
  });
  console.log(`  ${r4}\n`);

  // ── 场景 5: 命令执行（高风险 + 次数限制）──
  console.log("--- 场景 5: 执行命令（高风险，受次数限制）---");
  const r5 = await gateway.callTool("execute_command", { command: "echo 'Hello from MCP!'" });
  console.log(`  ${r5}\n`);

  // ── 场景 6: 未注册工具（默认拒绝）──
  console.log("--- 场景 6: 调用未注册工具（默认拒绝）---");
  const r6 = await gateway.callTool("delete_all_files", {});
  console.log(`  ${r6}\n`);

  // ── 审计日志 ──
  gateway.printAuditSummary();

  // ── 清理 ──
  try {
    await fs.unlink(path.join(PROJECT_ROOT, "sandbox/test.txt"));
    await fs.rmdir(path.join(PROJECT_ROOT, "sandbox"));
  } catch {}

  await gateway.disconnect();

  // ── 总结 ──
  console.log("=== 四层防御模型回顾 ===\n");
  console.log("  1. Transport 层: stdio 子进程隔离，Server 崩溃不影响 Client");
  console.log("  2. Discovery 层: listTools() 后立即做风险分级（low/medium/high）");
  console.log("  3. Execution 层: 路径白名单 + 用户确认 + 调用次数限制");
  console.log("  4. Audit 层: 每次调用记录决策（allow/deny/confirm），可追溯");
  console.log();
  console.log("  核心原则：");
  console.log("  • Server 不可信 → Client 必须做执行管控");
  console.log("  • 默认拒绝 → 未注册的工具一律拦截");
  console.log("  • Human-in-the-loop → 高风险操作必须用户确认");
  console.log("  • 最小权限 → 只开放必要的路径和操作");
}

main().catch(console.error);

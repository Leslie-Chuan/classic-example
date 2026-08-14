// Day 8：Mini Coding Agent —— Claude Code 核心架构的简化实现
//
// 四大模块：
//   1. Tool Schema 定义（Schema-first 设计）
//   2. SecureToolExecutor（安全沙箱：路径边界 + 命令白名单 + 危险模式拦截）
//   3. MockLLMClient（模拟 LLM 推理，可替换为真实 API）
//   4. CodingAgent（Agent Loop：感知 → 推理 → 行动 闭环）

import * as fs from "node:fs";
import * as path from "node:path";
import { execSync } from "node:child_process";

// ═══════════════════════════════════════════════
// 第一部分：Tool Schema 定义（Schema-first）
// ═══════════════════════════════════════════════
// 每个 Tool 都是一个严格类型的 JSON Schema 接口
// LLM 不是"猜测"该做什么，而是在约束空间内进行结构化决策

interface ToolDefinition {
  name: string;
  description: string;
  input_schema: {
    type: string;
    properties: Record<string, any>;
    required?: string[];
  };
}

export const TOOLS: ToolDefinition[] = [
  {
    name: "read_file",
    description: "读取指定文件的内容，支持行范围截取",
    input_schema: {
      type: "object",
      properties: {
        path: { type: "string", description: "相对于工作区的文件路径" },
        offset: { type: "number", description: "起始行号（从 0 开始）", default: 0 },
        limit: { type: "number", description: "最多读取行数", default: 50 },
      },
      required: ["path"],
    },
  },
  {
    name: "edit_file",
    description: "用字符串替换方式编辑文件",
    input_schema: {
      type: "object",
      properties: {
        path: { type: "string" },
        old_string: { type: "string", description: "必须精确匹配的原文片段" },
        new_string: { type: "string", description: "替换后的新内容" },
      },
      required: ["path", "old_string", "new_string"],
    },
  },
  {
    name: "execute_command",
    description: "在工作区执行 shell 命令（受白名单约束）",
    input_schema: {
      type: "object",
      properties: {
        command: { type: "string", description: "完整命令字符串" },
        cwd: { type: "string", description: "工作目录", default: "." },
      },
      required: ["command"],
    },
  },
  {
    name: "read_directory",
    description: "列出目录下的文件和子目录",
    input_schema: {
      type: "object",
      properties: {
        path: { type: "string", description: "目录路径", default: "." },
      },
      required: ["path"],
    },
  },
  {
    name: "search_files",
    description: "在文件内容中搜索匹配字符串",
    input_schema: {
      type: "object",
      properties: {
        pattern: { type: "string", description: "要搜索的字符串" },
        path: { type: "string", description: "搜索目录", default: "." },
      },
      required: ["pattern"],
    },
  },
];

// ═══════════════════════════════════════════════
// 第二部分：安全沙箱与 Tool 执行器
// ═══════════════════════════════════════════════
// 四层纵深防御：路径边界 → 命令白名单 → 危险模式拦截 → 输出截断

export class SecureToolExecutor {
  private workspaceRoot: string;
  private allowedCommands = new Set([
    "ls", "cat", "grep", "find", "head", "tail",
    "npm", "node", "npx", "git", "echo", "pwd",
    "wc", "mkdir", "touch", "tree",
  ]);
  private dangerousPatterns = [
    /rm\s+-rf\s+\//,
    />\s*\/dev\/null/,
    /curl.*\|.*sh/,
    /wget.*\|.*bash/,
    /chmod\s+777/,
  ];

  constructor(workspaceRoot: string) {
    this.workspaceRoot = path.resolve(workspaceRoot);
  }

  private resolveSafePath(inputPath: string): string {
    const resolved = path.resolve(this.workspaceRoot, inputPath);
    if (!resolved.startsWith(this.workspaceRoot)) {
      throw new Error(`🛡️ 路径越界: ${inputPath} 不在工作区内`);
    }
    return resolved;
  }

  read_file({ path: filePath, offset = 0, limit = 50 }: { path: string; offset?: number; limit?: number }) {
    const safePath = this.resolveSafePath(filePath);
    if (!fs.existsSync(safePath)) {
      return { error: `文件不存在: ${filePath}` };
    }
    const content = fs.readFileSync(safePath, "utf-8");
    const lines = content.split("\n");
    const slice = lines.slice(offset, offset + limit);
    return {
      path: filePath,
      content: slice.join("\n"),
      total_lines: lines.length,
      shown_lines: slice.length,
    };
  }

  edit_file({ path: filePath, old_string, new_string }: { path: string; old_string: string; new_string: string }) {
    const safePath = this.resolveSafePath(filePath);
    if (!fs.existsSync(safePath)) {
      return { error: `文件不存在: ${filePath}` };
    }
    const content = fs.readFileSync(safePath, "utf-8");
    if (!content.includes(old_string)) {
      return { error: "找不到匹配字符串。建议先 read_file 确认内容。" };
    }
    const newContent = content.replace(old_string, new_string);
    fs.writeFileSync(safePath, newContent, "utf-8");
    return {
      success: true,
      path: filePath,
      bytes_before: content.length,
      bytes_after: newContent.length,
    };
  }

  execute_command({ command, cwd = "." }: { command: string; cwd?: string }) {
    for (const pattern of this.dangerousPatterns) {
      if (pattern.test(command)) {
        return { error: `🛡️ 命令被安全策略拦截: ${command}` };
      }
    }
    const cmdBase = command.split(" ")[0];
    if (!this.allowedCommands.has(cmdBase)) {
      return { error: `命令 ${cmdBase} 不在白名单中`, allowed: Array.from(this.allowedCommands) };
    }
    try {
      const safeCwd = this.resolveSafePath(cwd);
      const output = execSync(command, {
        cwd: safeCwd,
        encoding: "utf-8",
        timeout: 30000,
        maxBuffer: 1024 * 1024,
      });
      return { command, output: output.slice(0, 5000), exit_code: 0 };
    } catch (err: any) {
      return {
        command,
        error: err.message?.slice(0, 500),
        stderr: err.stderr?.slice(0, 2000),
        exit_code: err.status || 1,
      };
    }
  }

  read_directory({ path: dirPath = "." }: { path?: string }) {
    const safePath = this.resolveSafePath(dirPath);
    if (!fs.existsSync(safePath)) {
      return { error: `目录不存在: ${dirPath}` };
    }
    const entries = fs.readdirSync(safePath, { withFileTypes: true });
    return {
      path: dirPath,
      entries: entries.map((e) => ({
        name: e.name,
        type: e.isDirectory() ? "directory" : "file",
      })),
    };
  }

  search_files({ pattern, path: searchPath = "." }: { pattern: string; path?: string }) {
    const safePath = this.resolveSafePath(searchPath);
    const results: Array<{ file: string; matches: Array<{ line: number; text: string }> }> = [];
    let fileCount = 0;

    const walk = (dir: string) => {
      if (fileCount >= 20) return;
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (fileCount >= 20) break;
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          if (!entry.name.startsWith(".") && entry.name !== "node_modules") {
            walk(fullPath);
          }
        } else {
          fileCount++;
          try {
            const content = fs.readFileSync(fullPath, "utf-8");
            if (content.includes(pattern)) {
              const lines = content.split("\n");
              const matches = lines
                .map((line, idx) => ({ line, idx }))
                .filter(({ line }) => line.includes(pattern))
                .slice(0, 3);
              results.push({
                file: path.relative(this.workspaceRoot, fullPath),
                matches: matches.map((m) => ({ line: m.idx + 1, text: m.line.trim() })),
              });
            }
          } catch { /* 跳过二进制或不可读文件 */ }
        }
      }
    };
    walk(safePath);
    return { pattern, results, scanned_files: fileCount };
  }
}

// ═══════════════════════════════════════════════
// 第三部分：模拟 LLM 客户端
// ═══════════════════════════════════════════════
// 生产环境中替换为 Anthropic Claude API 或 OpenAI API

interface LLMResponse {
  content: Array<{ type: "text"; text: string }>;
  tool_calls: Array<{
    id: string;
    type: "tool_use";
    name: string;
    input: Record<string, any>;
  }>;
}

interface Message {
  role: "user" | "assistant";
  content: string;
}

export class MockLLMClient {
  private callCount = 0;

  async callWithTools(messages: Message[], _tools: ToolDefinition[]): Promise<LLMResponse> {
    const lastMessage = messages[messages.length - 1];
    const input = lastMessage.content.toLowerCase();
    this.callCount++;

    // 如果上一轮是 Tool 结果，LLM 判断是否继续
    if (input.startsWith("[tool")) {
      return {
        content: [{ type: "text", text: "已完成分析。以下是我的发现总结。" }],
        tool_calls: [],
      };
    }

    // 基于用户意图选择 Tool
    if (input.includes("文件") || input.includes("结构") || input.includes("目录")) {
      return {
        content: [{ type: "text", text: "我来查看项目的目录结构。" }],
        tool_calls: [{
          id: `tool_${this.callCount}`,
          type: "tool_use",
          name: "read_directory",
          input: { path: "." },
        }],
      };
    }

    if (input.includes("搜索") || input.includes("查找") || input.includes("在哪")) {
      const match = input.match(/搜索\s*(.+)/) || input.match(/查找\s*(.+)/);
      const pattern = match ? match[1].trim() : "function";
      return {
        content: [{ type: "text", text: `正在搜索包含 "${pattern}" 的文件...` }],
        tool_calls: [{
          id: `tool_${this.callCount}`,
          type: "tool_use",
          name: "search_files",
          input: { pattern: pattern.slice(0, 30), path: "." },
        }],
      };
    }

    if (input.includes("命令") || input.includes("运行") || input.includes("执行")) {
      return {
        content: [{ type: "text", text: "我准备执行一个安全的命令。" }],
        tool_calls: [{
          id: `tool_${this.callCount}`,
          type: "tool_use",
          name: "execute_command",
          input: { command: "ls -la" },
        }],
      };
    }

    if (input.includes("读取") || input.includes("内容") || input.includes("看看")) {
      return {
        content: [{ type: "text", text: "让我先列出目录，再读取关键文件。" }],
        tool_calls: [{
          id: `tool_${this.callCount}`,
          type: "tool_use",
          name: "read_directory",
          input: { path: "." },
        }],
      };
    }

    // 默认：无需工具
    return {
      content: [{ type: "text", text: "我已完成分析。如需深入了解某个文件，请告诉我具体需求。" }],
      tool_calls: [],
    };
  }
}

// ═══════════════════════════════════════════════
// 第四部分：Agent Loop 核心引擎
// ═══════════════════════════════════════════════
// 感知(Perceive) → 推理(Reason) → 行动(Act) → 结果反馈

export class CodingAgent {
  private llm: MockLLMClient;
  private executor: SecureToolExecutor;
  private messages: Message[] = [];
  private maxIterations: number;
  public logs: Array<{ phase: string; message: string }> = [];

  constructor(workspaceRoot: string, maxIterations = 6) {
    this.llm = new MockLLMClient();
    this.executor = new SecureToolExecutor(workspaceRoot);
    this.maxIterations = maxIterations;
  }

  async run(userInput: string): Promise<Array<{ phase: string; message: string }>> {
    this.logs = [];
    this.messages = [];

    this.log("start", `🚀 Agent 启动，用户输入: "${userInput}"`);
    this.messages.push({ role: "user", content: userInput });

    for (let i = 0; i < this.maxIterations; i++) {
      this.log("loop", `🔄 迭代 ${i + 1}/${this.maxIterations}（上下文: ${this.messages.length} 条消息）`);

      // Step 1: 感知 + 推理（LLM 决策）
      const response = await this.llm.callWithTools(this.messages, TOOLS);

      // Step 2: 处理文本输出
      const textParts = response.content.filter((c) => c.type === "text").map((c) => c.text).join("");
      if (textParts) {
        this.log("reason", `💭 ${textParts}`);
        this.messages.push({ role: "assistant", content: textParts });
      }

      // Step 3: 处理 Tool 调用（行动）
      const toolCalls = response.tool_calls || [];
      if (toolCalls.length === 0) {
        this.log("done", "✅ 任务完成，无需进一步操作");
        break;
      }

      for (const call of toolCalls) {
        this.log("act", `🔧 调用 ${call.name}(${JSON.stringify(call.input)})`);

        // 执行 Tool（安全沙箱内）
        const result = (this.executor as any)[call.name](call.input);
        const resultText = JSON.stringify(result, null, 2).slice(0, 1500);
        this.log("result", `📊 ${resultText}${resultText.length >= 1500 ? "..." : ""}`);

        // 结果反馈到上下文
        this.messages.push({
          role: "user",
          content: `[Tool ${call.name} 结果] ${JSON.stringify(result)}`,
        });
      }

      await new Promise((r) => setTimeout(r, 200));
    }

    this.log("end", "🏁 Agent Loop 结束");
    return this.logs;
  }

  private log(phase: string, message: string) {
    this.logs.push({ phase, message });
    console.log(`  [${phase}] ${message}`);
  }
}

// ═══════════════════════════════════════════════
// 运行入口
// ═══════════════════════════════════════════════

if (process.argv[1]?.includes("mini-agent")) {
  const workspace = process.argv[2] || process.cwd();
  const agent = new CodingAgent(workspace);
  await agent.run("帮我分析当前项目的文件结构");
}

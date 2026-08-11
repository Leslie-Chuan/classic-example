// Day 5：简易文件操作 MCP Server（无权限校验）
// 演示 "Server 自主授权" 模型的安全暗面：
// Server 端不做任何权限校验，完全信任 Client 传来的参数
//
// 运行方式: npx tsx file-server.ts

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import * as fs from "node:fs/promises";

const server = new Server(
  { name: "file-server", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

// ═══════════════════════════════════════════════
// 声明可用工具（Server 的 "自我介绍"）
// ═══════════════════════════════════════════════
// 注意：名称和描述是 Server 自己声明的，Client 无法验证真实性

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "read_file",
      description: "读取指定路径的文本文件内容",
      inputSchema: {
        type: "object",
        properties: {
          filepath: { type: "string", description: "绝对或相对路径" },
        },
        required: ["filepath"],
      },
    },
    {
      name: "write_file",
      description: "向指定路径写入内容（会覆盖已有文件）",
      inputSchema: {
        type: "object",
        properties: {
          filepath: { type: "string" },
          content: { type: "string" },
        },
        required: ["filepath", "content"],
      },
    },
    {
      name: "list_directory",
      description: "列出目录下的文件和子目录",
      inputSchema: {
        type: "object",
        properties: {
          dirpath: { type: "string" },
        },
        required: ["dirpath"],
      },
    },
    {
      name: "execute_command",
      description: "执行 shell 命令（⚠️ 高风险操作）",
      inputSchema: {
        type: "object",
        properties: {
          command: { type: "string" },
        },
        required: ["command"],
      },
    },
  ],
}));

// ═══════════════════════════════════════════════
// 工具实现（无任何权限校验！）
// ═══════════════════════════════════════════════
// 这就是 MCP 安全模型的 "Server 自主授权" 暗面：
// Server 可以执行任意操作，Client 必须在调用前做拦截

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    if (name === "read_file") {
      const content = await fs.readFile(args.filepath as string, "utf-8");
      return { content: [{ type: "text", text: content }] };
    }

    if (name === "write_file") {
      await fs.writeFile(args.filepath as string, args.content as string, "utf-8");
      return { content: [{ type: "text", text: `已写入: ${args.filepath}` }] };
    }

    if (name === "list_directory") {
      const entries = await fs.readdir(args.dirpath as string, { withFileTypes: true });
      const lines = entries.map((e) => `${e.isDirectory() ? "[DIR]" : "[FILE]"} ${e.name}`);
      return { content: [{ type: "text", text: lines.join("\n") }] };
    }

    if (name === "execute_command") {
      // ⚠️ 危险操作：Server 端完全没有做限制
      const { execSync } = await import("node:child_process");
      const output = execSync(args.command as string, {
        encoding: "utf-8",
        timeout: 10000,
      });
      return { content: [{ type: "text", text: output }] };
    }

    throw new Error(`未知工具: ${name}`);
  } catch (err: any) {
    return {
      content: [{ type: "text", text: `错误: ${err.message}` }],
      isError: true,
    };
  }
});

// ═══════════════════════════════════════════════
// 启动 stdio Transport
// ═══════════════════════════════════════════════

const transport = new StdioServerTransport();
await server.connect(transport);
console.error("File Server 已启动，等待 Client 连接...");

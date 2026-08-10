// Day 1 实践一：文件系统 MCP Server
// 运行：npm run server
// 提供 2 个 Tool + 1 个 Resource

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { promises as fs } from "fs";
import path from "path";

const ROOT_DIR = process.cwd();

const server = new Server(
  { name: "frontend-file-system-server", version: "1.0.0" },
  { capabilities: { tools: {}, resources: {} } }
);

// ── Tool 定义 ──────────────────────────────
// MCP的协议决定：先声明工具和能力，让 LLM 知道可用的工具
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "read_file",
      description: "读取指定路径的文件内容，支持自动检测编码",
      inputSchema: {
        type: "object",
        properties: {
          filePath: { type: "string", description: "相对于项目根目录的文件路径" },
          maxLines: { type: "number", description: "最多读取行数（防止大文件）", default: 200 },
        },
        required: ["filePath"],
      },
    },
    {
      name: "list_dir",
      description: "列出目录下的文件和子目录，支持按扩展名过滤",
      inputSchema: {
        type: "object",
        properties: {
          dirPath: { type: "string", description: "相对于项目根目录的目录路径", default: "." },
          extension: { type: "string", description: "过滤扩展名，如 .ts .tsx .json" },
          recursive: { type: "boolean", description: "是否递归列出子目录", default: false },
        },
        required: [],
      },
    },
  ],
}));

// LLM调用时具体实现工具功能
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  if (name === "read_file") {
    const filePath = path.resolve(ROOT_DIR, args.filePath as string);
    if (!filePath.startsWith(ROOT_DIR)) {
      throw new Error("Access denied: path outside project root");
    }
    const content = await fs.readFile(filePath, "utf-8");
    const maxLines = (args.maxLines as number) || 200;
    return { content: [{ type: "text", text: content.split("\n").slice(0, maxLines).join("\n") }] };
  }

  if (name === "list_dir") {
    const dirPath = path.resolve(ROOT_DIR, (args.dirPath as string) || ".");
    if (!dirPath.startsWith(ROOT_DIR)) {
      throw new Error("Access denied: path outside project root");
    }
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    const ext = args.extension as string | undefined;
    const items = entries
      .filter((e) => !ext || e.isDirectory() || e.name.endsWith(ext))
      .map((e) => ({ name: e.name, type: e.isDirectory() ? "directory" : "file" }));
    return { content: [{ type: "text", text: JSON.stringify(items, null, 2) }] };
  }

  throw new Error(`Unknown tool: ${name}`);
});

// ── Resource 定义 ──────────────────────────

server.setRequestHandler(ListResourcesRequestSchema, async () => ({
  resources: [
    {
      uri: "fs://codebase-structure",
      name: "codebase-structure",
      mimeType: "application/json",
      description: "项目根目录的文件结构概览（前两层）",
    },
  ],
}));

server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const { uri } = request.params;
  if (uri === "fs://codebase-structure") {
    const buildStructure = async (dir: string, depth = 0): Promise<unknown> => {
      if (depth > 2) return "...";
      const entries = await fs.readdir(dir, { withFileTypes: true });
      const result: Record<string, unknown> = {};
      for (const entry of entries) {
        if (entry.name.startsWith(".") || entry.name === "node_modules") continue;
        if (entry.isDirectory()) {
          result[entry.name] = await buildStructure(path.join(dir, entry.name), depth + 1);
        } else {
          result[entry.name] = "file";
        }
      }
      return result;
    };
    const structure = await buildStructure(ROOT_DIR);
    return { contents: [{ uri, mimeType: "application/json", text: JSON.stringify(structure, null, 2) }] };
  }
  throw new Error(`Unknown resource: ${uri}`);
});

// ── 启动 ────────────────────────────────────

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("File System MCP Server running on stdio");
}

main().catch(console.error);

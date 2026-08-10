// Day 1 测试客户端：通过 stdio 连接 MCP Server，验证 Tool 和 Resource
// 运行：npm run test

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import path from "path";

async function main() {
  console.log("=== Day 1: MCP 协议核心概念 — 实践验证 ===\n");

  // 1. 启动 MCP Server 子进程
  const serverPath = path.resolve(import.meta.dirname, "file-system-server.ts");
  const transport = new StdioClientTransport({
    command: "npx",
    args: ["tsx", serverPath],
    cwd: path.resolve(import.meta.dirname, "../.."), // 以项目根目录为工作目录
  });

  const client = new Client({ name: "test-client", version: "1.0.0" });
  await client.connect(transport);
  console.log("✓ MCP Client 已连接到 Server\n");

  // 2. 发现可用 Tool
  const tools = await client.listTools();
  console.log(`📦 发现 ${tools.tools.length} 个 Tool:`);
  tools.tools.forEach((t) => console.log(`   - ${t.name}: ${t.description}`));
  console.log();

  // 3. 调用 list_dir Tool
  console.log("📂 调用 list_dir（列出 src/ 目录）:");
  const listResult = await client.callTool({ name: "list_dir", arguments: { dirPath: "src" } });
  const items = JSON.parse((listResult.content as any[])[0].text);
  items.forEach((item: any) => console.log(`   ${item.type === "directory" ? "📁" : "📄"} ${item.name}`));
  console.log();

  // 4. 调用 read_file Tool
  console.log("📄 调用 read_file（读取 package.json 前 10 行）:");
  const readResult = await client.callTool({
    name: "read_file",
    arguments: { filePath: "package.json", maxLines: 10 },
  });
  console.log((readResult.content as any[])[0].text);
  console.log();

  // 5. 读取 Resource
  console.log("📋 读取 Resource（项目结构）:");
  const resources = await client.listResources();
  console.log(`   可用 Resource: ${resources.resources.map((r) => r.name).join(", ")}`);
  const resourceContent = await client.readResource({ uri: "fs://codebase-structure" });
  const structure = JSON.parse(resourceContent.contents[0].text as string);
  // 只打印第一层
  Object.keys(structure).forEach((key) => {
    console.log(`   ${typeof structure[key] === "object" ? "📁" : "📄"} ${key}`);
  });
  console.log();

  // 6. 总结
  console.log("=== 验证完成 ===");
  console.log("核心概念回顾：");
  console.log("  • Tool = 动词（执行动作）：read_file, list_dir");
  console.log("  • Resource = 名词（提供上下文）：codebase-structure");
  console.log("  • 传输方式：stdio（本地子进程通信）");
  console.log("  • Client 负责发现能力 + 转发请求，Server 负责执行操作");

  await client.close();
}

main().catch(console.error);

// Day 3：MCP Client 开发实战
// 连接 Day 2 的 frontend-helper-server，演示 Client 四大职责：
//   1. 生命周期管理（spawn / connect / close）
//   2. 能力发现（listTools）
//   3. 请求构造（callTool + Schema 校验）
//   4. 结果呈现（解析 content[] 并格式化输出）

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import path from "path";

// ═══════════════════════════════════════════════
// 配置：指向 Day 2 的 MCP Server
// ═══════════════════════════════════════════════

const SERVER_PATH = path.resolve(
  import.meta.dirname,
  "../day2-mcp-server/frontend-helper-server.ts"
);
const PROJECT_ROOT = path.resolve(import.meta.dirname, "../..");

// ═══════════════════════════════════════════════
// 职责 1：生命周期管理
// ═══════════════════════════════════════════════
// Client 是 Server 的父进程：spawn → connect (initialize 握手) → close

async function createClient(): Promise<Client> {
  // Transport 层：用 spawn 启动 Server 子进程
  const transport = new StdioClientTransport({
    command: "npx",
    args: ["tsx", SERVER_PATH],
    cwd: PROJECT_ROOT,
  });

  const client = new Client({
    name: "smart-client",
    version: "1.0.0",
  });

  // 监听连接级事件（Server 崩溃、OOM、异常断开）
  transport.onerror = (err) => {
    console.error(`  ⚠️  Transport 错误: ${err.message}`);
  };
  transport.onclose = () => {
    console.log("  🔌 Transport 已关闭");
  };

  // connect() 内部执行 initialize 握手：
  //   Client → initialize { protocolVersion, capabilities, clientInfo }
  //   Server → initialize response { protocolVersion, capabilities, serverInfo }
  //   Client → notifications/initialized
  await client.connect(transport);
  return client;
}

// ═══════════════════════════════════════════════
// 职责 2：能力发现
// ═══════════════════════════════════════════════
// listTools() → 获取 Server 声明的所有 Tool + JSON Schema

async function discoverCapabilities(client: Client) {
  console.log("── 能力发现（listTools）──");

  const { tools } = await client.listTools();
  console.log(`  发现 ${tools.length} 个 Tool:\n`);

  for (const tool of tools) {
    const schema = tool.inputSchema as any;
    const params = Object.entries(schema.properties || {}).map(
      ([name, def]: [string, any]) => {
        const required = schema.required?.includes(name) ? "*" : "?";
        const typeInfo = def.enum
          ? `${def.type}(${def.enum.join("|")})`
          : def.type;
        return `      ${required} ${name}: ${typeInfo}`;
      }
    );

    console.log(`    📦 ${tool.name}`);
    console.log(`       ${tool.description}`);
    params.forEach((p) => console.log(p));
    console.log();
  }

  return tools;
}

// ═══════════════════════════════════════════════
// 职责 3：请求构造 + 错误处理
// ═══════════════════════════════════════════════
// callTool({ name, arguments }) → content[] + isError?
//
// 错误分两类：
//   • Transport 异常 → 连接级，Server 可能已挂
//   • isError: true → 业务级，Server 还活着但 Tool 执行失败

async function callToolSafe(
  client: Client,
  name: string,
  args: Record<string, any>,
): Promise<any | null> {
  try {
    const result = await client.callTool({ name, arguments: args });

    if (result.isError) {
      // 业务错误：Server Handler 抛异常，被 catch 包裹后返回
      const errMsg = (result.content as any[])[0]?.text || "未知错误";
      console.log(`    ✗ 业务错误: ${errMsg.split("\n")[0]}`);
      return null;
    }

    return JSON.parse((result.content as any[])[0].text);
  } catch (err: any) {
    // Transport 错误：JSON-RPC 解析失败、连接断开等
    console.log(`    ⚠️  连接错误: ${err.message}`);
    return null;
  }
}

// ═══════════════════════════════════════════════
// 职责 4：结果呈现
// ═══════════════════════════════════════════════
// 解析 Server 返回的 content[0].text（JSON 字符串）并格式化

function printDepsAnalysis(data: any) {
  console.log(`    直接依赖: ${data.totalDirect} 个`);
  console.log(`    生产: ${data.prodCount} (${(data.prodRatio * 100).toFixed(0)}%)`);
  console.log(`    开发: ${data.devCount} (${(data.devRatio * 100).toFixed(0)}%)`);
  if (data.redundancyHints?.length > 0) {
    console.log(`    ⚠️  冗余: ${data.redundancyHints.join("; ")}`);
  }
}

function printOutdated(data: any) {
  console.log(`    过时依赖: ${data.outdatedCount} 个`);
  data.packages?.slice(0, 5).forEach((p: any) => {
    const icon = p.severity === "major" ? "🔴" : p.severity === "minor" ? "🟡" : "🟢";
    console.log(`    ${icon} ${p.package}: ${p.current} → ${p.latest} (${p.severity})`);
  });
  if (data.packages?.length > 5) {
    console.log(`    ... 及其他 ${data.packages.length - 5} 个`);
  }
}

function printComponentPath(data: any) {
  console.log(`    组件: ${data.component}`);
  console.log(`    测试: ${data.test}`);
  console.log(`    入口: ${data.index}`);
  if (data.story) console.log(`    Story: ${data.story}`);
  console.log(`    理由: ${data.rationale}`);
}

// ═══════════════════════════════════════════════
// 主流程
// ═══════════════════════════════════════════════

async function main() {
  console.log("=== Day 3: MCP Client 开发实战 ===\n");

  // Step 1: 建立连接
  console.log("[1/5] 连接 Server...");
  const client = await createClient();
  console.log("  ✓ 已连接（initialize 握手完成）\n");

  // Step 2: 能力发现
  console.log("[2/5] 能力发现...");
  await discoverCapabilities(client);

  // Step 3: 调用 analyze_deps
  console.log("[3/5] 调用 analyze_deps...");
  const deps = await callToolSafe(client, "analyze_deps", {
    packageJsonPath: path.join(PROJECT_ROOT, "package.json"),
    depth: 1,
  });
  if (deps) printDepsAnalysis(deps);
  console.log();

  // Step 4: 调用 check_outdated
  console.log("[4/5] 调用 check_outdated...");
  const outdated = await callToolSafe(client, "check_outdated", {
    cwd: PROJECT_ROOT,
  });
  if (outdated) printOutdated(outdated);
  console.log();

  // Step 5: 调用 suggest_component_path + 错误处理演示
  console.log("[5/5] 调用 suggest_component_path + 错误处理...");
  const pathResult = await callToolSafe(client, "suggest_component_path", {
    componentName: "Dashboard",
    framework: "react",
    feature: "admin",
  });
  if (pathResult) printComponentPath(pathResult);
  console.log();

  // 演示业务错误：传入不存在的文件路径
  console.log("  错误处理演示（读取不存在的文件）:");
  await callToolSafe(client, "analyze_deps", {
    packageJsonPath: "/nonexistent/package.json",
  });
  console.log();

  // 演示 Schema 校验：传入非法 framework 值
  console.log("  Schema 校验演示（非法 enum 值）:");
  await callToolSafe(client, "suggest_component_path", {
    componentName: "Test",
    framework: "angular",
  });
  console.log();

  // Step 6: 优雅关闭
  console.log("── 关闭连接 ──");
  await client.close();
  console.log("  ✓ Client 已断开\n");

  // 总结
  console.log("=== Client 四大职责回顾 ===");
  console.log("  1. 生命周期管理: spawn → connect (initialize) → close");
  console.log("  2. 能力发现: listTools() → Tool[] + JSON Schema");
  console.log("  3. 请求构造: callTool({ name, arguments }) → content[]");
  console.log("  4. 结果呈现: 解析 JSON + 格式化 + 错误分类处理");
  console.log();
  console.log("  关键区分:");
  console.log("  • isError: true = 业务错误（Server 还活着）");
  console.log("  • Transport 异常 = 连接错误（Server 可能已挂）");
}

main().catch(console.error);

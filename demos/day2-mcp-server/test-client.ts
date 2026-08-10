// Day 2 测试客户端：验证三层架构 + 3 个 Tool
// 运行：npm run test
//
// 核心概念回顾：
//   Transport 层 → stdio 字节流读写
//   Protocol 层 → JSON-RPC 2.0 请求/响应匹配
//   Handler 层 → 业务逻辑（analyze_deps / check_outdated / suggest_component_path）

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import path from "path";

const PROJECT_ROOT = path.resolve(import.meta.dirname, "../..");

async function main() {
  console.log("=== Day 2: 搭建第一个 MCP Server — 三层架构验证 ===\n");

  // ── 1. 建立 stdio 连接 ──────────────────────
  // Client 启动 Server 作为子进程，通过 stdin/stdout 交换 JSON-RPC 消息
  const serverPath = path.resolve(import.meta.dirname, "frontend-helper-server.ts");
  const transport = new StdioClientTransport({
    command: "npx",
    args: ["tsx", serverPath],
    cwd: PROJECT_ROOT,
  });

  const client = new Client({ name: "day2-test-client", version: "1.0.0" });
  await client.connect(transport);
  console.log("✓ Client 已连接（stdio Transport + JSON-RPC Protocol）\n");

  // ── 2. 能力发现：listTools ──────────────────
  // Protocol 层自动处理 initialize 握手，Server 返回 capabilities 后
  // Client 才能调用 listTools 获取完整 Tool 列表及其 JSON Schema
  const { tools } = await client.listTools();
  console.log(`📦 能力发现：Server 声明了 ${tools.length} 个 Tool`);
  tools.forEach((t) => {
    const paramNames = Object.keys((t.inputSchema as any).properties || {});
    console.log(`   - ${t.name}(${paramNames.join(", ")})`);
    console.log(`     ${t.description}`);
  });
  console.log();

  // ── 3. Tool 1: analyze_deps ─────────────────
  // Handler 层：读取 package.json，分析依赖结构，检测冗余
  console.log("── Tool 1: analyze_deps（依赖分析）──");
  const analyzeResult = await client.callTool({
    name: "analyze_deps",
    arguments: {
      packageJsonPath: path.join(PROJECT_ROOT, "package.json"),
      depth: 1,
    },
  });
  const deps = JSON.parse((analyzeResult.content as any[])[0].text);
  console.log(`   直接依赖总数: ${deps.totalDirect}`);
  console.log(`   生产依赖: ${deps.prodCount}  开发依赖: ${deps.devCount}`);
  console.log(`   生产占比: ${(deps.prodRatio * 100).toFixed(0)}%  开发占比: ${(deps.devRatio * 100).toFixed(0)}%`);
  if (deps.redundancyHints.length > 0) {
    console.log(`   ⚠️  冗余提示: ${deps.redundancyHints.join("; ")}`);
  } else {
    console.log(`   ✓ 无冗余依赖`);
  }
  console.log();

  // ── 4. Tool 2: check_outdated ────────────────
  // Handler 层：执行 npm outdated，解析输出，计算升级严重程度
  console.log("── Tool 2: check_outdated（过时依赖检查）──");
  console.log("   正在执行 npm outdated（可能需要几秒）...");
  const outdatedResult = await client.callTool({
    name: "check_outdated",
    arguments: { cwd: PROJECT_ROOT },
  });
  const outdated = JSON.parse((outdatedResult.content as any[])[0].text);
  console.log(`   过时依赖数: ${outdated.outdatedCount}`);
  if (outdated.packages.length > 0) {
    outdated.packages.slice(0, 5).forEach((pkg: any) => {
      const icon = pkg.severity === "major" ? "🔴" : pkg.severity === "minor" ? "🟡" : "🟢";
      console.log(`   ${icon} ${pkg.package}: ${pkg.current} → ${pkg.latest} (${pkg.severity})`);
    });
    if (outdated.packages.length > 5) {
      console.log(`   ... 及其他 ${outdated.packages.length - 5} 个`);
    }
  } else {
    console.log(`   ✓ 所有依赖均为最新版本`);
  }
  console.log();

  // ── 5. Tool 3: suggest_component_path ────────
  // Handler 层：纯逻辑计算，无 I/O，根据框架和业务域生成路径
  console.log("── Tool 3: suggest_component_path（组件路径建议）──");

  const cases = [
    { componentName: "UserProfile", framework: "react", feature: "user-auth" },
    { componentName: "DataTable", framework: "vue" },
    { componentName: "NavBar", framework: "svelte", feature: "layout" },
  ];

  for (const args of cases) {
    const result = await client.callTool({ name: "suggest_component_path", arguments: args });
    const paths = JSON.parse((result.content as any[])[0].text);
    console.log(`   [${args.framework}] ${args.componentName}:`);
    console.log(`     组件: ${paths.component}`);
    console.log(`     测试: ${paths.test}`);
    console.log(`     入口: ${paths.index}`);
    if (paths.story) console.log(`     Story: ${paths.story}`);
  }
  console.log();

  // ── 6. Schema 校验演示（防御幻觉参数）────────
  console.log("── Schema 校验演示（Zod 防御）──");
  const badResult = await client.callTool({
    name: "suggest_component_path",
    arguments: { componentName: "Test", framework: "angular" },
  });
  if (badResult.isError) {
    console.log(`   ✓ Server 正确拒绝非法参数: ${(badResult.content as any[])[0].text}`);
  } else {
    console.log("   ✗ 预期应报错，但未报错");
  }
  console.log();

  // ── 7. 总结 ─────────────────────────────────
  console.log("=== 三层架构验证完成 ===");
  console.log();
  console.log("  Transport 层: StdioServerTransport — 字节流通过 stdin/stdout 传输");
  console.log("  Protocol 层: Server 类内部处理 — JSON-RPC 2.0 序列化、请求匹配");
  console.log("  Handler 层: setRequestHandler 回调 — 业务逻辑执行");
  console.log();
  console.log("  关键收获:");
  console.log("  • Zod Schema = 运行时契约，LLM/Client/Server 三方共用");
  console.log("  • Capabilities 声明决定 Client UI 展示哪些交互入口");
  console.log("  • stdio 日志只能写 stderr，stdout 被 JSON-RPC 独占");
  console.log("  • 替换 Transport（stdio→SSE）无需改动 Handler 代码");

  await client.close();
}

main().catch(console.error);

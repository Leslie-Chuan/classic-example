// Day 6：测试客户端 — 验证生产级 MCP Server 三层架构
// 测试场景：只读 token vs 读写 token，权限过滤，速率限制，错误处理

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import path from "path";

const SERVER_PATH = path.resolve(import.meta.dirname, "server.ts");

async function createClient(envVars: Record<string, string> = {}): Promise<Client> {
  const env = { ...process.env, ...envVars };
  const transport = new StdioClientTransport({
    command: "npx",
    args: ["tsx", SERVER_PATH],
    cwd: import.meta.dirname,
    env: env as any,
  });
  const client = new Client({ name: "day6-test-client", version: "1.0.0" });
  await client.connect(transport);
  return client;
}

async function main() {
  console.log("=== Day 6: 生产级 MCP Server 三层架构验证 ===\n");

  // ══════════════════════════════════════════════
  // 场景 1：只读 Token（仅 repo scope）
  // ══════════════════════════════════════════════
  console.log("── 场景 1: 只读 Token（ghp_demo_readonly）──");
  const readonlyClient = await createClient({ MOCK_AUTH_HEADER: "Bearer ghp_demo_readonly" });

  const roTools = await readonlyClient.listTools();
  console.log(`  可见 Tool 数: ${roTools.tools.length}`);
  roTools.tools.forEach((t) => console.log(`    ✓ ${t.name}: ${t.description}`));

  // 验证：create_issue 不在列表中
  const hasCreate = roTools.tools.some((t) => t.name === "github_create_issue");
  console.log(`  github_create_issue 可见: ${hasCreate ? "✗ 预期不可见" : "✓ 正确隐藏"}`);

  // 调用 list_issues（应该成功）
  console.log("\n  调用 github_list_issues:");
  const listResult = await readonlyClient.callTool({
    name: "github_list_issues",
    arguments: { owner: "octocat", repo: "hello-world" },
  });
  console.log(`    ${(listResult.content as any[])[0].text}`);
  await readonlyClient.close();
  console.log();

  // ══════════════════════════════════════════════
  // 场景 2：读写 Token（repo + issues:write）
  // ══════════════════════════════════════════════
  console.log("── 场景 2: 读写 Token（ghp_demo_full）──");
  const fullClient = await createClient({
    MOCK_AUTH_HEADER: "Bearer ghp_demo_full",
    MOCK_TOKENS: JSON.stringify([{
      token: "ghp_demo_full",
      scopes: ["repo", "issues:write"],
      rateLimitRemaining: 100,
      rateLimitReset: Date.now() + 3600000,
    }]),
  });

  const fullTools = await fullClient.listTools();
  console.log(`  可见 Tool 数: ${fullTools.tools.length}`);
  fullTools.tools.forEach((t) => console.log(`    ✓ ${t.name}: ${t.description}`));

  // 创建 Issue
  console.log("\n  调用 github_create_issue:");
  const createResult = await fullClient.callTool({
    name: "github_create_issue",
    arguments: {
      owner: "octocat",
      repo: "hello-world",
      title: "Fix: 修复登录页面的样式问题",
      labels: ["bug", "ui"],
    },
  });
  console.log(`    ${(createResult.content as any[])[0].text}`);

  // 再次列出（应该能看到刚创建的）
  console.log("\n  调用 github_list_issues（应包含新创建的）:");
  const listResult2 = await fullClient.callTool({
    name: "github_list_issues",
    arguments: { owner: "octocat", repo: "hello-world", state: "open" },
  });
  console.log(`    ${(listResult2.content as any[])[0].text}`);

  // 关闭 Issue
  console.log("\n  调用 github_close_issue:");
  const closeResult = await fullClient.callTool({
    name: "github_close_issue",
    arguments: { owner: "octocat", repo: "hello-world", issue_number: 101 },
  });
  console.log(`    ${(closeResult.content as any[])[0].text}`);
  await fullClient.close();
  console.log();

  // ══════════════════════════════════════════════
  // 场景 3：速率限制
  // ══════════════════════════════════════════════
  console.log("── 场景 3: 速率限制（rateLimitRemaining=2）──");
  const rateClient = await createClient({
    MOCK_AUTH_HEADER: "Bearer ghp_limited",
    MOCK_TOKENS: JSON.stringify([{
      token: "ghp_limited",
      scopes: ["repo"],
      rateLimitRemaining: 2,
      rateLimitReset: Date.now() + 3600000,
    }]),
  });

  for (let i = 1; i <= 3; i++) {
    console.log(`  第 ${i} 次调用:`);
    const result = await rateClient.callTool({
      name: "github_list_issues",
      arguments: { owner: "test", repo: "repo" },
    });
    const text = (result.content as any[])[0].text;
    const isErr = result.isError ? "🚫" : "✅";
    console.log(`    ${isErr} ${text.slice(0, 100)}`);
  }
  await rateClient.close();
  console.log();

  // ══════════════════════════════════════════════
  // 场景 4：调用不存在的 Tool
  // ══════════════════════════════════════════════
  console.log("── 场景 4: 调用不存在的 Tool ──");
  const testClient = await createClient({ MOCK_AUTH_HEADER: "Bearer ghp_demo_readonly" });
  const badResult = await testClient.callTool({
    name: "github_delete_repo",
    arguments: { owner: "test", repo: "repo" },
  });
  console.log(`  ${(badResult.content as any[])[0].text}`);
  await testClient.close();
  console.log();

  // ══════════════════════════════════════════════
  // 总结
  // ══════════════════════════════════════════════
  console.log("=== 三层架构验证完成 ===\n");
  console.log("  Domain 层: issues.ts — 3 个 Tool（create/list/close）+ Zod Schema");
  console.log("  Orchestration 层: gateway.ts — 认证/权限过滤/速率限制/错误翻译");
  console.log("  Protocol 层: server.ts — 薄层组装，不含业务逻辑");
  console.log();
  console.log("  关键架构模式:");
  console.log("  • filterToolsByScope: initialize 阶段按 token 过滤 Tool");
  console.log("  • assertToolPermission: 调用时双重权限检查");
  console.log("  • checkRateLimit: 速率限制 → 友好错误提示");
  console.log("  • normalizeError: 错误翻译为 LLM 可理解的格式");
  console.log();
  console.log("  ASK 源码阅读法:");
  console.log("  A (Architecture): 看目录结构和入口文件");
  console.log("  S (Surface): 追踪一个完整的请求链路");
  console.log("  K (Knobs): 找出所有可配置点");
}

main().catch(console.error);

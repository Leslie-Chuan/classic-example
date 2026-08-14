// Day 8：Demo Runner — 运行多个 Agent 场景，演示完整架构
//
// 场景 1：分析项目结构（read_directory）
// 场景 2：搜索代码内容（search_files）
// 场景 3：安全沙箱拦截演示（execute_command + 路径越界）

import { CodingAgent, SecureToolExecutor, TOOLS } from "./mini-agent.js";
import * as path from "node:path";

const WORKSPACE = path.resolve(import.meta.dirname, "../..");

async function main() {
  console.log("=== Day 8: Mini Coding Agent 架构验证 ===\n");

  // ── 场景 1：项目结构分析 ──
  console.log("── 场景 1: 项目结构分析 ──");
  const agent1 = new CodingAgent(WORKSPACE);
  await agent1.run("帮我分析当前项目的文件结构");
  console.log();

  // ── 场景 2：代码搜索 ──
  console.log("── 场景 2: 代码搜索 ──");
  const agent2 = new CodingAgent(WORKSPACE);
  await agent2.run("搜索包含 MCP 的文件");
  console.log();

  // ── 场景 3：安全沙箱演示 ──
  console.log("── 场景 3: 安全沙箱验证 ──");
  const executor = new SecureToolExecutor(WORKSPACE);

  console.log("  3a. 合法命令:");
  const r1 = executor.execute_command({ command: "echo 'Hello from Agent!'" });
  console.log(`    ${JSON.stringify(r1).slice(0, 100)}`);

  console.log("  3b. 危险命令拦截:");
  const r2 = executor.execute_command({ command: "rm -rf /" });
  console.log(`    ${JSON.stringify(r2)}`);

  console.log("  3c. 非白名单命令:");
  const r3 = executor.execute_command({ command: "sudo apt install something" });
  console.log(`    ${JSON.stringify(r3).slice(0, 150)}`);

  console.log("  3d. 路径越界:");
  try {
    const r4 = executor.read_file({ path: "../../etc/passwd" });
    console.log(`    ${JSON.stringify(r4)}`);
  } catch (err: any) {
    console.log(`    ${err.message}`);
  }
  console.log();

  // ── 总结 ──
  console.log("=== Agent Loop 核心概念回顾 ===\n");
  console.log("  感知(Perceive): 读取文件系统、执行命令、获取环境状态");
  console.log("  推理(Reason):   LLM 基于上下文决定下一步行动");
  console.log("  行动(Act):      执行 Tool 调用，产生副作用");
  console.log("  反馈(Feedback): 结果注入上下文，驱动下一轮迭代");
  console.log();
  console.log("  安全沙箱四层防御:");
  console.log("  1. 路径边界 → resolveSafePath() 防止目录遍历");
  console.log("  2. 命令白名单 → 只允许安全的只读或受控命令");
  console.log("  3. 危险模式 → 正则拦截 rm -rf / 等操作");
  console.log("  4. 输出截断 → 防止长输出撑爆上下文窗口");
  console.log();
  console.log("  Schema-first 设计:");
  console.log(`  已定义 ${TOOLS.length} 个 Tool，每个都有 JSON Schema 描述`);
  console.log("  LLM 在约束空间内做结构化决策，不是自由文本猜测");
}

main().catch(console.error);

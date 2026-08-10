"use client";

import { useState, useCallback } from "react";

// ── 类型 ──────────────────────────────────────
interface LogEntry {
  time: string;
  direction: "client→server" | "server→client" | "internal";
  message: string;
}

type Phase = "idle" | "connected" | "discovered" | "done";

// ── 模拟 Server 数据 ──────────────────────────
const MOCK_TOOLS = [
  {
    name: "analyze_deps",
    description: "分析 package.json 的依赖结构",
    params: [
      { name: "packageJsonPath", type: "string", required: true },
      { name: "depth", type: "number", required: false },
    ],
  },
  {
    name: "check_outdated",
    description: "运行 npm outdated 检查过时依赖",
    params: [
      { name: "cwd", type: "string", required: true },
    ],
  },
  {
    name: "suggest_component_path",
    description: "生成组件推荐文件路径",
    params: [
      { name: "componentName", type: "string", required: true },
      { name: "framework", type: "react|vue|svelte", required: true },
      { name: "feature", type: "string", required: false },
    ],
  },
];

export default function Day3MCPPlayground() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [selectedTool, setSelectedTool] = useState(0);
  const [result, setResult] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [errorType, setErrorType] = useState<"none" | "business" | "transport">("none");

  const now = () => new Date().toLocaleTimeString("zh-CN", { hour12: false });

  const addLog = useCallback((direction: LogEntry["direction"], message: string) => {
    setLogs((prev) => [...prev, { time: now(), direction, message }]);
  }, []);

  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

  // ── Step 1: 连接 Server ──
  const handleConnect = async () => {
    setLogs([]);
    setResult("");
    setErrorType("none");
    setLoading(true);

    addLog("internal", "spawn Server 子进程 (npx tsx frontend-helper-server.ts)");
    await sleep(400);
    addLog("client→server", 'initialize { protocolVersion: "2025-03-26", clientInfo: { name: "smart-client" } }');
    await sleep(300);
    addLog("server→client", 'initialize response { serverInfo: { name: "frontend-helper-server" }, capabilities: { tools: {} } }');
    await sleep(200);
    addLog("client→server", "notifications/initialized");
    await sleep(200);
    addLog("internal", "✓ 握手完成，连接已建立");

    setPhase("connected");
    setLoading(false);
  };

  // ── Step 2: 能力发现 ──
  const handleDiscover = async () => {
    setLoading(true);

    addLog("client→server", "tools/list {}");
    await sleep(400);
    addLog("server→client", `tools/list response → ${MOCK_TOOLS.length} tools: [${MOCK_TOOLS.map(t => t.name).join(", ")}]`);
    await sleep(200);
    addLog("internal", `✓ 发现 ${MOCK_TOOLS.length} 个 Tool，UI 可据此渲染交互入口`);

    setPhase("discovered");
    setLoading(false);
  };

  // ── Step 3: 调用工具 ──
  const handleCallTool = async (simulateError: boolean = false) => {
    setLoading(true);
    setResult("");
    setErrorType("none");

    const tool = MOCK_TOOLS[selectedTool];

    if (simulateError) {
      // 模拟业务错误
      addLog("client→server", `tools/call { name: "${tool.name}", arguments: { packageJsonPath: "/nonexistent" } }`);
      await sleep(500);
      addLog("server→client", `tools/call response → isError: true`);
      addLog("internal", "✗ 业务错误：Server 还活着，但 Tool 执行失败");
      setErrorType("business");
      setResult(`isError: true\n\ncontent[0].text: "执行失败: ENOENT: no such file or directory"`);
    } else {
      // 正常调用
      const args = selectedTool === 0
        ? '{ packageJsonPath: "/project/package.json", depth: 1 }'
        : selectedTool === 1
          ? '{ cwd: "/project" }'
          : '{ componentName: "Dashboard", framework: "react", feature: "admin" }';

      addLog("client→server", `tools/call { name: "${tool.name}", arguments: ${args} }`);
      await sleep(600);

      let responseText: string;
      if (selectedTool === 0) {
        responseText = JSON.stringify({
          totalDirect: 14, prodCount: 6, devCount: 8,
          prodRatio: 0.43, devRatio: 0.57,
          redundancyHints: [], analyzedDepth: 1,
        }, null, 2);
      } else if (selectedTool === 1) {
        responseText = JSON.stringify({
          outdatedCount: 4,
          packages: [
            { package: "shiki", current: "3.23.0", latest: "4.4.3", severity: "major" },
            { package: "typescript", current: "5.9.3", latest: "7.0.2", severity: "major" },
            { package: "eslint", current: "9.39.5", latest: "10.8.1", severity: "major" },
            { package: "@types/node", current: "20.19.43", latest: "26.2.0", severity: "major" },
          ],
        }, null, 2);
      } else {
        responseText = JSON.stringify({
          component: "src/features/admin/components/Dashboard/Dashboard.tsx",
          test: "src/features/admin/components/Dashboard/Dashboard.test.tsx",
          index: "src/features/admin/components/Dashboard/index.ts",
          story: "src/features/admin/components/Dashboard/Dashboard.stories.tsx",
          rationale: "遵循 react 社区推荐的扁平化目录结构",
        }, null, 2);
      }

      addLog("server→client", `tools/call response → content[0].text (${responseText.length} chars)`);
      addLog("internal", "✓ Tool 执行成功，解析 JSON 并渲染结果");
      setResult(responseText);
    }

    setLoading(false);
  };

  // ── Step 4: 断开连接 ──
  const handleClose = async () => {
    setLoading(true);

    addLog("client→server", "notifications/cancelled");
    await sleep(200);
    addLog("internal", "终止 Server 子进程");
    await sleep(200);
    addLog("internal", "✓ Client 已断开");

    setPhase("done");
    setLoading(false);
  };

  // ── 重置 ──
  const handleReset = () => {
    setPhase("idle");
    setLogs([]);
    setResult("");
    setErrorType("none");
  };

  // ── 样式映射 ──
  const dirColor: Record<string, string> = {
    "client→server": "text-blue-400",
    "server→client": "text-emerald-400",
    "internal": "text-zinc-500",
  };
  const dirLabel: Record<string, string> = {
    "client→server": "  →",
    "server→client": "←  ",
    "internal": " · ",
  };

  const phaseSteps = [
    { id: "idle", label: "未连接" },
    { id: "connected", label: "已连接" },
    { id: "discovered", label: "已发现" },
    { id: "done", label: "已断开" },
  ];

  return (
    <div className="space-y-6 mt-6">
      <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800">
        <h3 className="text-sm font-semibold text-emerald-400 mb-4">
          MCP Client 模拟器：四大职责可视化
        </h3>

        {/* 生命周期进度条 */}
        <div className="flex items-center justify-center gap-1 mb-6 text-xs">
          {phaseSteps.map((step, i) => (
            <div key={step.id} className="flex items-center gap-1">
              <div
                className={`px-3 py-1.5 rounded-lg border transition-all duration-300 ${
                  phase === step.id
                    ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-400 font-medium"
                    : phaseSteps.findIndex(s => s.id === phase) > i
                      ? "border-zinc-700 bg-zinc-800/50 text-zinc-500"
                      : "border-zinc-800 text-zinc-600"
                }`}
              >
                {step.label}
              </div>
              {i < phaseSteps.length - 1 && <span className="text-zinc-700">→</span>}
            </div>
          ))}
        </div>

        {/* 操作按钮 */}
        <div className="flex gap-2 mb-4 flex-wrap">
          {phase === "idle" && (
            <button
              onClick={handleConnect}
              disabled={loading}
              className="px-3 py-1.5 text-xs rounded-md bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-50 transition-colors"
            >
              {loading ? "连接中..." : "1. connect() 建立连接"}
            </button>
          )}
          {phase === "connected" && (
            <button
              onClick={handleDiscover}
              disabled={loading}
              className="px-3 py-1.5 text-xs rounded-md bg-purple-600 text-white hover:bg-purple-500 disabled:opacity-50 transition-colors"
            >
              {loading ? "发现中..." : "2. listTools() 能力发现"}
            </button>
          )}
          {phase === "discovered" && (
            <>
              <button
                onClick={() => handleCallTool(false)}
                disabled={loading}
                className="px-3 py-1.5 text-xs rounded-md bg-emerald-600 text-white hover:bg-emerald-500 disabled:opacity-50 transition-colors"
              >
                {loading ? "调用中..." : "3. callTool() 调用工具"}
              </button>
              <button
                onClick={() => handleCallTool(true)}
                disabled={loading}
                className="px-3 py-1.5 text-xs rounded-md bg-orange-600/80 text-white hover:bg-orange-500 disabled:opacity-50 transition-colors"
              >
                模拟业务错误
              </button>
              <button
                onClick={handleClose}
                disabled={loading}
                className="px-3 py-1.5 text-xs rounded-md bg-zinc-700 text-zinc-300 hover:bg-zinc-600 disabled:opacity-50 transition-colors"
              >
                close() 断开连接
              </button>
            </>
          )}
          {phase === "done" && (
            <button
              onClick={handleReset}
              className="px-3 py-1.5 text-xs rounded-md bg-zinc-700 text-zinc-300 hover:bg-zinc-600 transition-colors"
            >
              重新开始
            </button>
          )}
          {logs.length > 0 && phase !== "done" && (
            <button
              onClick={() => { setLogs([]); setResult(""); setErrorType("none"); }}
              className="px-3 py-1.5 text-xs rounded-md bg-zinc-800 text-zinc-500 hover:bg-zinc-700 transition-colors"
            >
              清空日志
            </button>
          )}
        </div>

        {/* 工具选择（发现后显示） */}
        {(phase === "discovered") && (
          <div className="mb-4 p-3 rounded-lg bg-zinc-950 border border-zinc-800">
            <div className="text-xs text-zinc-500 mb-2">listTools() 结果 — 选择一个 Tool 调用：</div>
            <div className="flex gap-2">
              {MOCK_TOOLS.map((tool, i) => (
                <button
                  key={tool.name}
                  onClick={() => setSelectedTool(i)}
                  className={`flex-1 p-2 rounded-md text-left transition-colors ${
                    selectedTool === i
                      ? "bg-emerald-500/10 border border-emerald-500/30"
                      : "bg-zinc-800 border border-zinc-700 hover:border-zinc-600"
                  }`}
                >
                  <div className={`text-xs font-medium ${selectedTool === i ? "text-emerald-400" : "text-zinc-300"}`}>
                    {tool.name}
                  </div>
                  <div className="text-xs text-zinc-600 mt-0.5 truncate">{tool.description}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* JSON-RPC 日志面板 */}
        {logs.length > 0 && (
          <div className="mb-4 rounded-lg bg-black/50 p-3 max-h-52 overflow-y-auto">
            <div className="text-xs text-zinc-600 mb-2 font-mono">JSON-RPC 消息流（stdin/stdout）</div>
            {logs.map((log, i) => (
              <div key={i} className="text-xs font-mono mb-1 flex gap-2">
                <span className="text-zinc-700 shrink-0">{log.time}</span>
                <span className={`shrink-0 ${dirColor[log.direction]}`}>{dirLabel[log.direction]}</span>
                <span className={log.direction === "internal" ? "text-zinc-500" : "text-zinc-300"}>
                  {log.message}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* 错误类型高亮 */}
        {errorType !== "none" && (
          <div className={`mb-4 p-3 rounded-lg text-xs border ${
            errorType === "business"
              ? "bg-orange-500/5 border-orange-500/30 text-orange-300"
              : "bg-red-500/5 border-red-500/30 text-red-300"
          }`}>
            <div className="font-medium mb-1">
              {errorType === "business" ? "业务错误 (isError: true)" : "连接错误 (Transport Exception)"}
            </div>
            <div className="text-zinc-400">
              {errorType === "business"
                ? "Server 还活着，但 Tool 执行失败。Handler 中 throw 的异常被 catch 捕获，包装为 isError: true 返回。Client 应将错误信息展示给用户。"
                : "Server 进程可能已崩溃。Client 需要重连或提示用户重启。"}
            </div>
          </div>
        )}

        {/* 结果 */}
        {result && errorType === "none" && (
          <div>
            <div className="text-xs text-zinc-500 mb-1 font-mono">response.content[0].text (parsed JSON)</div>
            <pre className="p-4 rounded-lg bg-zinc-950 border border-zinc-800 text-sm text-zinc-300 overflow-x-auto whitespace-pre-wrap">
              {result}
            </pre>
          </div>
        )}
        {result && errorType === "business" && (
          <div>
            <div className="text-xs text-orange-500 mb-1 font-mono">response.content[0].text</div>
            <pre className="p-4 rounded-lg bg-zinc-950 border border-orange-500/20 text-sm text-orange-300 overflow-x-auto whitespace-pre-wrap">
              {result}
            </pre>
          </div>
        )}

        {/* 四大职责说明 */}
        <div className="mt-4 pt-4 border-t border-zinc-800 grid grid-cols-2 gap-3 text-xs">
          <div className="p-2 rounded bg-blue-500/5 border border-blue-500/20">
            <div className="font-medium text-blue-400 mb-1">1. 生命周期管理</div>
            <div className="text-zinc-500">spawn Server 子进程 → connect() 完成 initialize 握手 → close() 优雅断开。Client 是 Server 的父进程。</div>
          </div>
          <div className="p-2 rounded bg-purple-500/5 border border-purple-500/20">
            <div className="font-medium text-purple-400 mb-1">2. 能力发现</div>
            <div className="text-zinc-500">listTools() 获取 Server 声明的 Tool 列表 + JSON Schema，决定 UI 展示哪些交互入口。</div>
          </div>
          <div className="p-2 rounded bg-emerald-500/5 border border-emerald-500/20">
            <div className="font-medium text-emerald-400 mb-1">3. 请求构造</div>
            <div className="text-zinc-500">callTool(name, arguments) 发送 JSON-RPC 请求。SDK 管通信，你管参数来源（用户输入 or LLM 生成）。</div>
          </div>
          <div className="p-2 rounded bg-orange-500/5 border border-orange-500/20">
            <div className="font-medium text-orange-400 mb-1">4. 结果呈现</div>
            <div className="text-zinc-500">解析 content[] 数组并渲染。区分 isError（业务错误）和 Transport 异常（连接错误），采用不同处理策略。</div>
          </div>
        </div>
      </div>
    </div>
  );
}

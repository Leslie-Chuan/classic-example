"use client";

import { useState } from "react";

// ── 类型定义 ──────────────────────────────────
interface LogEntry {
  time: string;
  layer: "transport" | "protocol" | "handler" | "info";
  message: string;
}

type ToolName = "analyze_deps" | "check_outdated" | "suggest_component_path";

// ── 模拟数据 ──────────────────────────────────
const MOCK_PKG = {
  dependencies: {
    next: "16.0.0",
    react: "19.1.0",
    "react-dom": "19.1.0",
    shiki: "3.2.0",
    "gray-matter": "4.0.3",
    "date-fns": "4.1.0",
  },
  devDependencies: {
    typescript: "5.5.0",
    "@types/node": "20.14.0",
    "@types/react": "19.0.0",
    tailwindcss: "4.0.0",
    "@tailwindcss/postcss": "4.0.0",
    eslint: "9.0.0",
    "eslint-config-next": "16.0.0",
    postcss: "8.4.0",
  },
};

const MOCK_OUTDATED = [
  { package: "shiki", current: "3.2.0", wanted: "3.23.0", latest: "4.4.3", severity: "major" as const },
  { package: "typescript", current: "5.5.0", wanted: "5.9.3", latest: "7.0.2", severity: "major" as const },
  { package: "eslint", current: "9.0.0", wanted: "9.39.5", latest: "10.8.1", severity: "major" as const },
];

const TOOL_META: Record<ToolName, { label: string; desc: string }> = {
  analyze_deps: { label: "analyze_deps", desc: "分析 package.json 依赖结构" },
  check_outdated: { label: "check_outdated", desc: "检查过时依赖并推荐升级" },
  suggest_component_path: { label: "suggest_path", desc: "生成组件推荐文件路径" },
};

export default function Day2MCPPlayground() {
  const [activeTool, setActiveTool] = useState<ToolName>("analyze_deps");
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [result, setResult] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [activeLayer, setActiveLayer] = useState<string>("");

  // suggest_component_path 的输入
  const [componentName, setComponentName] = useState("UserProfile");
  const [framework, setFramework] = useState<"react" | "vue" | "svelte">("react");
  const [feature, setFeature] = useState("user-auth");

  const now = () => new Date().toLocaleTimeString("zh-CN", { hour12: false });

  const addLog = (layer: LogEntry["layer"], message: string) => {
    setLogs((prev) => [...prev, { time: now(), layer, message }]);
  };

  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

  const executeTool = async () => {
    setLoading(true);
    setResult("");
    setLogs([]);
    setActiveLayer("transport");

    // ── Transport 层 ──
    addLog("transport", "stdin → JSON-RPC 请求序列化...");
    addLog("transport", `{"jsonrpc":"2.0","method":"tools/call","params":{"name":"${activeTool}"}}`);
    await sleep(400);

    // ── Protocol 层 ──
    setActiveLayer("protocol");
    addLog("protocol", "Server 接收请求，匹配 request ID，路由到 Handler");
    await sleep(300);

    // ── Handler 层 ──
    setActiveLayer("handler");
    addLog("handler", `执行 ${activeTool} 业务逻辑...`);
    await sleep(400);

    let output: string;

    if (activeTool === "analyze_deps") {
      const deps = Object.keys(MOCK_PKG.dependencies);
      const devDeps = Object.keys(MOCK_PKG.devDependencies);
      const total = deps.length + devDeps.length;
      output = JSON.stringify({
        totalDirect: total,
        prodCount: deps.length,
        devCount: devDeps.length,
        prodRatio: +(deps.length / total).toFixed(2),
        devRatio: +(devDeps.length / total).toFixed(2),
        redundancyHints: [] as string[],
        analyzedDepth: 1,
      }, null, 2);
      addLog("handler", `读取 package.json → ${total} 个直接依赖`);
    } else if (activeTool === "check_outdated") {
      output = JSON.stringify({
        outdatedCount: MOCK_OUTDATED.length,
        packages: MOCK_OUTDATED,
      }, null, 2);
      addLog("handler", `npm outdated → ${MOCK_OUTDATED.length} 个过时依赖`);
    } else {
      const base = feature ? `src/features/${feature}/components` : "src/components";
      const ext = framework === "vue" ? ".vue" : framework === "svelte" ? ".svelte" : ".tsx";
      const testExt = framework === "react" ? ".test.tsx" : ".spec" + ext;
      output = JSON.stringify({
        component: `${base}/${componentName}/${componentName}${ext}`,
        test: `${base}/${componentName}/${componentName}${testExt}`,
        index: `${base}/${componentName}/index.ts`,
        story: framework === "react" ? `${base}/${componentName}/${componentName}.stories.tsx` : null,
        rationale: `遵循 ${framework} 社区推荐的扁平化目录结构`,
      }, null, 2);
      addLog("handler", `生成 ${framework} 组件路径 → ${componentName}`);
    }

    await sleep(200);

    // ── 返回路径 ──
    setActiveLayer("protocol");
    addLog("protocol", "Handler 返回 content[]，Protocol 封装为 JSON-RPC Response");
    await sleep(200);
    setActiveLayer("transport");
    addLog("transport", "stdout → JSON-RPC 响应反序列化，返回 Client");

    setResult(output);
    setActiveLayer("");
    setLoading(false);
  };

  const layerColor: Record<string, string> = {
    transport: "border-orange-500/50 bg-orange-500/5",
    protocol: "border-purple-500/50 bg-purple-500/5",
    handler: "border-emerald-500/50 bg-emerald-500/5",
  };

  const layerLabel: Record<string, string> = {
    transport: "Transport",
    protocol: "Protocol",
    handler: "Handler",
  };

  const logColor: Record<string, string> = {
    transport: "text-orange-400",
    protocol: "text-purple-400",
    handler: "text-emerald-400",
    info: "text-zinc-500",
  };

  return (
    <div className="space-y-6 mt-6">
      <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800">
        <h3 className="text-sm font-semibold text-emerald-400 mb-4">
          三层架构可视化：Transport → Protocol → Handler
        </h3>

        {/* 三层架构图（动态高亮） */}
        <div className="flex items-center justify-center gap-1 mb-6">
          {(["transport", "protocol", "handler"] as const).map((layer) => (
            <div key={layer} className="flex items-center gap-1">
              <div
                className={`px-3 py-2 rounded-lg text-xs font-medium border transition-all duration-300 ${
                  activeLayer === layer
                    ? layerColor[layer] + " scale-105"
                    : "border-zinc-800 bg-zinc-900 text-zinc-600"
                }`}
              >
                {layerLabel[layer]}
              </div>
              {layer !== "handler" && (
                <span className={`text-xs ${activeLayer === layer ? "text-zinc-400" : "text-zinc-700"}`}>
                  →
                </span>
              )}
            </div>
          ))}
        </div>

        {/* Tool 选择标签 */}
        <div className="flex gap-2 mb-4">
          {(Object.keys(TOOL_META) as ToolName[]).map((name) => (
            <button
              key={name}
              onClick={() => setActiveTool(name)}
              className={`px-3 py-1.5 text-xs rounded-md transition-colors ${
                activeTool === name
                  ? "bg-emerald-600 text-white"
                  : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
              }`}
            >
              {TOOL_META[name].label}
            </button>
          ))}
        </div>

        {/* 工具描述 */}
        <p className="text-xs text-zinc-500 mb-4">{TOOL_META[activeTool].desc}</p>

        {/* 参数输入区 */}
        <div className="mb-4 p-3 rounded-lg bg-zinc-950 border border-zinc-800">
          <div className="text-xs text-zinc-500 mb-2 font-mono">inputSchema.arguments</div>

          {activeTool === "analyze_deps" && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-zinc-600 mb-1">packageJsonPath</label>
                <input
                  value="/project/package.json"
                  readOnly
                  className="w-full px-2 py-1.5 rounded bg-zinc-800 border border-zinc-700 text-xs text-zinc-400 font-mono"
                />
              </div>
              <div>
                <label className="block text-xs text-zinc-600 mb-1">depth (1-3)</label>
                <input
                  value="1"
                  readOnly
                  className="w-full px-2 py-1.5 rounded bg-zinc-800 border border-zinc-700 text-xs text-zinc-400 font-mono"
                />
              </div>
            </div>
          )}

          {activeTool === "check_outdated" && (
            <div>
              <label className="block text-xs text-zinc-600 mb-1">cwd</label>
              <input
                value="/project"
                readOnly
                className="w-full px-2 py-1.5 rounded bg-zinc-800 border border-zinc-700 text-xs text-zinc-400 font-mono"
              />
            </div>
          )}

          {activeTool === "suggest_component_path" && (
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs text-zinc-600 mb-1">componentName</label>
                <input
                  value={componentName}
                  onChange={(e) => setComponentName(e.target.value)}
                  className="w-full px-2 py-1.5 rounded bg-zinc-800 border border-zinc-700 text-xs text-zinc-200 font-mono focus:border-emerald-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs text-zinc-600 mb-1">framework</label>
                <select
                  value={framework}
                  onChange={(e) => setFramework(e.target.value as any)}
                  className="w-full px-2 py-1.5 rounded bg-zinc-800 border border-zinc-700 text-xs text-zinc-200 focus:border-emerald-500 focus:outline-none"
                >
                  <option value="react">react</option>
                  <option value="vue">vue</option>
                  <option value="svelte">svelte</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-zinc-600 mb-1">feature (optional)</label>
                <input
                  value={feature}
                  onChange={(e) => setFeature(e.target.value)}
                  className="w-full px-2 py-1.5 rounded bg-zinc-800 border border-zinc-700 text-xs text-zinc-200 font-mono focus:border-emerald-500 focus:outline-none"
                  placeholder="可选"
                />
              </div>
            </div>
          )}
        </div>

        {/* 执行按钮 */}
        <div className="flex gap-3 mb-4">
          <button
            onClick={executeTool}
            disabled={loading}
            className="px-4 py-2 rounded-md bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-500 disabled:opacity-50 transition-colors"
          >
            {loading ? "执行中..." : "调用 callTool"}
          </button>
          <button
            onClick={() => { setLogs([]); setResult(""); }}
            className="px-3 py-2 text-xs rounded-md bg-zinc-800 text-zinc-500 hover:bg-zinc-700 transition-colors"
          >
            清空
          </button>
        </div>

        {/* 日志面板：按层级着色 */}
        {logs.length > 0 && (
          <div className="mb-4 rounded-lg bg-black/50 p-3 max-h-52 overflow-y-auto">
            {logs.map((log, i) => (
              <div key={i} className="text-xs font-mono mb-1 flex gap-2">
                <span className="text-zinc-700 shrink-0">{log.time}</span>
                <span className={`shrink-0 w-16 text-right ${logColor[log.layer]}`}>
                  [{log.layer}]
                </span>
                <span className="text-zinc-300">{log.message}</span>
              </div>
            ))}
          </div>
        )}

        {/* 结果面板 */}
        {result && (
          <div>
            <div className="text-xs text-zinc-500 mb-1 font-mono">Server Response.content[0].text</div>
            <pre className="p-4 rounded-lg bg-zinc-950 border border-zinc-800 text-sm text-zinc-300 overflow-x-auto whitespace-pre-wrap">
              {result}
            </pre>
          </div>
        )}

        {/* 架构说明 */}
        <div className="mt-4 pt-4 border-t border-zinc-800 grid grid-cols-3 gap-3 text-xs">
          <div className="p-2 rounded bg-orange-500/5 border border-orange-500/20">
            <div className="font-medium text-orange-400 mb-1">Transport</div>
            <div className="text-zinc-500">字节流读写。stdio 模式下 = stdin/stdout。替换为 SSE 无需改动 Handler。</div>
          </div>
          <div className="p-2 rounded bg-purple-500/5 border border-purple-500/20">
            <div className="font-medium text-purple-400 mb-1">Protocol</div>
            <div className="text-zinc-500">JSON-RPC 2.0 序列化、request ID 匹配、initialize 握手、能力协商。</div>
          </div>
          <div className="p-2 rounded bg-emerald-500/5 border border-emerald-500/20">
            <div className="font-medium text-emerald-400 mb-1">Handler</div>
            <div className="text-zinc-500">业务逻辑。Zod Schema 做运行时校验，防御非法参数。你只需要关注这一层。</div>
          </div>
        </div>
      </div>
    </div>
  );
}

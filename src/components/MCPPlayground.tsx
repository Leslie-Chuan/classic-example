"use client";

import { useState } from "react";

interface Tool {
  name: string;
  description: string;
}

interface LogEntry {
  time: string;
  type: "request" | "response" | "info";
  message: string;
}

// 模拟 MCP Server 的响应
const MOCK_TOOLS: Tool[] = [
  { name: "read_file", description: "读取指定路径的文件内容" },
  { name: "list_dir", description: "列出目录下的文件和子目录" },
];

const MOCK_FILES: Record<string, string> = {
  "package.json": '{\n  "name": "ai-learning-lab",\n  "version": "0.1.0"\n}',
  "src/app/page.tsx": 'export default function Home() {\n  return <div>仪表盘</div>;\n}',
  "README.md": "# AI 前端每日学习\n\n高级前端开发者 AI 时代学习计划",
};

const MOCK_DIRS: Record<string, Array<{ name: string; type: string }>> = {
  ".": [
    { name: "src", type: "directory" },
    { name: "content", type: "directory" },
    { name: "demos", type: "directory" },
    { name: "package.json", type: "file" },
    { name: "README.md", type: "file" },
  ],
  src: [
    { name: "app", type: "directory" },
    { name: "components", type: "directory" },
    { name: "lib", type: "directory" },
  ],
};

export default function MCPPlayground() {
  const [selectedTool, setSelectedTool] = useState<string>("list_dir");
  const [inputPath, setInputPath] = useState(".");
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [result, setResult] = useState<string>("");
  const [loading, setLoading] = useState(false);

  const now = () => new Date().toLocaleTimeString("zh-CN", { hour12: false });

  const addLog = (type: LogEntry["type"], message: string) => {
    setLogs((prev) => [...prev, { time: now(), type, message }]);
  };

  const executeTool = async () => {
    setLoading(true);
    setResult("");
    addLog("info", `Client → 准备调用 Tool: ${selectedTool}`);

    // 模拟网络延迟
    await new Promise((r) => setTimeout(r, 500));

    if (selectedTool === "read_file") {
      addLog("request", `POST /tools/call { name: "read_file", arguments: { filePath: "${inputPath}" } }`);
      await new Promise((r) => setTimeout(r, 300));

      const content = MOCK_FILES[inputPath];
      if (content) {
        const response = JSON.stringify({ content: [{ type: "text", text: content }] }, null, 2);
        addLog("response", `Server → 返回文件内容 (${content.length} chars)`);
        setResult(content);
      } else {
        addLog("response", `Server → Error: 文件不存在 "${inputPath}"`);
        setResult(`Error: 文件 "${inputPath}" 不存在\n\n可用文件: ${Object.keys(MOCK_FILES).join(", ")}`);
      }
    } else if (selectedTool === "list_dir") {
      addLog("request", `POST /tools/call { name: "list_dir", arguments: { dirPath: "${inputPath}" } }`);
      await new Promise((r) => setTimeout(r, 300));

      const items = MOCK_DIRS[inputPath];
      if (items) {
        const response = JSON.stringify(items, null, 2);
        addLog("response", `Server → 返回 ${items.length} 个条目`);
        setResult(response);
      } else {
        addLog("response", `Server → Error: 目录不存在 "${inputPath}"`);
        setResult(`Error: 目录 "${inputPath}" 不存在\n\n可用目录: ${Object.keys(MOCK_DIRS).join(", ")}`);
      }
    }

    setLoading(false);
  };

  const discoverTools = async () => {
    addLog("info", "Client → GET /tools（能力发现）");
    await new Promise((r) => setTimeout(r, 400));
    addLog("response", `Server → 返回 ${MOCK_TOOLS.length} 个 Tool: ${MOCK_TOOLS.map((t) => t.name).join(", ")}`);
  };

  return (
    <div className="space-y-6 mt-6">
      <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800">
        <h3 className="text-sm font-semibold text-emerald-400 mb-4">MCP 协议交互模拟器</h3>

        {/* 架构图 */}
        <div className="flex items-center justify-center gap-2 mb-6 text-xs">
          <div className="px-3 py-2 rounded-lg bg-blue-500/10 border border-blue-500/30 text-blue-400">
            Host (浏览器)
          </div>
          <span className="text-zinc-600">→</span>
          <div className="px-3 py-2 rounded-lg bg-purple-500/10 border border-purple-500/30 text-purple-400">
            MCP Client
          </div>
          <span className="text-zinc-600">→</span>
          <div className="px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
            MCP Server
          </div>
        </div>

        {/* 控制面板 */}
        <div className="flex gap-3 mb-4">
          <button
            onClick={discoverTools}
            className="px-3 py-1.5 text-xs rounded-md bg-zinc-800 text-zinc-300 hover:bg-zinc-700 transition-colors"
          >
            发现 Tool
          </button>
          <button
            onClick={() => setLogs([])}
            className="px-3 py-1.5 text-xs rounded-md bg-zinc-800 text-zinc-500 hover:bg-zinc-700 transition-colors"
          >
            清空日志
          </button>
        </div>

        {/* Tool 调用表单 */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div>
            <label className="block text-xs text-zinc-500 mb-1">选择 Tool</label>
            <select
              value={selectedTool}
              onChange={(e) => setSelectedTool(e.target.value)}
              className="w-full px-3 py-2 rounded-md bg-zinc-800 border border-zinc-700 text-sm text-zinc-200 focus:border-emerald-500 focus:outline-none"
            >
              {MOCK_TOOLS.map((t) => (
                <option key={t.name} value={t.name}>{t.name}</option>
              ))}
            </select>
          </div>
          <div className="col-span-2">
            <label className="block text-xs text-zinc-500 mb-1">
              {selectedTool === "read_file" ? "filePath" : "dirPath"}
            </label>
            <div className="flex gap-2">
              <input
                value={inputPath}
                onChange={(e) => setInputPath(e.target.value)}
                className="flex-1 px-3 py-2 rounded-md bg-zinc-800 border border-zinc-700 text-sm text-zinc-200 font-mono focus:border-emerald-500 focus:outline-none"
                placeholder={selectedTool === "read_file" ? "package.json" : "."}
              />
              <button
                onClick={executeTool}
                disabled={loading}
                className="px-4 py-2 rounded-md bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-500 disabled:opacity-50 transition-colors"
              >
                {loading ? "..." : "调用"}
              </button>
            </div>
          </div>
        </div>

        {/* 快捷路径 */}
        <div className="flex gap-2 mb-4 flex-wrap">
          <span className="text-xs text-zinc-600">快捷：</span>
          {selectedTool === "read_file"
            ? Object.keys(MOCK_FILES).map((f) => (
                <button key={f} onClick={() => setInputPath(f)} className="text-xs text-zinc-500 hover:text-emerald-400 font-mono transition-colors">
                  {f}
                </button>
              ))
            : Object.keys(MOCK_DIRS).map((d) => (
                <button key={d} onClick={() => setInputPath(d)} className="text-xs text-zinc-500 hover:text-emerald-400 font-mono transition-colors">
                  {d}
                </button>
              ))}
        </div>

        {/* 日志面板 */}
        {logs.length > 0 && (
          <div className="mb-4 rounded-lg bg-black/50 p-3 max-h-48 overflow-y-auto">
            {logs.map((log, i) => (
              <div key={i} className="text-xs font-mono mb-1 flex gap-2">
                <span className="text-zinc-600">{log.time}</span>
                <span className={log.type === "request" ? "text-blue-400" : log.type === "response" ? "text-emerald-400" : "text-zinc-500"}>
                  {log.message}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* 结果 */}
        {result && (
          <pre className="p-4 rounded-lg bg-zinc-950 border border-zinc-800 text-sm text-zinc-300 overflow-x-auto whitespace-pre-wrap">
            {result}
          </pre>
        )}
      </div>
    </div>
  );
}

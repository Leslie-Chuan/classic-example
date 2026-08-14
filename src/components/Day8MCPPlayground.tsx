"use client";

import { useState } from "react";

// ── 类型 ──────────────────────────────────────
interface AgentLog {
  time: string;
  phase: "perceive" | "reason" | "act" | "result" | "system";
  message: string;
}

interface ToolDef {
  name: string;
  description: string;
  category: "read" | "write" | "exec" | "search";
  riskLevel: "low" | "medium" | "high";
}

// ── 预定义 Tool 列表 ──────────────────────────
const AGENT_TOOLS: ToolDef[] = [
  { name: "read_file", description: "读取文件内容", category: "read", riskLevel: "low" },
  { name: "read_directory", description: "列出目录内容", category: "read", riskLevel: "low" },
  { name: "edit_file", description: "字符串替换编辑文件", category: "write", riskLevel: "high" },
  { name: "execute_command", description: "执行 shell 命令", category: "exec", riskLevel: "high" },
  { name: "search_files", description: "搜索文件内容", category: "search", riskLevel: "low" },
];

// ── 预设 Agent 场景 ────────────────────────────
interface Scenario {
  id: string;
  label: string;
  input: string;
  steps: AgentLog[];
}

const SCENARIOS: Scenario[] = [
  {
    id: "analyze",
    label: "分析项目结构",
    input: "帮我分析当前项目的文件结构",
    steps: [
      { time: "00:00", phase: "system", message: "🚀 Agent 启动" },
      { time: "00:01", phase: "perceive", message: "读取用户输入，加载对话上下文" },
      { time: "00:02", phase: "reason", message: "💭 用户想了解项目结构，需要调用 read_directory" },
      { time: "00:03", phase: "act", message: '🔧 read_directory({ path: "." })' },
      { time: "00:04", phase: "result", message: "📊 返回 20 个条目（src/, content/, demos/, package.json...）" },
      { time: "00:05", phase: "perceive", message: "Tool 结果注入上下文（第 2 轮）" },
      { time: "00:06", phase: "reason", message: "💭 已获取完整目录信息，可以总结" },
      { time: "00:07", phase: "system", message: "✅ 任务完成，Agent Loop 退出" },
    ],
  },
  {
    id: "search",
    label: "搜索代码内容",
    input: "搜索包含 MCP 的文件",
    steps: [
      { time: "00:00", phase: "system", message: "🚀 Agent 启动" },
      { time: "00:01", phase: "perceive", message: "提取搜索关键词: MCP" },
      { time: "00:02", phase: "reason", message: '💭 使用 search_files 在项目中搜索 "MCP"' },
      { time: "00:03", phase: "act", message: '🔧 search_files({ pattern: "MCP", path: "." })' },
      { time: "00:04", phase: "result", message: "📊 扫描 20 个文件，找到 8 个匹配（content/daily/2026-04-23.md, demos/day1-mcp/...）" },
      { time: "00:05", phase: "reason", message: "💭 搜索结果已返回，可以总结匹配文件" },
      { time: "00:06", phase: "system", message: "✅ 任务完成" },
    ],
  },
  {
    id: "sandbox-block",
    label: "安全沙箱拦截",
    input: "执行 rm -rf / 删除所有文件",
    steps: [
      { time: "00:00", phase: "system", message: "🚀 Agent 启动" },
      { time: "00:01", phase: "reason", message: "💭 用户请求执行危险命令" },
      { time: "00:02", phase: "act", message: '🔧 execute_command({ command: "rm -rf /" })' },
      { time: "00:03", phase: "result", message: "🛡️ 安全沙箱拦截：危险模式匹配 /rm\\s+-rf\\s+\\//" },
      { time: "00:04", phase: "system", message: "🚫 命令被拒绝，Agent 报告安全拦截" },
    ],
  },
  {
    id: "path-escape",
    label: "路径越界防护",
    input: "读取 /etc/passwd 文件",
    steps: [
      { time: "00:00", phase: "system", message: "🚀 Agent 启动" },
      { time: "00:01", phase: "reason", message: "💭 用户想读取 /etc/passwd" },
      { time: "00:02", phase: "act", message: '🔧 read_file({ path: "/etc/passwd" })' },
      { time: "00:03", phase: "result", message: "🛡️ 路径越界: /etc/passwd 不在工作区内（resolveSafePath 检查失败）" },
      { time: "00:04", phase: "system", message: "🚫 操作被拒绝，Agent 只能访问工作区内的文件" },
    ],
  },
];

const phaseConfig: Record<string, { color: string; label: string }> = {
  perceive: { color: "text-blue-400", label: "感知" },
  reason: { color: "text-purple-400", label: "推理" },
  act: { color: "text-orange-400", label: "行动" },
  result: { color: "text-emerald-400", label: "结果" },
  system: { color: "text-zinc-500", label: "系统" },
};

const categoryColor: Record<string, string> = {
  read: "bg-blue-500/10 border-blue-500/30 text-blue-400",
  write: "bg-red-500/10 border-red-500/30 text-red-400",
  exec: "bg-orange-500/10 border-orange-500/30 text-orange-400",
  search: "bg-emerald-500/10 border-emerald-500/30 text-emerald-400",
};

export default function Day8MCPPlayground() {
  const [selectedScenario, setSelectedScenario] = useState<string | null>(null);
  const [visibleSteps, setVisibleSteps] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [showTools, setShowTools] = useState(false);

  const scenario = SCENARIOS.find((s) => s.id === selectedScenario);

  const playScenario = (id: string) => {
    setSelectedScenario(id);
    setVisibleSteps(0);
    setPlaying(true);
  };

  // 自动播放步骤
  if (playing && scenario && visibleSteps < scenario.steps.length) {
    setTimeout(() => {
      setVisibleSteps((v) => v + 1);
      if (visibleSteps + 1 >= scenario.steps.length) {
        setPlaying(false);
      }
    }, 600);
  }

  const reset = () => {
    setSelectedScenario(null);
    setVisibleSteps(0);
    setPlaying(false);
  };

  return (
    <div className="space-y-6 mt-6">
      <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800">
        <h3 className="text-sm font-semibold text-emerald-400 mb-4">
          Agent Loop 可视化：感知 → 推理 → 行动
        </h3>

        {/* Agent Loop 循环图 */}
        <div className="flex items-center justify-center gap-2 mb-5">
          {[
            { label: "感知 Perceive", icon: "👁️", color: "border-blue-500/30 bg-blue-500/5 text-blue-400" },
            { label: "推理 Reason", icon: "🧠", color: "border-purple-500/30 bg-purple-500/5 text-purple-400" },
            { label: "行动 Act", icon: "⚡", color: "border-orange-500/30 bg-orange-500/5 text-orange-400" },
          ].map((step, i) => (
            <div key={step.label} className="flex items-center gap-2">
              <div className={`px-3 py-2 rounded-lg text-xs border ${step.color}`}>
                <span className="mr-1">{step.icon}</span>
                {step.label}
              </div>
              {i < 2 && <span className="text-zinc-700">→</span>}
            </div>
          ))}
          <span className="text-zinc-700 ml-1">↻</span>
        </div>

        {/* 场景选择 */}
        <div className="mb-4">
          <div className="text-xs text-zinc-500 mb-2">选择一个 Agent 场景：</div>
          <div className="grid grid-cols-4 gap-2">
            {SCENARIOS.map((s) => (
              <button
                key={s.id}
                onClick={() => playScenario(s.id)}
                className={`p-2 rounded-lg border text-xs text-left transition-colors ${
                  selectedScenario === s.id
                    ? "border-emerald-500/30 bg-emerald-500/5"
                    : "border-zinc-800 bg-zinc-950 hover:border-zinc-700"
                }`}
              >
                <div className={`font-medium ${selectedScenario === s.id ? "text-emerald-400" : "text-zinc-300"}`}>
                  {s.label}
                </div>
                <div className="text-zinc-600 mt-0.5 truncate">{s.input}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Agent 执行日志 */}
        {scenario && (
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs text-zinc-500 font-mono">
                Agent Loop 执行日志（{visibleSteps}/{scenario.steps.length} 步）
              </div>
              <div className="flex gap-2">
                {playing && (
                  <span className="text-xs text-emerald-400 animate-pulse">▶ 播放中...</span>
                )}
                <button
                  onClick={reset}
                  className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors"
                >
                  重置
                </button>
              </div>
            </div>
            <div className="rounded-lg bg-black/50 p-3 max-h-56 overflow-y-auto">
              {scenario.steps.slice(0, visibleSteps).map((step, i) => (
                <div key={i} className="text-xs font-mono mb-1.5 flex items-start gap-2">
                  <span className="text-zinc-700 shrink-0">{step.time}</span>
                  <span className={`shrink-0 w-8 text-right ${phaseConfig[step.phase].color}`}>
                    [{phaseConfig[step.phase].label}]
                  </span>
                  <span className="text-zinc-300">{step.message}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tool 浏览器 */}
        <div className="mb-4">
          <button
            onClick={() => setShowTools(!showTools)}
            className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            {showTools ? "▾ 隐藏 Tool Schema" : "▸ 查看 Tool Schema（5 个 Tool）"}
          </button>
          {showTools && (
            <div className="mt-2 grid grid-cols-2 gap-2">
              {AGENT_TOOLS.map((tool) => (
                <div
                  key={tool.name}
                  className={`p-2 rounded-lg border ${categoryColor[tool.category]}`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-mono font-medium">{tool.name}</span>
                    <span className={`text-xs px-1 py-0.5 rounded ${
                      tool.riskLevel === "high" ? "bg-red-500/20 text-red-400" : "bg-emerald-500/20 text-emerald-400"
                    }`}>
                      {tool.riskLevel}
                    </span>
                  </div>
                  <div className="text-xs opacity-70">{tool.description}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 架构要点总结 */}
        <div className="mt-4 pt-4 border-t border-zinc-800 grid grid-cols-2 gap-3 text-xs">
          <div className="p-2 rounded bg-blue-500/5 border border-blue-500/20">
            <div className="font-medium text-blue-400 mb-1">Agent Loop</div>
            <div className="text-zinc-500">感知→推理→行动 闭环。LLM 拥有记忆和状态，多轮迭代逼近目标。</div>
          </div>
          <div className="p-2 rounded bg-purple-500/5 border border-purple-500/20">
            <div className="font-medium text-purple-400 mb-1">Schema-first</div>
            <div className="text-zinc-500">Tool 用 JSON Schema 定义。LLM 在约束空间内做结构化决策，不是自由猜测。</div>
          </div>
          <div className="p-2 rounded bg-orange-500/5 border border-orange-500/20">
            <div className="font-medium text-orange-400 mb-1">安全沙箱</div>
            <div className="text-zinc-500">四层防御：路径边界 → 命令白名单 → 危险模式 → 输出截断。</div>
          </div>
          <div className="p-2 rounded bg-emerald-500/5 border border-emerald-500/20">
            <div className="font-medium text-emerald-400 mb-1">上下文管理</div>
            <div className="text-zinc-500">分层策略：项目骨架（始终保留）+ 工作集（动态加载）+ 历史（压缩摘要）。</div>
          </div>
        </div>
      </div>
    </div>
  );
}

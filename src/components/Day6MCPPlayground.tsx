"use client";

import { useState } from "react";

// ── 类型 ──────────────────────────────────────
interface ToolDef {
  name: string;
  description: string;
  requiredScopes: string[];
  riskColor: string;
}

interface CallLog {
  time: string;
  tool: string;
  result: "success" | "scope_denied" | "rate_limited" | "not_found";
  message: string;
}

// ── 模拟 Tool 注册表 ──────────────────────────
const ALL_TOOLS: ToolDef[] = [
  { name: "github_list_issues", description: "列出仓库 Issue", requiredScopes: ["repo"], riskColor: "emerald" },
  { name: "github_create_issue", description: "创建 Issue", requiredScopes: ["repo", "issues:write"], riskColor: "yellow" },
  { name: "github_close_issue", description: "关闭 Issue", requiredScopes: ["repo", "issues:write"], riskColor: "yellow" },
  { name: "github_merge_pr", description: "合并 Pull Request", requiredScopes: ["repo", "pull_requests:write"], riskColor: "red" },
  { name: "github_delete_repo", description: "删除仓库", requiredScopes: ["admin"], riskColor: "red" },
];

const TOKEN_PROFILES = [
  { label: "只读 Token", scopes: ["repo"], desc: "ghp_demo_readonly → 只能读取" },
  { label: "读写 Token", scopes: ["repo", "issues:write"], desc: "ghp_demo_full → 可读写 Issue" },
  { label: "管理员 Token", scopes: ["repo", "issues:write", "pull_requests:write", "admin"], desc: "ghp_admin → 完全访问" },
];

export default function Day6MCPPlayground() {
  const [tokenIdx, setTokenIdx] = useState(0);
  const [callLogs, setCallLogs] = useState<CallLog[]>([]);
  const [rateRemaining, setRateRemaining] = useState(5);
  const [activeLayer, setActiveLayer] = useState<string>("");

  const now = () => new Date().toLocaleTimeString("zh-CN", { hour12: false });
  const currentToken = TOKEN_PROFILES[tokenIdx];

  // 根据当前 token scope 过滤 Tool
  const getVisibleTools = () =>
    ALL_TOOLS.filter((t) => t.requiredScopes.every((s) => currentToken.scopes.includes(s)));

  const getHiddenTools = () =>
    ALL_TOOLS.filter((t) => !t.requiredScopes.every((s) => currentToken.scopes.includes(s)));

  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

  const simulateCall = async (tool: ToolDef) => {
    setActiveLayer("protocol");
    await sleep(300);
    setActiveLayer("orchestration");
    await sleep(300);

    // 权限检查
    const missingScopes = tool.requiredScopes.filter((s) => !currentToken.scopes.includes(s));
    if (missingScopes.length > 0) {
      setActiveLayer("");
      setCallLogs((prev) => [...prev, {
        time: now(), tool: tool.name,
        result: "scope_denied",
        message: `🛡️ 权限不足: 需要 ${missingScopes.join(", ")}`,
      }]);
      return;
    }

    // 速率限制检查
    if (rateRemaining <= 0) {
      setActiveLayer("");
      setCallLogs((prev) => [...prev, {
        time: now(), tool: tool.name,
        result: "rate_limited",
        message: `⏳ 速率限制已达上限，请稍后重试`,
      }]);
      return;
    }

    setRateRemaining((prev) => prev - 1);
    setActiveLayer("domain");
    await sleep(400);
    setActiveLayer("");

    setCallLogs((prev) => [...prev, {
      time: now(), tool: tool.name,
      result: "success",
      message: `✅ 执行成功（剩余配额: ${rateRemaining - 1}）`,
    }]);
  };

  const simulateUnknownTool = async () => {
    setActiveLayer("protocol");
    await sleep(200);
    setActiveLayer("orchestration");
    await sleep(200);
    setActiveLayer("");
    setCallLogs((prev) => [...prev, {
      time: now(), tool: "github_unknown_tool",
      result: "not_found",
      message: `错误: Tool "github_unknown_tool" 不存在`,
    }]);
  };

  const switchToken = (idx: number) => {
    setTokenIdx(idx);
    setCallLogs([]);
    setRateRemaining(5);
    setActiveLayer("");
  };

  const resetAll = () => {
    setCallLogs([]);
    setRateRemaining(5);
    setActiveLayer("");
  };

  const visibleTools = getVisibleTools();
  const hiddenTools = getHiddenTools();

  const layerColor: Record<string, string> = {
    protocol: "border-blue-500/50 bg-blue-500/10 text-blue-300",
    orchestration: "border-purple-500/50 bg-purple-500/10 text-purple-300",
    domain: "border-emerald-500/50 bg-emerald-500/10 text-emerald-300",
  };

  const resultIcon: Record<string, string> = {
    success: "text-emerald-400",
    scope_denied: "text-red-400",
    rate_limited: "text-yellow-400",
    not_found: "text-zinc-500",
  };

  return (
    <div className="space-y-6 mt-6">
      <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800">
        <h3 className="text-sm font-semibold text-emerald-400 mb-4">
          生产级 MCP Server 架构模拟器：OAuth Scope → Tool 过滤
        </h3>

        {/* 三层架构图（动态高亮） */}
        <div className="flex items-center justify-center gap-1 mb-5">
          {(["protocol", "orchestration", "domain"] as const).map((layer, i) => (
            <div key={layer} className="flex items-center gap-1">
              <div
                className={`px-3 py-2 rounded-lg text-xs font-medium border transition-all duration-300 ${
                  activeLayer === layer
                    ? layerColor[layer] + " scale-105"
                    : "border-zinc-800 bg-zinc-900 text-zinc-600"
                }`}
              >
                {layer === "protocol" ? "Protocol" : layer === "orchestration" ? "Orchestration" : "Domain"}
              </div>
              {i < 2 && <span className={`text-xs ${activeLayer === layer ? "text-zinc-400" : "text-zinc-700"}`}>→</span>}
            </div>
          ))}
        </div>

        {/* Token 选择 */}
        <div className="mb-4">
          <div className="text-xs text-zinc-500 mb-2">选择 Token 权限等级（模拟 OAuth Scope）：</div>
          <div className="flex gap-2">
            {TOKEN_PROFILES.map((tp, i) => (
              <button
                key={tp.label}
                onClick={() => switchToken(i)}
                className={`flex-1 p-2 rounded-lg border text-left transition-colors ${
                  tokenIdx === i
                    ? "border-emerald-500/30 bg-emerald-500/5"
                    : "border-zinc-800 bg-zinc-950 hover:border-zinc-700"
                }`}
              >
                <div className={`text-xs font-medium ${tokenIdx === i ? "text-emerald-400" : "text-zinc-300"}`}>
                  {tp.label}
                </div>
                <div className="text-xs text-zinc-600 mt-0.5">{tp.desc}</div>
                <div className="flex flex-wrap gap-1 mt-1">
                  {tp.scopes.map((s) => (
                    <span key={s} className="text-xs px-1 py-0.5 rounded bg-zinc-800 text-zinc-500 font-mono">
                      {s}
                    </span>
                  ))}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* 速率限制状态 */}
        <div className="mb-4 flex items-center gap-3 text-xs">
          <span className="text-zinc-500">API 配额:</span>
          <div className="flex gap-0.5">
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className={`w-4 h-2 rounded-sm ${
                  i < rateRemaining ? "bg-emerald-500/60" : "bg-zinc-800"
                }`}
              />
            ))}
          </div>
          <span className={`font-mono ${rateRemaining <= 1 ? "text-red-400" : "text-zinc-400"}`}>
            {rateRemaining}/5
          </span>
        </div>

        {/* Tool 列表：可见 vs 隐藏 */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="p-3 rounded-lg bg-zinc-950 border border-emerald-500/20">
            <div className="text-xs text-emerald-400 font-medium mb-2">
              ✓ 可见 Tool（{visibleTools.length} 个）— 模型能看到并调用
            </div>
            {visibleTools.map((t) => (
              <button
                key={t.name}
                onClick={() => simulateCall(t)}
                className="w-full text-left p-2 mb-1 rounded bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 transition-colors"
              >
                <div className="text-xs font-mono text-zinc-200">{t.name}</div>
                <div className="text-xs text-zinc-500">{t.description}</div>
              </button>
            ))}
          </div>
          <div className="p-3 rounded-lg bg-zinc-950 border border-red-500/20">
            <div className="text-xs text-red-400 font-medium mb-2">
              ✗ 隐藏 Tool（{hiddenTools.length} 个）— 权限不足，模型看不到
            </div>
            {hiddenTools.map((t) => (
              <div
                key={t.name}
                className="p-2 mb-1 rounded bg-zinc-900/50 border border-zinc-800/50 opacity-60"
              >
                <div className="text-xs font-mono text-zinc-500 line-through">{t.name}</div>
                <div className="text-xs text-zinc-600">需要: {t.requiredScopes.join(", ")}</div>
              </div>
            ))}
            <button
              onClick={simulateUnknownTool}
              className="w-full mt-1 text-left p-2 rounded bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 border-dashed transition-colors"
            >
              <div className="text-xs text-zinc-500">+ 尝试调用不存在的 Tool</div>
            </button>
          </div>
        </div>

        {/* 调用日志 */}
        {callLogs.length > 0 && (
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs text-zinc-500 font-mono">请求链路日志</div>
              <button
                onClick={resetAll}
                className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors"
              >
                清空
              </button>
            </div>
            <div className="rounded-lg bg-black/50 p-3 max-h-48 overflow-y-auto">
              {callLogs.map((log, i) => (
                <div key={i} className="text-xs font-mono mb-1.5 flex items-start gap-2">
                  <span className="text-zinc-700 shrink-0">{log.time}</span>
                  <span className={`shrink-0 ${resultIcon[log.result]}`}>
                    {log.result === "success" ? "→" : "✗"}
                  </span>
                  <span className="text-zinc-400 shrink-0">{log.tool}</span>
                  <span className="text-zinc-500">{log.message}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 架构模式总结 */}
        <div className="mt-4 pt-4 border-t border-zinc-800 grid grid-cols-2 gap-3 text-xs">
          <div className="p-2 rounded bg-purple-500/5 border border-purple-500/20">
            <div className="font-medium text-purple-400 mb-1">filterToolsByScope</div>
            <div className="text-zinc-500">initialize 阶段按 token scope 过滤 Tool 列表，模型只看到"能做的事"。</div>
          </div>
          <div className="p-2 rounded bg-orange-500/5 border border-orange-500/20">
            <div className="font-medium text-orange-400 mb-1">assertToolPermission</div>
            <div className="text-zinc-500">调用时双重权限检查（防御性编程），防止 filter 后被绕过。</div>
          </div>
          <div className="p-2 rounded bg-yellow-500/5 border border-yellow-500/20">
            <div className="font-medium text-yellow-400 mb-1">checkRateLimit</div>
            <div className="text-zinc-500">速率限制 → 友好错误提示，告诉 LLM "何时可以重试"。</div>
          </div>
          <div className="p-2 rounded bg-emerald-500/5 border border-emerald-500/20">
            <div className="font-medium text-emerald-400 mb-1">normalizeError</div>
            <div className="text-zinc-500">错误翻译为 LLM 可理解的格式 + Emoji，错误本身是 Prompt 的一部分。</div>
          </div>
        </div>

        {/* ASK 方法论 */}
        <div className="mt-3 p-3 rounded-lg bg-zinc-950 border border-zinc-800">
          <div className="text-xs text-zinc-400 font-medium mb-2">ASK 源码阅读法</div>
          <div className="grid grid-cols-3 gap-2 text-xs">
            <div>
              <span className="text-blue-400 font-medium">A</span>
              <span className="text-zinc-500">rchitecture — 先看目录和入口，理解分层</span>
            </div>
            <div>
              <span className="text-purple-400 font-medium">S</span>
              <span className="text-zinc-500">urface — 找一个场景，追踪完整请求链路</span>
            </div>
            <div>
              <span className="text-emerald-400 font-medium">K</span>
              <span className="text-zinc-500">nobs — 找出所有可配置点（环境变量等）</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

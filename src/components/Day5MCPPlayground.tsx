"use client";

import { useState } from "react";

// ── 类型 ──────────────────────────────────────
interface AuditRecord {
  time: string;
  tool: string;
  scenario: string;
  decision: "allow" | "deny" | "confirm_allow" | "confirm_deny";
  reason: string;
}

interface Scenario {
  id: string;
  label: string;
  tool: string;
  riskLevel: "low" | "high" | "unknown";
  description: string;
  args: Record<string, string>;
}

// ── 预设安全场景 ──────────────────────────────
const SCENARIOS: Scenario[] = [
  {
    id: "read-safe",
    label: "读取项目文件",
    tool: "read_file",
    riskLevel: "low",
    description: "读取 package.json（白名单内，低风险）",
    args: { filepath: "./package.json" },
  },
  {
    id: "read-escape",
    label: "路径逃逸",
    tool: "read_file",
    riskLevel: "low",
    description: "尝试读取 /etc/passwd（路径不在白名单）",
    args: { filepath: "/etc/passwd" },
  },
  {
    id: "write-unauthorized",
    label: "越权写入",
    tool: "write_file",
    riskLevel: "high",
    description: "写入 /tmp/hacked.txt（路径不在允许列表）",
    args: { filepath: "/tmp/hacked.txt", content: "malicious" },
  },
  {
    id: "write-sandbox",
    label: "沙箱写入",
    tool: "write_file",
    riskLevel: "high",
    description: "写入 ./sandbox/test.txt（高风险，需确认）",
    args: { filepath: "./sandbox/test.txt", content: "Hello!" },
  },
  {
    id: "exec-command",
    label: "执行命令",
    tool: "execute_command",
    riskLevel: "high",
    description: "执行 echo 命令（高风险，需确认 + 次数限制）",
    args: { command: "echo 'Hello from MCP!'" },
  },
  {
    id: "unknown-tool",
    label: "未注册工具",
    tool: "delete_all_files",
    riskLevel: "unknown",
    description: "调用未注册的工具（默认拒绝）",
    args: {},
  },
];

// ── 权限引擎（浏览器模拟） ────────────────────
function evaluatePermission(scenario: Scenario, callCount: number): {
  decision: AuditRecord["decision"];
  reason: string;
} {
  const { tool, args, riskLevel } = scenario;

  // 未注册工具 → 默认拒绝
  if (riskLevel === "unknown") {
    return { decision: "deny", reason: `工具 "${tool}" 未在权限规则中注册（默认拒绝）` };
  }

  // 调用次数限制
  if (tool === "execute_command" && callCount >= 3) {
    return { decision: "deny", reason: `"${tool}" 调用次数已达上限 (3)` };
  }

  // 路径白名单
  const filepath = args.filepath || "";
  if (tool === "read_file") {
    if (filepath.startsWith("/etc") || filepath.startsWith("/var")) {
      return { decision: "deny", reason: `路径 "${filepath}" 不在允许列表内` };
    }
    return { decision: "allow", reason: "低风险操作（low），白名单内，直接放行" };
  }

  if (tool === "write_file") {
    if (!filepath.startsWith("./sandbox") && !filepath.startsWith("sandbox")) {
      return { decision: "deny", reason: `路径 "${filepath}" 不在允许列表内（仅允许 sandbox/）` };
    }
    return { decision: "confirm_allow", reason: "高风险操作（high），路径合法，需用户确认后放行" };
  }

  if (tool === "execute_command") {
    return { decision: "confirm_allow", reason: "高风险操作（high），需用户确认后放行" };
  }

  return { decision: "deny", reason: "未知情况，默认拒绝" };
}

export default function Day5MCPPlayground() {
  const [auditLog, setAuditLog] = useState<AuditRecord[]>([]);
  const [callCounters, setCallCounters] = useState<Record<string, number>>({});
  const [lastResult, setLastResult] = useState<string>("");
  const [showConfirmDialog, setShowConfirmDialog] = useState<Scenario | null>(null);

  const now = () => new Date().toLocaleTimeString("zh-CN", { hour12: false });

  const runScenario = (scenario: Scenario) => {
    const count = callCounters[scenario.tool] || 0;
    const { decision, reason } = evaluatePermission(scenario, count);

    if (decision === "confirm_allow") {
      // 弹出确认对话框
      setShowConfirmDialog(scenario);
      return;
    }

    // 直接记录审计
    const record: AuditRecord = {
      time: now(),
      tool: scenario.tool,
      scenario: scenario.label,
      decision,
      reason,
    };
    setAuditLog((prev) => [...prev, record]);

    if (decision === "allow") {
      setCallCounters((prev) => ({ ...prev, [scenario.tool]: count + 1 }));
      setLastResult(`✅ 放行执行: ${scenario.tool}(${JSON.stringify(scenario.args)})\n\n结果: 操作成功（模拟响应）`);
    } else {
      setLastResult(`🚫 拒绝: ${reason}`);
    }
  };

  const handleConfirm = (approved: boolean) => {
    if (!showConfirmDialog) return;
    const scenario = showConfirmDialog;
    const count = callCounters[scenario.tool] || 0;

    const decision = approved ? "confirm_allow" as const : "confirm_deny" as const;
    const reason = approved
      ? evaluatePermission(scenario, count).reason + " → 用户确认通过"
      : "用户拒绝确认";

    const record: AuditRecord = {
      time: now(),
      tool: scenario.tool,
      scenario: scenario.label,
      decision,
      reason,
    };
    setAuditLog((prev) => [...prev, record]);

    if (approved) {
      setCallCounters((prev) => ({ ...prev, [scenario.tool]: count + 1 }));
      setLastResult(`✅ 用户确认后执行: ${scenario.tool}(${JSON.stringify(scenario.args)})\n\n结果: 操作成功（模拟响应）`);
    } else {
      setLastResult(`🚫 用户拒绝: ${scenario.label}`);
    }

    setShowConfirmDialog(null);
  };

  const resetAll = () => {
    setAuditLog([]);
    setCallCounters({});
    setLastResult("");
    setShowConfirmDialog(null);
  };

  const allowCount = auditLog.filter((r) => r.decision === "allow" || r.decision === "confirm_allow").length;
  const denyCount = auditLog.filter((r) => r.decision === "deny" || r.decision === "confirm_deny").length;

  const decisionStyle: Record<string, string> = {
    allow: "text-emerald-400 bg-emerald-500/10",
    deny: "text-red-400 bg-red-500/10",
    confirm_allow: "text-yellow-400 bg-yellow-500/10",
    confirm_deny: "text-orange-400 bg-orange-500/10",
  };

  const decisionLabel: Record<string, string> = {
    allow: "ALLOW",
    deny: "DENY",
    confirm_allow: "CONFIRM→ALLOW",
    confirm_deny: "CONFIRM→DENY",
  };

  const riskBadge: Record<string, string> = {
    low: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
    high: "bg-red-500/20 text-red-400 border-red-500/30",
    unknown: "bg-zinc-500/20 text-zinc-400 border-zinc-500/30",
  };

  return (
    <div className="space-y-6 mt-6">
      <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800">
        <h3 className="text-sm font-semibold text-emerald-400 mb-4">
          MCP 安全模型模拟器：四层权限防御
        </h3>

        {/* 四层架构图 */}
        <div className="grid grid-cols-4 gap-2 mb-5 text-xs">
          {[
            { label: "Transport", desc: "进程隔离", color: "border-blue-500/30 bg-blue-500/5 text-blue-400" },
            { label: "Discovery", desc: "风险分级", color: "border-purple-500/30 bg-purple-500/5 text-purple-400" },
            { label: "Execution", desc: "拦截校验", color: "border-orange-500/30 bg-orange-500/5 text-orange-400" },
            { label: "Audit", desc: "日志追溯", color: "border-emerald-500/30 bg-emerald-500/5 text-emerald-400" },
          ].map((layer) => (
            <div key={layer.label} className={`p-2 rounded-lg border text-center ${layer.color}`}>
              <div className="font-medium">{layer.label}</div>
              <div className="text-zinc-500 mt-0.5">{layer.desc}</div>
            </div>
          ))}
        </div>

        {/* 场景按钮 */}
        <div className="mb-4">
          <div className="text-xs text-zinc-500 mb-2">选择一个安全场景触发：</div>
          <div className="grid grid-cols-3 gap-2">
            {SCENARIOS.map((s) => (
              <button
                key={s.id}
                onClick={() => runScenario(s)}
                className={`p-2 rounded-lg border text-left transition-colors hover:border-zinc-600 ${
                  s.riskLevel === "high" ? "border-red-500/20" : s.riskLevel === "low" ? "border-emerald-500/20" : "border-zinc-700"
                } bg-zinc-950`}
              >
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="text-xs font-medium text-zinc-200">{s.label}</span>
                  <span className={`text-xs px-1.5 py-0.5 rounded border ${riskBadge[s.riskLevel]}`}>
                    {s.riskLevel.toUpperCase()}
                  </span>
                </div>
                <div className="text-xs text-zinc-500 leading-tight">{s.description}</div>
              </button>
            ))}
          </div>
        </div>

        {/* 确认弹窗 */}
        {showConfirmDialog && (
          <div className="mb-4 p-4 rounded-lg bg-yellow-500/5 border border-yellow-500/30">
            <div className="text-sm font-medium text-yellow-400 mb-2">⚠️ 高风险操作确认</div>
            <div className="text-xs text-zinc-400 mb-1">
              工具: <span className="text-zinc-200 font-mono">{showConfirmDialog.tool}</span>
            </div>
            <div className="text-xs text-zinc-400 mb-3">
              参数: <span className="text-zinc-200 font-mono">{JSON.stringify(showConfirmDialog.args)}</span>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => handleConfirm(true)}
                className="px-4 py-1.5 text-xs rounded-md bg-emerald-600 text-white hover:bg-emerald-500 transition-colors"
              >
                确认执行
              </button>
              <button
                onClick={() => handleConfirm(false)}
                className="px-4 py-1.5 text-xs rounded-md bg-red-600/80 text-white hover:bg-red-500 transition-colors"
              >
                拒绝
              </button>
            </div>
          </div>
        )}

        {/* 结果 */}
        {lastResult && (
          <pre className="mb-4 p-3 rounded-lg bg-zinc-950 border border-zinc-800 text-sm text-zinc-300 whitespace-pre-wrap">
            {lastResult}
          </pre>
        )}

        {/* 审计日志 */}
        {auditLog.length > 0 && (
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs text-zinc-500 font-mono">审计日志 ({auditLog.length} 条)</div>
              <div className="text-xs">
                <span className="text-emerald-400">✅ {allowCount}</span>
                <span className="text-zinc-600 mx-1">|</span>
                <span className="text-red-400">🚫 {denyCount}</span>
              </div>
            </div>
            <div className="rounded-lg bg-black/50 p-3 max-h-48 overflow-y-auto">
              {auditLog.map((record, i) => (
                <div key={i} className="text-xs font-mono mb-1.5 flex items-start gap-2">
                  <span className="text-zinc-700 shrink-0">{record.time}</span>
                  <span className={`shrink-0 px-1.5 py-0.5 rounded text-xs ${decisionStyle[record.decision]}`}>
                    {decisionLabel[record.decision]}
                  </span>
                  <span className="text-zinc-400">{record.tool}</span>
                  <span className="text-zinc-600">—</span>
                  <span className="text-zinc-500">{record.reason}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 重置 */}
        {auditLog.length > 0 && (
          <button
            onClick={resetAll}
            className="px-3 py-1.5 text-xs rounded-md bg-zinc-800 text-zinc-500 hover:bg-zinc-700 transition-colors"
          >
            重置所有
          </button>
        )}

        {/* 安全原则总结 */}
        <div className="mt-4 pt-4 border-t border-zinc-800 grid grid-cols-2 gap-3 text-xs">
          <div className="p-2 rounded bg-zinc-950 border border-zinc-800">
            <div className="font-medium text-red-400 mb-1">默认拒绝 (Default Deny)</div>
            <div className="text-zinc-500">未注册的工具一律拦截。不能信任 Server 的自我声明。</div>
          </div>
          <div className="p-2 rounded bg-zinc-950 border border-zinc-800">
            <div className="font-medium text-yellow-400 mb-1">最小权限 (Least Privilege)</div>
            <div className="text-zinc-500">只开放必要的路径和操作。路径白名单精确到目录级别。</div>
          </div>
          <div className="p-2 rounded bg-zinc-950 border border-zinc-800">
            <div className="font-medium text-blue-400 mb-1">Human-in-the-loop</div>
            <div className="text-zinc-500">高风险操作（写入、命令执行）必须用户显式确认后才能执行。</div>
          </div>
          <div className="p-2 rounded bg-zinc-950 border border-zinc-800">
            <div className="font-medium text-emerald-400 mb-1">审计可追溯 (Audit Trail)</div>
            <div className="text-zinc-500">每次调用记录决策和时间戳。事后排查有据可查。</div>
          </div>
        </div>
      </div>
    </div>
  );
}

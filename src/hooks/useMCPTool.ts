// Day 1 实践三：React Hook 封装 MCP Tool 调用
// 适合在 AI 驱动的 IDE 插件、低代码平台、智能文档系统中使用

import { useState, useCallback } from "react";

interface UseMCPToolOptions {
  serverUrl: string;
  timeout?: number;
}

interface UseMCPToolResult<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
  execute: (args: Record<string, unknown>) => Promise<void>;
}

/**
 * 封装 MCP Tool 调用的 React Hook
 *
 * 用法示例：
 * ```tsx
 * const { data, loading, error, execute } = useMCPTool("list_dir", {
 *   serverUrl: "http://localhost:3000/mcp",
 * });
 *
 * <button onClick={() => execute({ dirPath: "src" })}>
 *   {loading ? "加载中..." : "列出 src 目录"}
 * </button>
 * ```
 */
export function useMCPTool<T = unknown>(
  toolName: string,
  options: UseMCPToolOptions
): UseMCPToolResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const execute = useCallback(
    async (args: Record<string, unknown>) => {
      setLoading(true);
      setError(null);

      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), options.timeout || 30000);

        const res = await fetch(`${options.serverUrl}/tools/call`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: toolName, arguments: args }),
          signal: controller.signal,
        });

        clearTimeout(timer);

        if (!res.ok) {
          throw new Error(`MCP Server error: ${res.status} ${res.statusText}`);
        }

        const result = await res.json();
        const text = result.content?.[0]?.text;
        setData(text ? (JSON.parse(text) as T) : (result as T));
      } catch (err) {
        setError(err instanceof Error ? err : new Error(String(err)));
      } finally {
        setLoading(false);
      }
    },
    [toolName, options.serverUrl, options.timeout]
  );

  return { data, loading, error, execute };
}

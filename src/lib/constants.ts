// 学习模块定义
export interface Module {
  id: number;
  name: string;
  dateRange: string;
  weeks: string;
  topics: string[];
}

export const MODULES: Module[] = [
  {
    id: 1,
    name: "AI 编码代理与工具链",
    dateRange: "2026.04.23 - 2026.06.21",
    weeks: "Week 1-8",
    topics: ["MCP 协议", "AI Agent 架构", "Prompt Engineering", "AI 代码质量", "AI Builder"],
  },
  {
    id: 2,
    name: "LLM 在前端的落地应用",
    dateRange: "2026.06.22 - 2026.07.21",
    weeks: "Week 9-12",
    topics: ["RAG 与前端", "流式 UI", "生成式组件", "AI 原生应用架构"],
  },
  {
    id: 3,
    name: "底层原理与性能",
    dateRange: "2026.07.22 - 2026.08.21",
    weeks: "Week 13-16",
    topics: ["V8 引擎", "WebAssembly", "编译原理", "浏览器架构"],
  },
  {
    id: 4,
    name: "全栈与边缘计算",
    dateRange: "2026.08.22 - 2026.09.21",
    weeks: "Week 17-20",
    topics: ["Edge Runtime", "类型安全", "实时协作", "现代部署"],
  },
  {
    id: 5,
    name: "系统设计与架构",
    dateRange: "2026.09.22 - 2026.10.21",
    weeks: "Week 21-24",
    topics: ["前端架构模式", "可扩展性", "可观测性", "DevEx"],
  },
];

// 技能成长 checklist
export interface Skill {
  name: string;
  status: "done" | "in_progress" | "pending";
}

export const SKILLS: Skill[] = [
  { name: "MCP Server 开发", status: "done" },
  { name: "AI Agent 架构设计", status: "in_progress" },
  { name: "Prompt Engineering 工程化", status: "pending" },
  { name: "AI 辅助代码质量流程", status: "pending" },
  { name: "RAG 系统前端实现", status: "in_progress" },
  { name: "流式 UI 组件开发", status: "pending" },
  { name: "V8 引擎优化实践", status: "pending" },
  { name: "WebAssembly 应用开发", status: "pending" },
  { name: "Babel/AST 插件开发", status: "done" },
  { name: "Edge Runtime 部署", status: "pending" },
  { name: "全栈类型安全架构", status: "pending" },
  { name: "实时协作系统开发", status: "pending" },
  { name: "前端系统设计能力", status: "pending" },
  { name: "可观测性体系建设", status: "pending" },
];

// 学习计划常量
export const LEARN_START_DATE = "2026-04-23";
export const TOTAL_DAYS = 176;

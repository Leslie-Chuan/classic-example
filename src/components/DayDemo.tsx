"use client";

import dynamic from "next/dynamic";

const MCPPlayground = dynamic(() => import("./MCPPlayground"), { ssr: false });
const Day2MCPPlayground = dynamic(() => import("./Day2MCPPlayground"), { ssr: false });
const Day3MCPPlayground = dynamic(() => import("./Day3MCPPlayground"), { ssr: false });
const Day5MCPPlayground = dynamic(() => import("./Day5MCPPlayground"), { ssr: false });

// Day 编号 → 对应的交互 Demo 组件
const DEMO_MAP: Record<number, React.ComponentType> = {
  1: MCPPlayground,
  2: Day2MCPPlayground,
  3: Day3MCPPlayground,
  5: Day5MCPPlayground,
};

interface Props {
  dayNum: number;
}

export default function DayDemo({ dayNum }: Props) {
  const DemoComponent = DEMO_MAP[dayNum];
  if (!DemoComponent) return null;

  return (
    <section className="mt-8 pt-6 border-t border-zinc-800">
      <h2 className="text-lg font-semibold mb-2 text-emerald-400">
        交互实践
      </h2>
      <DemoComponent />
    </section>
  );
}

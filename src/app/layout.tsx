import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI 前端每日学习",
  description: "高级前端开发者 AI 时代学习计划 — 代码实验室 + 知识库 + 进度追踪",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN" className="dark">
      <body className="min-h-screen bg-zinc-950 text-zinc-100 antialiased">
        <header className="border-b border-zinc-800 bg-zinc-950/80 backdrop-blur sticky top-0 z-50">
          <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
            <a href="/" className="flex items-center gap-2 text-sm font-semibold">
              <span className="text-emerald-400">{"</>"}</span>
              AI 前端每日学习
            </a>
            <nav className="flex items-center gap-6 text-sm text-zinc-400">
              <a href="/" className="hover:text-white transition-colors">仪表盘</a>
              <a href="/modules" className="hover:text-white transition-colors">模块</a>
              <a
                href="https://github.com/Leslie-Chuan/classic-example"
                target="_blank"
                rel="noopener"
                className="hover:text-white transition-colors"
              >
                GitHub
              </a>
            </nav>
          </div>
        </header>
        <main className="max-w-5xl mx-auto px-6 py-8">{children}</main>
      </body>
    </html>
  );
}

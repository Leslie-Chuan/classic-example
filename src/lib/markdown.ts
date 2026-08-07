import { createHighlighter, Highlighter } from "shiki";

let highlighter: Highlighter | null = null;

async function getHighlighter(): Promise<Highlighter> {
  if (!highlighter) {
    highlighter = await createHighlighter({
      themes: ["github-dark"],
      langs: [
        "javascript", "typescript", "tsx", "jsx", "json", "html", "css",
        "bash", "shell", "markdown", "yaml", "rust", "wasm",
      ],
    });
  }
  return highlighter;
}

const LANG_MAP: Record<string, string> = {
  js: "javascript",
  ts: "typescript",
  sh: "bash",
  zsh: "bash",
  md: "markdown",
  yml: "yaml",
};

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function renderMarkdown(content: string): Promise<string> {
  const hl = await getHighlighter();

  // Process code blocks first
  const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
  let processed = content;
  const codeBlocks: string[] = [];

  processed = processed.replace(codeBlockRegex, (_, lang, code) => {
    const normalizedLang = LANG_MAP[lang] || lang || "text";
    let highlighted: string;
    try {
      const loadedLangs = hl.getLoadedLanguages();
      if (loadedLangs.includes(normalizedLang)) {
        highlighted = hl.codeToHtml(code.trimEnd(), {
          lang: normalizedLang,
          theme: "github-dark",
        });
      } else {
        highlighted = `<pre class="shiki github-dark"><code>${escapeHtml(code.trimEnd())}</code></pre>`;
      }
    } catch {
      highlighted = `<pre class="shiki github-dark"><code>${escapeHtml(code.trimEnd())}</code></pre>`;
    }
    const placeholder = `__CODE_BLOCK_${codeBlocks.length}__`;
    codeBlocks.push(highlighted);
    return placeholder;
  });

  // Simple markdown to HTML conversion
  let html = processed;

  // Tables
  html = html.replace(/^(\|.+\|)\n(\|[-| :]+\|)\n((?:\|.+\|\n?)*)/gm, (_, header, _sep, body) => {
    const thCells = header.split("|").filter((c: string) => c.trim()).map((c: string) => `<th>${c.trim()}</th>`).join("");
    const rows = body.trim().split("\n").map((row: string) => {
      const cells = row.split("|").filter((c: string) => c.trim()).map((c: string) => `<td>${c.trim()}</td>`).join("");
      return `<tr>${cells}</tr>`;
    }).join("");
    return `<table><thead><tr>${thCells}</tr></thead><tbody>${rows}</tbody></table>`;
  });

  // Headers
  html = html.replace(/^#### (.+)$/gm, "<h4>$1</h4>");
  html = html.replace(/^### (.+)$/gm, "<h3>$1</h3>");
  html = html.replace(/^## (.+)$/gm, "<h2>$1</h2>");
  html = html.replace(/^# (.+)$/gm, "<h1>$1</h1>");

  // Blockquotes
  html = html.replace(/^> (.+)$/gm, "<blockquote><p>$1</p></blockquote>");

  // Bold & inline code
  html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/`([^`]+)`/g, "<code>$1</code>");

  // Links
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');

  // Horizontal rules
  html = html.replace(/^---$/gm, "<hr>");

  // Unordered lists
  html = html.replace(/^- (.+)$/gm, "<li>$1</li>");
  html = html.replace(/((?:<li>.*<\/li>\n?)+)/g, "<ul>$1</ul>");

  // Paragraphs (lines not starting with HTML tags or empty)
  html = html.replace(/^(?!<[a-z/]|$)(.+)$/gm, "<p>$1</p>");

  // Clean up extra whitespace
  html = html.replace(/\n{3,}/g, "\n\n");

  // Restore code blocks
  codeBlocks.forEach((block, i) => {
    html = html.replace(`__CODE_BLOCK_${i}__`, block);
    // Also handle if wrapped in <p> tags
    html = html.replace(`<p>${block}</p>`, block);
  });

  return html;
}

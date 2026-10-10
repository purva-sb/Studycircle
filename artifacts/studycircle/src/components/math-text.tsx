import katex from "katex";
import "katex/dist/katex.min.css";
import DOMPurify, { type Config } from "dompurify";
import { useMemo } from "react";

// KaTeX produces <span>, <mrow>, etc. with class names like "katex".
// Block scripts, event handlers, javascript:/data: URLs.
const SANITIZE_CONFIG: Config = {
  ALLOWED_TAGS: [
    "span", "div", "p", "br", "strong", "em", "u", "code", "pre",
    "sub", "sup", "i", "b",
    // KaTeX MathML
    "math", "mrow", "mi", "mn", "mo", "msup", "msub", "mfrac", "msqrt", "munder", "mover",
    "munderover", "msubsup", "mtext", "mspace", "ms", "mtable", "mtr", "mtd", "annotation",
    "semantics", "mphantom", "menclose", "mstyle", "mfenced", "mglyph",
  ],
  ALLOWED_ATTR: ["class", "style", "aria-hidden", "xmlns", "encoding", "mathvariant"],
  ALLOWED_URI_REGEXP: /^(?:https?|mailto):/i,
  FORBID_TAGS: ["script", "iframe", "object", "embed", "link", "meta", "form", "input", "button", "a"],
  FORBID_ATTR: ["onerror", "onload", "onclick", "onmouseover", "onfocus", "href", "src", "srcset", "formaction", "action"],
};

interface MathTextProps {
  text: string;
  className?: string;
  block?: boolean; // force display math
}

/**
 * Renders text that may contain LaTeX.
 * Inline math:   $...$   or   \(...\)
 * Display math:  $$...$$ or   \[...\]
 */
export function MathText({ text, className, block }: MathTextProps) {
  const html = useMemo(() => {
    if (!text) return "";

    // If block mode, render entire string as display math
    if (block) {
      try {
        return katex.renderToString(text, { displayMode: true, throwOnError: false });
      } catch {
        return text;
      }
    }

    // Split on display math first: $$...$$ or \[...\]
    const parts: string[] = [];
    let remaining = text;

    const processMath = (str: string): string => {
      // Replace $$...$$ with display math
      str = str.replace(/\$\$([^$]+?)\$\$/g, (_, math) => {
        try {
          return katex.renderToString(math.trim(), { displayMode: true, throwOnError: false });
        } catch {
          return `$$${math}$$`;
        }
      });

      // Replace $...$ with inline math (but not $$ which was already handled)
      str = str.replace(/\$([^$\n]+?)\$/g, (_, math) => {
        try {
          return katex.renderToString(math.trim(), { displayMode: false, throwOnError: false });
        } catch {
          return `$${math}$`;
        }
      });

      // Replace \[...\] with display math
      str = str.replace(/\\\[(.+?)\\\]/gs, (_, math) => {
        try {
          return katex.renderToString(math.trim(), { displayMode: true, throwOnError: false });
        } catch {
          return `\\[${math}\\]`;
        }
      });

      // Replace \(...\) with inline math
      str = str.replace(/\\\((.+?)\\\)/gs, (_, math) => {
        try {
          return katex.renderToString(math.trim(), { displayMode: false, throwOnError: false });
        } catch {
          return `\\(${math}\\)`;
        }
      });

      return str;
    };

    return processMath(remaining);
  }, [text, block]);

  const safeHtml = useMemo(() => DOMPurify.sanitize(html, SANITIZE_CONFIG), [html]);

  return (
    <span
      className={className}
      style={{ whiteSpace: "pre-wrap" }}
      dangerouslySetInnerHTML={{ __html: safeHtml }}
    />
  );
}

/** Preview panel shown in admin while typing */
export function MathPreview({ text, label = "Preview" }: { text: string; label?: string }) {
  if (!text.trim()) return null;
  return (
    <div className="rounded-lg border border-white/10 bg-white/5 p-3 space-y-1">
      <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-semibold">{label}</p>
      <MathText text={text} className="text-sm leading-relaxed" />
    </div>
  );
}

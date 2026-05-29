import React, { memo, useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import "highlight.js/styles/github.css";
import { AlertBox } from "./AlertBox";
import { AnalyticsCard } from "./AnalyticsCard";
import { ChartRenderer, ChartSpec } from "./ChartRenderer";
import { CodeBlock } from "./CodeBlock";
import { DataTable } from "./DataTable";
import { InsightPanel } from "./InsightPanel";
import { cn } from "@/lib/utils";

type JsonRecord = Record<string, unknown>;

interface MarkdownRendererProps {
  content: string;
  compact?: boolean;
  inverted?: boolean;
}

type ContentSegment =
  | { type: "markdown"; value: string }
  | { type: "json"; value: unknown };

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function tryParseJson(text: string): unknown | null {
  const trimmed = text.trim();
  if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) return null;
  try {
    return JSON.parse(trimmed);
  } catch {
    return null;
  }
}

function splitContentSegments(content: string): ContentSegment[] {
  const trimmed = content.trim();
  const wholeJson = tryParseJson(trimmed);
  if (wholeJson) return [{ type: "json", value: wholeJson }];

  const segments: ContentSegment[] = [];
  const pattern = /```json\s*([\s\S]*?)```/gi;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(trimmed)) !== null) {
    if (match.index > lastIndex) {
      const md = trimmed.slice(lastIndex, match.index).trim();
      if (md) segments.push({ type: "markdown", value: md });
    }
    const parsed = tryParseJson(match[1]);
    if (parsed) segments.push({ type: "json", value: parsed });
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < trimmed.length) {
    const md = trimmed.slice(lastIndex).trim();
    if (md) segments.push({ type: "markdown", value: md });
  }

  if (segments.length === 0) {
    return [{ type: "markdown", value: content }];
  }

  return segments;
}

function numberEntries(data: JsonRecord) {
  return Object.entries(data)
    .filter(([, value]) => typeof value === "number" || typeof value === "string")
    .slice(0, 6);
}

function findRows(data: unknown): Array<Record<string, unknown>> | null {
  if (Array.isArray(data) && data.every(isRecord)) return data as Array<Record<string, unknown>>;
  if (!isRecord(data)) return null;

  for (const value of Object.values(data)) {
    if (Array.isArray(value) && value.every(isRecord)) {
      return value as Array<Record<string, unknown>>;
    }
    if (isRecord(value)) {
      for (const nested of Object.values(value)) {
        if (Array.isArray(nested) && nested.every(isRecord)) {
          return nested as Array<Record<string, unknown>>;
        }
      }
    }
  }

  return null;
}

function findCharts(data: unknown): ChartSpec[] {
  if (!isRecord(data)) return [];
  const charts = data.charts || data.chart;

  if (Array.isArray(charts)) {
    return charts.filter((item): item is ChartSpec => isRecord(item) && Array.isArray(item.data));
  }

  if (isRecord(charts) && Array.isArray(charts.data)) {
    return [charts as unknown as ChartSpec];
  }

  return [];
}

function findInsights(data: unknown): string[] {
  if (!isRecord(data)) return [];
  const value = data.insights || data.summary || data.recommendations || data.action_points || data.key_findings;
  if (Array.isArray(value)) return value.map(String);
  if (typeof value === "string" && value.trim()) return [value];
  return [];
}

function StructuredJsonView({ data }: { data: unknown }) {
  const rows = findRows(data);
  const charts = findCharts(data);
  const insights = findInsights(data);
  const stats = isRecord(data) ? numberEntries(data.stats && isRecord(data.stats) ? data.stats : data) : [];

  return (
    <div className="space-y-4">
      {stats.length > 0 && (
        <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
          {stats.map(([key, value], index) => (
            <AnalyticsCard
              key={key}
              label={key}
              value={String(value)}
              tone={index % 3 === 0 ? "blue" : index % 3 === 1 ? "green" : "amber"}
            />
          ))}
        </div>
      )}

      {rows && rows.length > 0 && <DataTable title="Analysis data" rows={rows} />}

      {charts.map((chart, index) => (
        <ChartRenderer key={`${chart.title || "chart"}-${index}`} spec={chart} />
      ))}

      {insights.length > 0 && <InsightPanel title="Key insights" insights={insights} />}
    </div>
  );
}

const markdownComponents = {
  a: ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => {
    const safeHref = href && !/^(javascript|data):/i.test(href) ? href : undefined;
    return (
      <a href={safeHref} target="_blank" rel="noopener noreferrer" className="font-medium text-blue-700 underline underline-offset-2 dark:text-blue-300" {...props}>
        {children}
      </a>
    );
  },
  h1: ({ children }: { children?: React.ReactNode }) => (
    <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">{children}</h1>
  ),
  h2: ({ children }: { children?: React.ReactNode }) => (
    <h2 className="mt-5 border-b border-slate-200 pb-2 text-lg font-bold text-slate-900 dark:border-slate-700 dark:text-white">{children}</h2>
  ),
  h3: ({ children }: { children?: React.ReactNode }) => (
    <h3 className="mt-4 text-base font-semibold text-slate-900 dark:text-slate-100">{children}</h3>
  ),
  p: ({ children }: { children?: React.ReactNode }) => (
    <p className="text-[0.9375rem] leading-7 text-slate-700 dark:text-slate-300">{children}</p>
  ),
  ul: ({ children }: { children?: React.ReactNode }) => (
    <ul className="my-2 list-disc space-y-1.5 pl-5 text-[0.9375rem] leading-7 text-slate-700 dark:text-slate-300">{children}</ul>
  ),
  ol: ({ children }: { children?: React.ReactNode }) => (
    <ol className="my-2 list-decimal space-y-1.5 pl-5 text-[0.9375rem] leading-7 text-slate-700 dark:text-slate-300">{children}</ol>
  ),
  li: ({ children }: { children?: React.ReactNode }) => <li className="break-words">{children}</li>,
  blockquote: ({ children }: { children?: React.ReactNode }) => <AlertBox title="Note">{children}</AlertBox>,
  hr: () => <hr className="my-5 border-slate-200 dark:border-slate-700" />,
  table: ({ children }: { children?: React.ReactNode }) => (
    <div className="ai-table-wrap">
      <table>{children}</table>
    </div>
  ),
  thead: ({ children }: { children?: React.ReactNode }) => <thead>{children}</thead>,
  th: ({ children }: { children?: React.ReactNode }) => <th>{children}</th>,
  td: ({ children }: { children?: React.ReactNode }) => <td>{children}</td>,
  code({ inline, className, children, ...props }: { inline?: boolean; className?: string; children?: React.ReactNode }) {
    const match = /language-(\w+)/.exec(className || "");
    const value = String(children).replace(/\n$/, "");

    if (inline) {
      return (
        <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[0.85em] text-slate-800 dark:bg-slate-800 dark:text-slate-100" {...props}>
          {children}
        </code>
      );
    }

    if (match?.[1] === "json") {
      const parsed = tryParseJson(value);
      if (parsed) return <StructuredJsonView data={parsed} />;
    }

    return <CodeBlock language={match?.[1]} value={value} />;
  },
};

function MarkdownBlock({ value, compact, inverted }: { value: string; compact?: boolean; inverted?: boolean }) {
  return (
    <div className={cn("ai-markdown", compact && "ai-markdown-compact", inverted && "ai-markdown-inverted")}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[
          rehypeHighlight,
          [
            rehypeSanitize,
            {
              ...defaultSchema,
              attributes: {
                ...defaultSchema.attributes,
                a: [...(defaultSchema.attributes?.a || []), "target", "rel"],
              },
            },
          ],
        ]}
        components={markdownComponents}
      >
        {value}
      </ReactMarkdown>
    </div>
  );
}

function RichContent({ content, compact, inverted }: MarkdownRendererProps) {
  const segments = useMemo(() => splitContentSegments(content), [content]);

  return (
    <div className="space-y-4">
      {segments.map((segment, index) =>
        segment.type === "json" ? (
          <StructuredJsonView key={`json-${index}`} data={segment.value} />
        ) : (
          <MarkdownBlock key={`md-${index}`} value={segment.value} compact={compact} inverted={inverted} />
        )
      )}
    </div>
  );
}

export const MarkdownRenderer = memo(function MarkdownRenderer({ content, compact = false, inverted = false }: MarkdownRendererProps) {
  if (!content.trim()) return null;
  return <RichContent content={content} compact={compact} inverted={inverted} />;
});

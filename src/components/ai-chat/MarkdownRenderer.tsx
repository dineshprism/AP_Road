import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import "highlight.js/styles/github-dark.css";
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

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseJson(content: string): unknown | null {
  const trimmed = content.trim();
  const fenced = trimmed.match(/^```json\s*([\s\S]*?)\s*```$/i);
  const candidate = fenced ? fenced[1] : trimmed;

  if (!candidate.startsWith("{") && !candidate.startsWith("[")) return null;

  try {
    return JSON.parse(candidate);
  } catch {
    return null;
  }
}

function numberEntries(data: JsonRecord) {
  return Object.entries(data).filter(([, value]) => typeof value === "number" || typeof value === "string").slice(0, 6);
}

function findRows(data: unknown): Array<Record<string, unknown>> | null {
  if (Array.isArray(data) && data.every(isRecord)) return data as Array<Record<string, unknown>>;
  if (!isRecord(data)) return null;

  for (const value of Object.values(data)) {
    if (Array.isArray(value) && value.every(isRecord)) {
      return value as Array<Record<string, unknown>>;
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
  const value = data.insights || data.summary || data.recommendations || data.action_points;
  if (Array.isArray(value)) return value.map(String);
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
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
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

      {rows && <DataTable title="Structured Data" rows={rows} />}

      {charts.map((chart, index) => (
        <ChartRenderer key={index} spec={chart} />
      ))}

      <InsightPanel title="Insights" insights={insights} />

      <details className="rounded-xl border border-slate-200 bg-white p-4 text-sm dark:border-slate-800 dark:bg-slate-950">
        <summary className="cursor-pointer font-bold text-slate-900 dark:text-slate-100">Raw JSON</summary>
        <div className="mt-3">
          <CodeBlock language="json" value={JSON.stringify(data, null, 2)} />
        </div>
      </details>
    </div>
  );
}

export function MarkdownRenderer({ content, compact = false, inverted = false }: MarkdownRendererProps) {
  const parsedJson = parseJson(content);

  if (parsedJson) {
    return <StructuredJsonView data={parsedJson} />;
  }

  return (
    <div className={cn("ai-markdown", compact && "ai-markdown-compact", inverted && "ai-markdown-inverted")}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight]}
        components={{
          h1: ({ children }) => <h1 className="text-2xl font-extrabold tracking-tight text-slate-950 dark:text-white">{children}</h1>,
          h2: ({ children }) => <h2 className="mt-5 text-xl font-extrabold tracking-tight text-slate-950 dark:text-white">{children}</h2>,
          h3: ({ children }) => <h3 className="mt-4 text-base font-bold text-slate-900 dark:text-slate-100">{children}</h3>,
          p: ({ children }) => <p className="text-sm leading-7 text-slate-700 dark:text-slate-300">{children}</p>,
          ul: ({ children }) => <ul className="space-y-2 pl-5 text-sm leading-7 text-slate-700 dark:text-slate-300">{children}</ul>,
          ol: ({ children }) => <ol className="space-y-2 pl-5 text-sm leading-7 text-slate-700 dark:text-slate-300">{children}</ol>,
          li: ({ children }) => <li className="list-disc marker:text-blue-600">{children}</li>,
          blockquote: ({ children }) => <AlertBox title="Note">{children}</AlertBox>,
          table: ({ children }) => (
            <div className="my-3 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[520px] border-collapse text-left text-sm">{children}</table>
              </div>
            </div>
          ),
          thead: ({ children }) => <thead className="bg-slate-100 text-xs uppercase tracking-wide text-slate-600 dark:bg-slate-900 dark:text-slate-300">{children}</thead>,
          th: ({ children }) => <th className="border-b border-slate-200 px-4 py-3 font-bold dark:border-slate-800">{children}</th>,
          td: ({ children }) => <td className="border-b border-slate-100 px-4 py-3 align-top text-slate-700 dark:border-slate-800 dark:text-slate-300">{children}</td>,
          code({ inline, className, children, ...props }: any) {
            const match = /language-(\w+)/.exec(className || "");
            const value = String(children).replace(/\n$/, "");

            if (inline) {
              return (
                <code className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[0.9em] font-semibold text-blue-800 dark:bg-slate-800 dark:text-blue-200" {...props}>
                  {children}
                </code>
              );
            }

            return <CodeBlock language={match?.[1]} value={value} />;
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

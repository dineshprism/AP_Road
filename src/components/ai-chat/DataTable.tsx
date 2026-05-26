import { cn } from "@/lib/utils";

interface DataTableProps {
  title?: string;
  rows: Array<Record<string, unknown>>;
  className?: string;
}

function prettifyKey(key: string) {
  return key.replace(/[_-]+/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatValue(value: unknown) {
  if (value == null || value === "") return "N/A";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

export function DataTable({ title, rows, className }: DataTableProps) {
  const columns = Array.from(new Set(rows.flatMap((row) => Object.keys(row)))).slice(0, 8);

  if (rows.length === 0 || columns.length === 0) {
    return null;
  }

  return (
    <div className={cn("overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950", className)}>
      {title && (
        <div className="border-b border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-900">
          <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">{title}</h4>
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] border-collapse text-left text-sm">
          <thead className="bg-slate-100 text-xs uppercase tracking-wide text-slate-600 dark:bg-slate-900 dark:text-slate-300">
            <tr>
              {columns.map((column) => (
                <th key={column} className="border-b border-slate-200 px-4 py-3 font-bold dark:border-slate-800">
                  {prettifyKey(column)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIndex) => (
              <tr key={rowIndex} className="border-b border-slate-100 last:border-b-0 dark:border-slate-800/80">
                {columns.map((column) => (
                  <td key={`${rowIndex}-${column}`} className="max-w-[280px] px-4 py-3 align-top text-slate-700 dark:text-slate-300">
                    <span className="line-clamp-4">{formatValue(row[column])}</span>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

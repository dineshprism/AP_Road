import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { cn } from "@/lib/utils";

export type ChartKind = "bar" | "pie" | "line" | "area";

export interface ChartSpec {
  title?: string;
  type?: ChartKind;
  data: Array<Record<string, string | number>>;
  xKey?: string;
  yKey?: string;
}

const colors = ["#2563eb", "#16a34a", "#f59e0b", "#dc2626", "#7c3aed", "#0891b2"];

function inferKeys(data: ChartSpec["data"], xKey?: string, yKey?: string) {
  const first = data[0] || {};
  const keys = Object.keys(first);
  const inferredX = xKey || keys.find((key) => typeof first[key] === "string") || keys[0] || "name";
  const inferredY = yKey || keys.find((key) => key !== inferredX && typeof first[key] === "number") || keys[1] || "value";
  return { x: inferredX, y: inferredY };
}

export function ChartRenderer({ spec, className }: { spec: ChartSpec; className?: string }) {
  if (!Array.isArray(spec.data) || spec.data.length === 0) return null;

  const type = spec.type || "bar";
  const { x, y } = inferKeys(spec.data, spec.xKey, spec.yKey);

  return (
    <div className={cn("rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950", className)}>
      {spec.title && <h4 className="mb-3 text-sm font-bold text-slate-900 dark:text-slate-100">{spec.title}</h4>}
      <div className="h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          {type === "pie" ? (
            <PieChart>
              <Tooltip />
              <Pie data={spec.data} dataKey={y} nameKey={x} outerRadius={92} innerRadius={42} paddingAngle={3}>
                {spec.data.map((_, index) => (
                  <Cell key={index} fill={colors[index % colors.length]} />
                ))}
              </Pie>
            </PieChart>
          ) : type === "line" ? (
            <LineChart data={spec.data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey={x} tickLine={false} axisLine={false} />
              <YAxis tickLine={false} axisLine={false} />
              <Tooltip />
              <Line type="monotone" dataKey={y} stroke="#2563eb" strokeWidth={3} dot={{ r: 4 }} />
            </LineChart>
          ) : type === "area" ? (
            <AreaChart data={spec.data}>
              <defs>
                <linearGradient id="ai-area-fill" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="5%" stopColor="#2563eb" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#2563eb" stopOpacity={0.03} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey={x} tickLine={false} axisLine={false} />
              <YAxis tickLine={false} axisLine={false} />
              <Tooltip />
              <Area type="monotone" dataKey={y} stroke="#2563eb" strokeWidth={3} fill="url(#ai-area-fill)" />
            </AreaChart>
          ) : (
            <BarChart data={spec.data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
              <XAxis dataKey={x} tickLine={false} axisLine={false} />
              <YAxis tickLine={false} axisLine={false} />
              <Tooltip />
              <Bar dataKey={y} fill="#2563eb" radius={[8, 8, 2, 2]} />
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
}

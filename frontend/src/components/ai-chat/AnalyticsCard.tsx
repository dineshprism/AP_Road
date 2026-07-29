import { ArrowUpRight, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

interface AnalyticsCardProps {
  label: string;
  value: string | number;
  detail?: string;
  tone?: "blue" | "green" | "amber" | "red" | "slate";
}

const toneClasses = {
  blue: "from-blue-600/12 to-cyan-500/10 text-blue-700 dark:text-blue-300",
  green: "from-emerald-600/12 to-teal-500/10 text-emerald-700 dark:text-emerald-300",
  amber: "from-amber-500/16 to-orange-500/10 text-amber-700 dark:text-amber-300",
  red: "from-red-600/12 to-rose-500/10 text-red-700 dark:text-red-300",
  slate: "from-slate-500/12 to-slate-400/10 text-slate-700 dark:text-slate-300",
};

export function AnalyticsCard({ label, value, detail, tone = "blue" }: AnalyticsCardProps) {
  return (
    <div className={cn("rounded-xl border border-white/70 bg-gradient-to-br p-4 shadow-sm dark:border-white/10", toneClasses[tone])}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-bold uppercase tracking-wide opacity-75">{label}</p>
        {detail ? <ArrowUpRight className="h-4 w-4 opacity-70" /> : <Minus className="h-4 w-4 opacity-40" />}
      </div>
      <p className="mt-2 text-2xl font-extrabold tracking-tight text-slate-950 dark:text-white">{value}</p>
      {detail && <p className="mt-1 text-xs leading-5 opacity-80">{detail}</p>}
    </div>
  );
}

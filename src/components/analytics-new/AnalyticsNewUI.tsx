import type { KeyboardEvent, ReactNode } from "react";
import { ChevronRight, MousePointerClick } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ANALYTICS_SEVERITY_STYLES, getInteractiveProps } from "@/lib/analytics-shared";
import { cn } from "@/lib/utils";

export function KpiTile({
  label,
  value,
  hint,
  tone = "primary",
  icon: Icon,
  onClick,
  subAction,
}: {
  label: string;
  value: string | number;
  hint?: string;
  tone?: "primary" | "danger" | "warning" | "success" | "info" | "violet";
  icon: React.ComponentType<{ className?: string }>;
  onClick?: () => void;
  subAction?: string;
}) {
  const tones = {
    primary: "from-[#163a70] to-[#2f5d97]",
    danger: "from-[#b42318] to-[#d92d20]",
    warning: "from-[#c75b12] to-[#e8710a]",
    success: "from-[#138808] to-[#2a7c4a]",
    info: "from-[#267fa3] to-[#4f6fad]",
    violet: "from-[#5b2ca0] to-[#7a4cc2]",
  };

  return (
    <div {...(onClick ? getInteractiveProps(onClick) : {})}>
      <Card className="group overflow-hidden border border-slate-200/80 bg-white shadow-sm transition hover:shadow-lg">
        <div className={cn("h-1 bg-gradient-to-r", tones[tone])} />
        <CardContent className="flex items-start justify-between gap-3 p-4">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">{label}</p>
            <p className="mt-1 text-2xl font-extrabold tracking-tight text-slate-900">{value}</p>
            {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
            {onClick && (
              <p className="mt-2 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-primary opacity-0 transition group-hover:opacity-100">
                <MousePointerClick className="h-3 w-3" />
                {subAction || "View FIRs"}
              </p>
            )}
          </div>
          <div className={cn("rounded-2xl bg-gradient-to-br p-3 text-white shadow-md", tones[tone])}>
            <Icon className="h-5 w-5" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export function RankRow({
  rank,
  title,
  subtitle,
  metric,
  secondary,
  badge,
  onClick,
}: {
  rank: number;
  title: string;
  subtitle?: string;
  metric: string;
  secondary?: string;
  badge?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex w-full items-center gap-3 rounded-2xl border border-slate-200 bg-white px-3 py-3 text-left shadow-sm transition hover:border-[#163a70]/35 hover:bg-[#f7fbff] hover:shadow-md"
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-slate-100 to-slate-200 text-sm font-extrabold text-slate-800">
        {rank}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold text-slate-900 group-hover:text-[#163a70]">{title}</p>
        {subtitle && <p className="truncate text-xs text-slate-500">{subtitle}</p>}
        {secondary && <p className="truncate text-[11px] text-slate-400">{secondary}</p>}
      </div>
      <div className="text-right">
        <p className="text-sm font-bold text-slate-900">{metric}</p>
        {badge && (
          <Badge variant="outline" className={cn("mt-1 text-[10px]", ANALYTICS_SEVERITY_STYLES[badge] || "")}>
            {badge}
          </Badge>
        )}
      </div>
      <ChevronRight className="h-4 w-4 shrink-0 text-slate-400 group-hover:text-[#163a70]" />
    </button>
  );
}

export function ChartPanel({
  title,
  description,
  children,
  className,
  height = "h-72",
}: {
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
  height?: string;
}) {
  return (
    <Card className={cn("border-slate-200/90 bg-white shadow-sm", className)}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="text-base font-bold text-slate-900">{title}</CardTitle>
            {description && (
              <CardDescription className="mt-1 flex items-center gap-1 text-xs">
                <MousePointerClick className="h-3 w-3 shrink-0" />
                {description}
              </CardDescription>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className={cn(height, "pb-4")}>{children}</CardContent>
    </Card>
  );
}

export function QuickFilterChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1.5 text-xs font-semibold transition",
        active
          ? "border-[#163a70] bg-[#163a70] text-white shadow-sm"
          : "border-slate-200 bg-white text-slate-700 hover:border-[#163a70]/40 hover:bg-[#f4f7fb]"
      )}
    >
      {label}
    </button>
  );
}

export function InsightStrip({
  title,
  value,
  hint,
  onClick,
}: {
  title: string;
  value: string;
  hint?: string;
  onClick?: () => void;
}) {
  const props = onClick ? getInteractiveProps(onClick) : {};
  return (
    <div
      {...props}
      className={cn(
        "rounded-2xl border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-4 shadow-sm",
        onClick && "cursor-pointer hover:border-primary/30"
      )}
    >
      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{title}</p>
      <p className="mt-1 text-xl font-bold text-slate-900">{value}</p>
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

export function MapPointRow({
  fir,
  place,
  district,
  casualties,
  date,
  onClick,
}: {
  fir: string;
  place: string;
  district: string;
  casualties: string;
  date: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center justify-between gap-2 rounded-xl border border-slate-200 px-3 py-2 text-left text-sm hover:bg-slate-50"
    >
      <div className="min-w-0">
        <p className="font-semibold text-slate-900">{fir}</p>
        <p className="truncate text-xs text-slate-500">
          {place} · {district}
        </p>
      </div>
      <div className="shrink-0 text-right text-xs">
        <p className="font-bold text-slate-800">{casualties}</p>
        <p className="text-slate-500">{date}</p>
      </div>
    </button>
  );
}

export function SectionHero({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm backdrop-blur sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h2 className="text-lg font-bold text-slate-900">{title}</h2>
        <p className="text-sm text-slate-600">{subtitle}</p>
      </div>
      {children}
    </div>
  );
}

export function getChartClickHandler<T extends Record<string, unknown>>(
  onPick: (payload: T) => void
) {
  return (state: { activePayload?: Array<{ payload?: T }> }) => {
    const payload = state?.activePayload?.[0]?.payload;
    if (payload) onPick(payload);
  };
}

export type DrillContext = {
  label: string;
  mode: "classic" | "pro";
};

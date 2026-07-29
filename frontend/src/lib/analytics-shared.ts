import type { KeyboardEvent } from "react";

export const ANALYTICS_CHART_COLORS = [
  "#163a70",
  "#c75b12",
  "#d39d11",
  "#2a7c4a",
  "#267fa3",
  "#7a4cc2",
  "#aa3d47",
  "#4f6fad",
];

export const ANALYTICS_SEVERITY_STYLES: Record<string, string> = {
  Critical: "bg-red-50 text-red-700 border-red-200",
  High: "bg-orange-50 text-orange-700 border-orange-200",
  Medium: "bg-amber-50 text-amber-700 border-amber-200",
  Low: "bg-emerald-50 text-emerald-700 border-emerald-200",
};

export function getChartPayload<T extends Record<string, unknown>>(entry: unknown): T | null {
  if (!entry || typeof entry !== "object") return null;
  const payload = (entry as { payload?: T }).payload;
  return payload && typeof payload === "object" ? payload : null;
}

export function shortenCauseLabel(value: string, max = 28) {
  const trimmed = value.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max - 1)}…`;
}

export function formatPercent(value: number, digits = 1) {
  return `${value.toFixed(digits)}%`;
}

export function isIsoDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export function parseDateValue(value: string) {
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function formatDateLabel(value: string) {
  const parsed = parseDateValue(value);
  if (!parsed) return value;
  return parsed.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

export function getInteractiveProps(onActivate: () => void) {
  return {
    role: "button" as const,
    tabIndex: 0,
    onClick: onActivate,
    onKeyDown: (event: KeyboardEvent<HTMLDivElement>) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        onActivate();
      }
    },
    className:
      "cursor-pointer rounded-xl transition-all hover:-translate-y-0.5 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
  };
}

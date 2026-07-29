import { AlertTriangle, CheckCircle2, Info } from "lucide-react";
import { cn } from "@/lib/utils";

interface AlertBoxProps {
  title?: string;
  children: React.ReactNode;
  tone?: "info" | "warning" | "success";
}

const config = {
  info: {
    icon: Info,
    className: "border-blue-200 bg-blue-50 text-blue-950 dark:border-blue-900/70 dark:bg-blue-950/40 dark:text-blue-100",
  },
  warning: {
    icon: AlertTriangle,
    className: "border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900/70 dark:bg-amber-950/40 dark:text-amber-100",
  },
  success: {
    icon: CheckCircle2,
    className: "border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900/70 dark:bg-emerald-950/40 dark:text-emerald-100",
  },
};

export function AlertBox({ title, children, tone = "info" }: AlertBoxProps) {
  const Icon = config[tone].icon;

  return (
    <div className={cn("flex gap-3 rounded-xl border p-4 text-sm leading-6", config[tone].className)}>
      <Icon className="mt-0.5 h-4 w-4 shrink-0" />
      <div>
        {title && <p className="mb-1 font-bold">{title}</p>}
        <div>{children}</div>
      </div>
    </div>
  );
}

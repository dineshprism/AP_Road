import { Loader2, Sparkles } from "lucide-react";

export function ChatThinking({ label = "Analysing submission data" }: { label?: string }) {
  return (
    <div className="flex gap-3">
      <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#163a70] to-[#2563eb] text-white">
        <Sparkles className="h-4 w-4" />
      </div>
      <div className="flex-1 rounded-2xl rounded-tl-md border border-slate-200/90 bg-white px-4 py-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/80">
        <div className="flex items-center gap-2 text-sm font-medium text-slate-600 dark:text-slate-300">
          <Loader2 className="h-4 w-4 animate-spin text-[#163a70]" />
          {label}
        </div>
        <div className="mt-4 space-y-2.5">
          <div className="h-2.5 w-[92%] animate-pulse rounded-full bg-slate-100 dark:bg-slate-800" />
          <div className="h-2.5 w-[78%] animate-pulse rounded-full bg-slate-100 dark:bg-slate-800" />
          <div className="h-2.5 w-[65%] animate-pulse rounded-full bg-slate-100 dark:bg-slate-800" />
        </div>
      </div>
    </div>
  );
}

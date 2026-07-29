import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface CodeBlockProps {
  language?: string;
  value: string;
  className?: string;
}

export function CodeBlock({ language, value, className }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  return (
    <div className={cn("group relative overflow-hidden rounded-xl border border-slate-800 bg-slate-950 shadow-lg", className)}>
      <div className="flex items-center justify-between border-b border-white/10 bg-white/[0.03] px-3 py-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-300">
          {language || "code"}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={handleCopy}
          className="h-8 gap-1.5 rounded-lg text-slate-300 hover:bg-white/10 hover:text-white"
        >
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>
      <pre className="max-h-[420px] overflow-auto p-4 text-[13px] leading-6 text-slate-100">
        <code className={language ? `language-${language}` : undefined}>{value}</code>
      </pre>
    </div>
  );
}

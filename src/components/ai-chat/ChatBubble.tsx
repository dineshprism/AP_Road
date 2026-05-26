import { motion } from "framer-motion";
import { Bot, User } from "lucide-react";
import { MarkdownRenderer } from "./MarkdownRenderer";
import { cn } from "@/lib/utils";

interface ChatBubbleProps {
  type: "user" | "assistant";
  content: string;
  timestamp: Date;
}

export function ChatBubble({ type, content, timestamp }: ChatBubbleProps) {
  const isUser = type === "user";

  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.22, ease: "easeOut" }}
      className={cn("flex items-end gap-3", isUser ? "justify-end" : "justify-start")}
    >
      {!isUser && (
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-700 to-cyan-600 text-white shadow-lg shadow-blue-900/20">
          <Bot className="h-4 w-4" />
        </div>
      )}
      <div
        className={cn(
          "max-w-[min(100%,56rem)] overflow-hidden rounded-2xl px-4 py-3 shadow-sm",
          isUser
            ? "rounded-br-md bg-gradient-to-br from-[#102a5c] to-[#1d4f91] text-white"
            : "rounded-bl-md border border-white/70 bg-white/85 text-slate-800 shadow-[0_22px_70px_-44px_rgba(15,23,42,0.55)] backdrop-blur-xl dark:border-white/10 dark:bg-slate-950/82"
        )}
      >
        <MarkdownRenderer content={content} compact={isUser} inverted={isUser} />
        <p className={cn("mt-3 text-[11px]", isUser ? "text-white/70" : "text-slate-400")}>
          {timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </p>
      </div>
      {isUser && (
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-white shadow-lg shadow-slate-900/20">
          <User className="h-4 w-4" />
        </div>
      )}
    </motion.div>
  );
}

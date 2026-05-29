import { memo } from "react";
import { motion } from "framer-motion";
import { Sparkles, User } from "lucide-react";
import { MarkdownRenderer } from "./MarkdownRenderer";
import { cn } from "@/lib/utils";

interface ChatBubbleProps {
  type: "user" | "assistant";
  content: string;
  isLatest?: boolean;
}

export const ChatBubble = memo(function ChatBubble({ type, content, isLatest }: ChatBubbleProps) {
  const isUser = type === "user";

  if (isUser) {
    return (
      <motion.div
        initial={isLatest ? { opacity: 0, y: 6 } : false}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className="flex justify-end"
      >
        <div className="flex max-w-[85%] items-start gap-2">
          <div className="rounded-2xl rounded-br-md bg-[#163a70] px-4 py-2.5 text-sm leading-6 text-white shadow-sm">
            <p className="whitespace-pre-wrap break-words">{content}</p>
          </div>
          <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-200 text-slate-600">
            <User className="h-4 w-4" />
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={isLatest ? { opacity: 0, y: 8 } : false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
      className="flex gap-3"
    >
      <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#163a70] to-[#2563eb] text-white shadow-sm">
        <Sparkles className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="rounded-2xl rounded-tl-md border border-slate-200/90 bg-white px-4 py-3 shadow-sm dark:border-slate-800 dark:bg-slate-900/80">
          <MarkdownRenderer content={content} />
        </div>
      </div>
    </motion.div>
  );
});

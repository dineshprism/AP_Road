import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Loader2, Send, Sparkles, X } from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ChatBubble } from "@/components/ai-chat/ChatBubble";
import { ChatThinking } from "@/components/ai-chat/ChatThinking";

interface Message {
  id: string;
  type: "user" | "assistant";
  content: string;
}

interface ChatHistoryItem {
  role: "user" | "assistant";
  content: string;
}

interface Submission {
  id: string;
  fir_number: string;
  district: string;
  place_of_accident?: string;
  mandal?: string;
}

interface AccidentChatProps {
  isOpen: boolean;
  onClose?: () => void;
  submissions: Submission[];
  title?: string;
  variant?: "modal" | "panel";
  className?: string;
}

const QUICK_PROMPTS = [
  "Executive summary with KPIs",
  "Causes and risk factors table",
  "Road engineering findings",
  "Recommended interventions",
  "Compare patterns across cases",
  "Bar chart of top risk categories",
];

const createMessage = (type: Message["type"], content: string): Message => ({
  id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  type,
  content,
});

const buildHistory = (historyMessages: Message[]): ChatHistoryItem[] =>
  historyMessages
    .filter((message) => message.content.trim().length > 0)
    .slice(-8)
    .map((message) => ({
      role: message.type,
      content: message.content,
    }));

const AccidentChat: React.FC<AccidentChatProps> = ({
  isOpen,
  onClose,
  submissions,
  title = "AI Analysis",
  variant = "modal",
  className,
}) => {
  const [sessionMessages, setSessionMessages] = useState<Record<string, Message[]>>({});
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const initialLoadRef = useRef<string | null>(null);

  const sessionKey = useMemo(
    () => submissions.map((submission) => submission.id).sort().join("|"),
    [submissions]
  );
  const messages = useMemo(() => sessionMessages[sessionKey] || [], [sessionKey, sessionMessages]);
  const isPanel = variant === "panel";
  const scopeLabel =
    submissions.length === 1
      ? `${submissions[0].fir_number} · ${submissions[0].district}`
      : `${submissions.length} submissions`;

  const setMessagesForSession = useCallback(
    (updater: Message[] | ((prev: Message[]) => Message[])) => {
      setSessionMessages((prev) => {
        const currentMessages = prev[sessionKey] || [];
        const nextMessages =
          typeof updater === "function" ? (updater as (prev: Message[]) => Message[])(currentMessages) : updater;
        return { ...prev, [sessionKey]: nextMessages };
      });
    },
    [sessionKey]
  );

  const appendAssistant = useCallback(
    (content: string) => {
      setMessagesForSession((prev) => [...prev, createMessage("assistant", content)]);
    },
    [setMessagesForSession]
  );

  const runAnalysis = useCallback(
    async (question?: string, history?: ChatHistoryItem[]) => {
      if (submissions.length === 1) {
        return api.rag.analyze({ submissionId: submissions[0].id, question, history });
      }
      return api.rag.batchAnalyze({
        submissionIds: submissions.map((submission) => submission.id),
        question,
        history,
      });
    },
    [submissions]
  );

  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;
    container.scrollTo({ top: container.scrollHeight, behavior: "smooth" });
  }, [messages, isLoading]);

  useEffect(() => {
    if (isOpen && submissions.length > 0) {
      inputRef.current?.focus();
    }
  }, [isOpen, submissions.length, sessionKey]);

  useEffect(() => {
    if (!isOpen || submissions.length === 0) return;
    if (initialLoadRef.current === sessionKey) return;
    initialLoadRef.current = sessionKey;

    const loadInitial = async () => {
      setMessagesForSession([]);
      setIsLoading(true);
      try {
        const defaultQuestion =
          submissions.length === 1
            ? "Provide a professional accident analysis: executive summary, markdown KPI table, key causes, risk alerts, and prioritized action points. Use clear headings and tables."
            : "Provide a professional pattern analysis across these cases: summary, comparison table, recurring causes, hotspots, and recommendations. Use clear headings and tables.";
        const { data, error } = await runAnalysis(defaultQuestion);
        if (error) throw new Error(error);
        appendAssistant(data?.response || "No analysis was returned.");
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Unknown error";
        appendAssistant(`## Analysis unavailable\n\n${message}`);
        toast.error(message);
      } finally {
        setIsLoading(false);
      }
    };

    void loadInitial();
  }, [isOpen, sessionKey, submissions.length, runAnalysis, setMessagesForSession, appendAssistant]);

  const handleSendMessage = async (message: string) => {
    if (!message.trim() || isLoading || submissions.length === 0) return;

    const trimmedMessage = message.trim();
    const nextUserMessage = createMessage("user", trimmedMessage);
    const requestHistory = buildHistory([...messages, nextUserMessage]);

    setMessagesForSession((prev) => [...prev, nextUserMessage]);
    setInputValue("");
    setIsLoading(true);

    try {
      const { data, error } = await runAnalysis(trimmedMessage, requestHistory);
      if (error) throw new Error(error);
      appendAssistant(data?.response || "No analysis available.");
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Please try again.";
      if (errorMessage.includes("API key")) {
        toast.error("Check Gemini API key configuration.");
      } else if (errorMessage.toLowerCase().includes("quota")) {
        toast.error("Gemini API quota exceeded.");
      } else {
        toast.error(errorMessage);
      }
      appendAssistant(`## Request failed\n\n${errorMessage}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSendMessage(inputValue);
    }
  };

  const shell = (
    <div
      className={cn(
        "flex h-full min-h-[520px] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-[#f7f7f8] shadow-xl dark:border-slate-800 dark:bg-[#0d0d0d]",
        className
      )}
    >
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200/80 bg-white px-4 py-3 dark:border-slate-800 dark:bg-[#171717]">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 shrink-0 text-[#163a70]" />
            <h2 className="truncate text-sm font-semibold text-slate-900 dark:text-white">{title}</h2>
          </div>
          <p className="truncate text-xs text-slate-500 dark:text-slate-400">{scopeLabel}</p>
        </div>
        {onClose && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="h-8 w-8 shrink-0 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </header>

      {submissions.length === 0 ? (
        <div className="flex flex-1 items-center justify-center p-8 text-center text-sm text-slate-500">
          Select a submission to start AI analysis.
        </div>
      ) : (
        <>
          <div ref={messagesContainerRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            <div className="mx-auto w-full max-w-3xl space-y-6 px-4 py-6">
              {messages.map((message, index) => (
                <ChatBubble
                  key={message.id}
                  type={message.type}
                  content={message.content}
                  isLatest={index === messages.length - 1 && !isLoading}
                />
              ))}
              {isLoading && <ChatThinking />}
            </div>
          </div>

          <footer className="shrink-0 border-t border-slate-200/80 bg-white px-4 py-3 dark:border-slate-800 dark:bg-[#171717]">
            <div className="mx-auto w-full max-w-3xl space-y-2">
              {!isLoading && (
                <div className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  {QUICK_PROMPTS.map((prompt) => (
                    <button
                      key={prompt}
                      type="button"
                      disabled={isLoading}
                      onClick={() => void handleSendMessage(prompt)}
                      className="shrink-0 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:border-[#163a70]/30 hover:bg-blue-50 hover:text-[#163a70] disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              )}

              <div className="flex items-end gap-2 rounded-2xl border border-slate-200 bg-[#f7f7f8] px-3 py-2 shadow-sm focus-within:border-[#163a70]/40 focus-within:ring-2 focus-within:ring-[#163a70]/10 dark:border-slate-700 dark:bg-[#212121]">
                <Textarea
                  ref={inputRef}
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask about causes, tables, charts, or recommendations…"
                  disabled={isLoading}
                  rows={1}
                  className="max-h-32 min-h-[40px] flex-1 resize-none border-0 bg-transparent px-1 py-2 text-sm leading-6 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
                />
                <Button
                  size="icon"
                  onClick={() => void handleSendMessage(inputValue)}
                  disabled={!inputValue.trim() || isLoading}
                  className="h-9 w-9 shrink-0 rounded-xl bg-[#163a70] text-white hover:bg-[#102a5c]"
                >
                  {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          </footer>
        </>
      )}
    </div>
  );

  if (!isOpen && !isPanel) return null;
  if (isPanel) return shell;
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3 backdrop-blur-sm sm:p-5">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 12 }}
        transition={{ duration: 0.2 }}
        className="h-[min(92dvh,900px)] w-full max-w-5xl"
      >
        {shell}
      </motion.div>
    </div>
  );
};

export default AccidentChat;

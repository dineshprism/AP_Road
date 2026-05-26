import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { BarChart3, Brain, FileText, LineChart, Loader2, Send, Sparkles, Table2, X } from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ChatBubble } from "@/components/ai-chat/ChatBubble";

interface Message {
  id: string;
  type: "user" | "assistant";
  content: string;
  timestamp: Date;
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

const examplePrompts = [
  {
    icon: FileText,
    label: "Analytical report",
    prompt: "Create an officer-ready analytical report with executive summary, causes, risk signals, and recommendations.",
  },
  {
    icon: Table2,
    label: "Table view",
    prompt: "Show the accident facts and recommended interventions as a markdown table.",
  },
  {
    icon: BarChart3,
    label: "KPI cards",
    prompt: "Summarize key statistics, severity, priority level, and action owners as KPI cards and bullet insights.",
  },
  {
    icon: LineChart,
    label: "Chart-ready JSON",
    prompt: "Return structured JSON with stats, insights, a table array, and a bar chart spec for the main risk categories.",
  },
];

const createMessage = (type: Message["type"], content: string): Message => ({
  id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  type,
  content,
  timestamp: new Date(),
});

const buildHistory = (historyMessages: Message[]): ChatHistoryItem[] =>
  historyMessages
    .filter((message) => message.content.trim().length > 0)
    .slice(-6)
    .map((message) => ({
      role: message.type,
      content: message.content,
    }));

const AccidentChat: React.FC<AccidentChatProps> = ({
  isOpen,
  onClose,
  submissions,
  title = "Accident Analysis",
  variant = "modal",
  className,
}) => {
  const [sessionMessages, setSessionMessages] = useState<Record<string, Message[]>>({});
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const streamTimerRef = useRef<number | null>(null);
  const sessionKey = useMemo(
    () => submissions.map((submission) => submission.id).sort().join("|"),
    [submissions]
  );
  const messages = useMemo(() => sessionMessages[sessionKey] || [], [sessionKey, sessionMessages]);
  const isPanel = variant === "panel";

  const setMessagesForSession = useCallback((updater: Message[] | ((prev: Message[]) => Message[])) => {
    setSessionMessages((prev) => {
      const currentMessages = prev[sessionKey] || [];
      const nextMessages = typeof updater === "function"
        ? (updater as (prev: Message[]) => Message[])(currentMessages)
        : updater;

      return {
        ...prev,
        [sessionKey]: nextMessages,
      };
    });
  }, [sessionKey]);

  const typeAssistantResponse = useCallback((content: string) => {
    if (streamTimerRef.current) {
      window.clearInterval(streamTimerRef.current);
      streamTimerRef.current = null;
    }

    const assistantMessage = createMessage("assistant", "");
    const chunkSize = Math.max(10, Math.ceil(content.length / 90));
    let cursor = 0;

    setIsTyping(true);
    setMessagesForSession((prev) => [...prev, assistantMessage]);

    streamTimerRef.current = window.setInterval(() => {
      cursor = Math.min(content.length, cursor + chunkSize);
      setMessagesForSession((prev) =>
        prev.map((message) =>
          message.id === assistantMessage.id
            ? { ...message, content: content.slice(0, cursor) }
            : message
        )
      );

      if (cursor >= content.length) {
        if (streamTimerRef.current) {
          window.clearInterval(streamTimerRef.current);
          streamTimerRef.current = null;
        }
        setIsTyping(false);
      }
    }, 18);
  }, [setMessagesForSession]);

  const runAnalysis = useCallback(async (question?: string, history?: ChatHistoryItem[]) => {
    if (submissions.length === 1) {
      return api.rag.analyze({ submissionId: submissions[0].id, question, history });
    }

    return api.rag.batchAnalyze({
      submissionIds: submissions.map((submission) => submission.id),
      question,
      history,
    });
  }, [submissions]);

  useEffect(() => () => {
    if (streamTimerRef.current) {
      window.clearInterval(streamTimerRef.current);
    }
  }, []);

  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;

    container.scrollTo({
      top: container.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, isLoading, isTyping]);

  useEffect(() => {
    if (isOpen && submissions.length > 0 && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen, submissions.length, sessionKey]);

  useEffect(() => {
    if (!isOpen || submissions.length === 0 || messages.length > 0 || isLoading || isTyping) {
      return;
    }

    const handleInitialAnalysis = async () => {
      setMessagesForSession([]);
      setIsLoading(true);

      try {
        const defaultQuestion = submissions.length === 1
          ? "Provide a premium markdown accident analysis with executive summary, KPI table, key causes, risk alerts, and action points."
          : "Provide a premium markdown pattern analysis with summary, comparison table, recurring causes, priority locations, and action points.";
        const { data, error } = await runAnalysis(defaultQuestion);

        if (error) {
          throw new Error(error);
        }

        typeAssistantResponse(data?.response || "No analysis was returned for this submission.");
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Unknown error";
        console.error("Initial analysis error:", err);
        typeAssistantResponse(`## Analysis unavailable\n\n> I couldn't complete the initial analysis. ${message}`);
        toast.error(`Failed to analyze submission: ${message}`);
      } finally {
        setIsLoading(false);
      }
    };

    handleInitialAnalysis();
  }, [isOpen, submissions, sessionKey, messages.length, isLoading, isTyping, runAnalysis, setMessagesForSession, typeAssistantResponse]);

  const handleSendMessage = async (message: string) => {
    if (!message.trim() || isLoading || isTyping || submissions.length === 0) return;

    const trimmedMessage = message.trim();
    const nextUserMessage = createMessage("user", trimmedMessage);
    const requestHistory = buildHistory([...messages, nextUserMessage]);

    setMessagesForSession((prev) => [...prev, nextUserMessage]);
    setInputValue("");
    setIsLoading(true);

    try {
      const { data, error } = await runAnalysis(trimmedMessage, requestHistory);

      if (error) {
        throw new Error(error);
      }

      typeAssistantResponse(data?.response || "No analysis available");
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Please try again.";
      console.error("Chat error:", err);

      if (errorMessage.includes("API key")) {
        toast.error("Please check your Gemini API key configuration.");
      } else if (errorMessage.toLowerCase().includes("quota")) {
        toast.error("Gemini API quota exceeded. Please check your billing.");
      } else {
        toast.error(`Failed to get analysis: ${errorMessage}`);
      }

      typeAssistantResponse(`## Request failed\n\n> I couldn't complete that request. ${errorMessage}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage(inputValue);
    }
  };

  const shell = (
    <Card
      className={cn(
        "flex h-full min-h-[560px] flex-col overflow-hidden border border-white/70 bg-white/86 shadow-2xl backdrop-blur-xl dark:border-white/10 dark:bg-slate-950/90",
        isPanel && "rounded-2xl shadow-[0_24px_80px_-42px_rgba(15,23,42,0.55)]",
        className
      )}
    >
      <CardHeader className="relative overflow-hidden border-b border-slate-200/80 bg-gradient-to-r from-slate-950 via-[#102a5c] to-blue-700 px-4 py-4 text-white dark:border-white/10">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.18),transparent_28%),radial-gradient(circle_at_80%_0%,rgba(34,211,238,0.24),transparent_30%)]" />
        <div className="relative flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/20 bg-white/12 text-white shadow-lg backdrop-blur">
              <Sparkles className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <CardTitle className="truncate text-base font-bold tracking-tight sm:text-lg">{title}</CardTitle>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-blue-100">
                <span className="inline-flex items-center gap-1.5">
                  <Brain className="h-3.5 w-3.5" />
                  Enterprise AI analyst
                </span>
                <Badge className="border-white/20 bg-white/12 text-white hover:bg-white/16">
                  {submissions.length} {submissions.length === 1 ? "submission" : "submissions"}
                </Badge>
              </div>
            </div>
          </div>
          {onClose && (
            <Button variant="ghost" size="icon" onClick={onClose} className="h-9 w-9 rounded-full text-white/80 hover:bg-white/10 hover:text-white">
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="relative flex min-h-0 flex-1 flex-col overflow-hidden bg-[linear-gradient(135deg,#f8fafc_0%,#eff6ff_52%,#fff7ed_100%)] p-0 dark:bg-[linear-gradient(135deg,#020617_0%,#0f172a_55%,#111827_100%)]">
        {submissions.length === 0 ? (
          <div className="flex flex-1 items-center justify-center p-8">
            <div className="max-w-md text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary dark:bg-blue-400/10 dark:text-blue-300">
                <Brain className="h-7 w-7" />
              </div>
              <h3 className="text-xl font-semibold text-slate-900 dark:text-white">Open a submission to start chatting</h3>
              <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">
                Click Analyse on any submission, or select multiple submissions and use batch analysis.
              </p>
            </div>
          </div>
        ) : (
          <>
            <div ref={messagesContainerRef} className="min-h-0 flex-1 overflow-y-auto px-3 py-4 sm:px-5">
              <div className="mx-auto flex w-full max-w-5xl flex-col gap-4">
                {messages.length === 0 && !isLoading && (
                  <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="grid gap-3 sm:grid-cols-2">
                    {examplePrompts.map((example) => (
                      <button
                        key={example.label}
                        type="button"
                        onClick={() => handleSendMessage(example.prompt)}
                        className="rounded-2xl border border-white/70 bg-white/80 p-4 text-left shadow-sm backdrop-blur transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-lg dark:border-white/10 dark:bg-slate-950/70 dark:hover:border-blue-700"
                      >
                        <example.icon className="mb-3 h-5 w-5 text-blue-700 dark:text-blue-300" />
                        <p className="font-bold text-slate-950 dark:text-white">{example.label}</p>
                        <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">{example.prompt}</p>
                      </button>
                    ))}
                  </motion.div>
                )}

                <AnimatePresence initial={false}>
                  {messages.map((message) => (
                    <ChatBubble
                      key={message.id}
                      type={message.type}
                      content={message.content || " "}
                      timestamp={message.timestamp}
                    />
                  ))}
                </AnimatePresence>

                {isLoading && (
                  <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex items-end gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-blue-700 to-cyan-600 text-white">
                      <Sparkles className="h-4 w-4" />
                    </div>
                    <div className="w-full max-w-xl rounded-2xl rounded-bl-md border border-white/70 bg-white/85 p-4 shadow-sm backdrop-blur dark:border-white/10 dark:bg-slate-950/80">
                      <div className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
                        <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                        Building analysis
                      </div>
                      <div className="mt-4 space-y-2">
                        <div className="h-3 w-5/6 animate-pulse rounded-full bg-slate-200 dark:bg-slate-800" />
                        <div className="h-3 w-2/3 animate-pulse rounded-full bg-slate-200 dark:bg-slate-800" />
                        <div className="h-3 w-4/5 animate-pulse rounded-full bg-slate-200 dark:bg-slate-800" />
                      </div>
                    </div>
                  </motion.div>
                )}
              </div>
            </div>

            <div className="border-t border-white/70 bg-white/82 px-3 py-3 shadow-[0_-18px_60px_-48px_rgba(15,23,42,0.55)] backdrop-blur-xl dark:border-white/10 dark:bg-slate-950/82 sm:px-5">
              <div className="mx-auto w-full max-w-5xl">
                <div className="rounded-2xl border border-slate-200 bg-white px-3 py-2 shadow-sm transition focus-within:border-blue-300 focus-within:shadow-lg dark:border-slate-800 dark:bg-slate-950">
                  <div className="flex items-end gap-2">
                    <Textarea
                      ref={inputRef}
                      value={inputValue}
                      onChange={(e) => setInputValue(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder="Ask for causes, charts, JSON, action plans, executive summary, or table comparison..."
                      disabled={isLoading || isTyping}
                      rows={1}
                      className="max-h-32 min-h-10 resize-none border-0 bg-transparent px-1 py-2 text-sm leading-6 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
                    />
                    <Button
                      onClick={() => handleSendMessage(inputValue)}
                      disabled={!inputValue.trim() || isLoading || isTyping}
                      className="h-10 shrink-0 rounded-full bg-gradient-to-r from-[#102a5c] to-blue-700 px-4 text-white shadow-lg shadow-blue-950/20 hover:from-[#163a70] hover:to-blue-600"
                    >
                      <Send className="mr-2 h-4 w-4" />
                      Send
                    </Button>
                  </div>
                </div>
                <p className="mt-2 px-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
                  Enter to send. Shift + Enter for a new line. Responses support markdown, tables, code, charts, and structured JSON.
                </p>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );

  if (!isOpen && !isPanel) {
    return null;
  }

  if (isPanel) {
    return shell;
  }

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-3 backdrop-blur-md sm:p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.98, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.98, y: 12 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
        className="h-[92dvh] w-[96vw] md:h-[88vh] md:w-[88vw]"
      >
        {shell}
      </motion.div>
    </div>
  );
};

export default AccidentChat;

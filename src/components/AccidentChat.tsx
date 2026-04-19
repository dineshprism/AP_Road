import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Bot, Brain, Clock3, MapPin, Send, Sparkles, User, X } from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';

interface Message {
  id: string;
  type: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface ChatHistoryItem {
  role: 'user' | 'assistant';
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
  variant?: 'modal' | 'panel';
  className?: string;
}

const suggestedQuestions = [
  'What are the main causes of these accidents?',
  'What preventive measures would you recommend?',
  'Are there any patterns in these accidents?',
  'What infrastructure improvements are needed?',
  'How can similar accidents be prevented?'
];

const formatInlineContent = (text: string, isUserMessage = false) => {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);

  return parts.map((part, index) => {
    const match = part.match(/^\*\*([^*]+)\*\*$/);
    if (match) {
      return (
        <strong
          key={`${part}-${index}`}
          className={cn("font-semibold", isUserMessage ? "text-white" : "text-slate-900")}
        >
          {match[1]}
        </strong>
      );
    }

    return <React.Fragment key={`${part}-${index}`}>{part}</React.Fragment>;
  });
};

const renderMessageContent = (content: string, isUserMessage = false) => {
  const blocks = content
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter(Boolean);

  return blocks.map((block, blockIndex) => {
    const lines = block.split('\n').map((line) => line.trim()).filter(Boolean);
    const bulletLines = lines.filter((line) => /^(\*|-)\s+/.test(line));
    const orderedLines = lines.filter((line) => /^\d+\.\s+/.test(line));

    if (bulletLines.length === lines.length) {
      return (
        <ul key={`block-${blockIndex}`} className="space-y-2 pl-5">
          {lines.map((line, index) => (
            <li
              key={`item-${blockIndex}-${index}`}
              className={cn("list-disc text-[15px] leading-7", isUserMessage ? "text-white" : "text-slate-700")}
            >
              {formatInlineContent(line.replace(/^(\*|-)\s+/, ''), isUserMessage)}
            </li>
          ))}
        </ul>
      );
    }

    if (orderedLines.length === lines.length) {
      return (
        <ol key={`block-${blockIndex}`} className="space-y-2 pl-5">
          {lines.map((line, index) => (
            <li
              key={`item-${blockIndex}-${index}`}
              className={cn("list-decimal text-[15px] leading-7", isUserMessage ? "text-white" : "text-slate-700")}
            >
              {formatInlineContent(line.replace(/^\d+\.\s+/, ''), isUserMessage)}
            </li>
          ))}
        </ol>
      );
    }

    return (
      <p key={`block-${blockIndex}`} className={cn("text-[15px] leading-7", isUserMessage ? "text-white" : "text-slate-700")}>
        {formatInlineContent(block, isUserMessage)}
      </p>
    );
  });
};

const AccidentChat: React.FC<AccidentChatProps> = ({
  isOpen,
  onClose,
  submissions,
  title = 'Accident Analysis',
  variant = 'modal',
  className,
}) => {
  const [sessionMessages, setSessionMessages] = useState<Record<string, Message[]>>({});
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const sessionKey = useMemo(
    () => submissions.map((submission) => submission.id).sort().join('|'),
    [submissions]
  );
  const messages = useMemo(() => sessionMessages[sessionKey] || [], [sessionKey, sessionMessages]);
  const isPanel = variant === 'panel';
  const hasUserMessages = messages.some((message) => message.type === 'user');
  const visibleSuggestedQuestions = suggestedQuestions.slice(0, 4);
  const districtCount = useMemo(
    () => new Set(submissions.map((submission) => submission.district).filter(Boolean)).size,
    [submissions]
  );
  const locationCount = useMemo(
    () =>
      new Set(
        submissions
          .map((submission) => submission.place_of_accident || submission.mandal || submission.district)
          .filter(Boolean)
      ).size,
    [submissions]
  );
  const scopePreview = useMemo(
    () =>
      submissions
        .slice(0, 3)
        .map((submission) => submission.place_of_accident || submission.mandal || submission.district),
    [submissions]
  );

  const setMessagesForSession = useCallback((updater: Message[] | ((prev: Message[]) => Message[])) => {
    setSessionMessages((prev) => {
      const currentMessages = prev[sessionKey] || [];
      const nextMessages = typeof updater === 'function'
        ? (updater as (prev: Message[]) => Message[])(currentMessages)
        : updater;

      return {
        ...prev,
        [sessionKey]: nextMessages,
      };
    });
  }, [sessionKey]);

  const createMessage = (type: Message['type'], content: string): Message => ({
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type,
    content,
    timestamp: new Date(),
  });

  const buildHistory = (historyMessages: Message[]): ChatHistoryItem[] =>
    historyMessages
      .slice(-6)
      .map((message) => ({
        role: message.type,
        content: message.content,
      }));

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

  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;

    container.scrollTo({
      top: container.scrollHeight,
      behavior: 'smooth',
    });
  }, [messages, isLoading]);

  useEffect(() => {
    if (isOpen && submissions.length > 0 && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen, submissions.length, sessionKey]);

  useEffect(() => {
    if (!isOpen || submissions.length === 0 || messages.length > 0 || isLoading) {
      return;
    }

    const handleInitialAnalysis = async () => {
      const intro = submissions.length > 1
        ? `I'm preparing an initial analysis for ${submissions.length} accident submissions.\n\nSelected submissions:\n${submissions
            .map((submission) => `- FIR ${submission.fir_number} at ${submission.place_of_accident || submission.district}, ${submission.district}`)
            .join('\n')}`
        : `I'm preparing an initial analysis for FIR ${submissions[0]?.fir_number} at ${submissions[0]?.place_of_accident || submissions[0]?.district}, ${submissions[0]?.district}.`;

      setMessagesForSession([createMessage('assistant', intro)]);
      setIsLoading(true);

      try {
        const defaultQuestion = submissions.length === 1
          ? 'Please analyze this accident and provide the main causes, contributing factors, investigation observations, and preventive recommendations.'
          : 'Please analyze these accidents and identify the key patterns, recurring causes, and preventive recommendations across the selected submissions.';
        const { data, error } = await runAnalysis(defaultQuestion);

        if (error) {
          throw new Error(error);
        }

        setMessagesForSession((prev) => [
          ...prev,
          createMessage('assistant', data?.response || 'No analysis was returned for this submission.'),
        ]);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        console.error('Initial analysis error:', err);
        setMessagesForSession((prev) => [
          ...prev,
          createMessage('assistant', `I couldn't complete the initial analysis. ${message}`),
        ]);
        toast.error(`Failed to analyze submission: ${message}`);
      } finally {
        setIsLoading(false);
      }
    };

    handleInitialAnalysis();
  }, [isOpen, submissions, sessionKey, messages.length, isLoading, runAnalysis, setMessagesForSession]);

  const handleSendMessage = async (message: string) => {
    if (!message.trim() || isLoading || submissions.length === 0) return;

    const trimmedMessage = message.trim();
    const nextUserMessage = createMessage('user', trimmedMessage);
    const requestHistory = buildHistory([...messages, nextUserMessage]);

    setMessagesForSession((prev) => [...prev, nextUserMessage]);
    setInputValue('');
    setIsLoading(true);

    try {
      const { data, error } = await runAnalysis(trimmedMessage, requestHistory);

      if (error) {
        throw new Error(error);
      }

      setMessagesForSession((prev) => [
        ...prev,
        createMessage('assistant', data?.response || 'No analysis available'),
      ]);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Please try again.';
      console.error('Chat error:', err);

      if (errorMessage.includes('API key')) {
        toast.error('Please check your Gemini API key configuration.');
      } else if (errorMessage.toLowerCase().includes('quota')) {
        toast.error('Gemini API quota exceeded. Please check your billing.');
      } else {
        toast.error(`Failed to get analysis: ${errorMessage}`);
      }

      setMessagesForSession((prev) => [
        ...prev,
        createMessage('assistant', `I couldn't complete that request. ${errorMessage}`),
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage(inputValue);
    }
  };

  const shell = (
    <Card
      className={cn(
        'analytics-liquid-panel analytics-sheen flex h-full min-h-[640px] flex-col overflow-hidden border-0 bg-white/80',
        isPanel && 'rounded-[30px] border border-white/65 shadow-[0_28px_90px_-36px_rgba(15,23,42,0.48)]',
        !isPanel && 'shadow-2xl',
        className
      )}
    >
      <CardHeader className="relative overflow-hidden border-b border-white/70 bg-[linear-gradient(135deg,rgba(10,33,71,0.98)_0%,rgba(22,58,112,0.94)_52%,rgba(31,138,112,0.9)_100%)] px-4 py-4 text-white">
        <div className="pointer-events-none absolute -left-12 top-0 h-32 w-32 rounded-full bg-white/10 blur-3xl" />
        <div className="pointer-events-none absolute bottom-0 right-0 h-28 w-28 rounded-full bg-[#f5a623]/20 blur-3xl" />
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-white/12 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.18)] backdrop-blur">
                <Sparkles className="h-4.5 w-4.5" />
              </span>
              <div>
                <CardTitle className="analytics-display-font text-lg text-white">{title}</CardTitle>
                <p className="mt-1 text-xs font-medium uppercase tracking-[0.22em] text-white/65">
                  {submissions.length > 1 ? 'Cluster conversation studio' : 'Single-case conversation studio'}
                </p>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Badge variant="outline" className="rounded-full border-white/20 bg-white/12 px-3 py-1 text-white backdrop-blur">
                <Brain className="mr-1 h-3.5 w-3.5 text-white" />
                {submissions.length} {submissions.length === 1 ? 'submission' : 'submissions'}
              </Badge>
              <Badge variant="outline" className="rounded-full border-white/20 bg-white/12 px-3 py-1 text-white/90 backdrop-blur">
                <MapPin className="mr-1 h-3.5 w-3.5 text-white" />
                {districtCount} {districtCount === 1 ? 'district' : 'districts'}
              </Badge>
              <Badge variant="outline" className="rounded-full border-white/20 bg-white/12 px-3 py-1 text-white/90 backdrop-blur">
                <Clock3 className="mr-1 h-3.5 w-3.5 text-white" />
                Live narrative + follow-ups
              </Badge>
            </div>
          </div>
          {onClose && (
            <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full text-white/80 hover:bg-white/10 hover:text-white">
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="relative flex min-h-0 flex-1 flex-col overflow-hidden bg-[radial-gradient(circle_at_top,rgba(59,130,246,0.10),transparent_30%),radial-gradient(circle_at_right,rgba(245,158,11,0.10),transparent_26%),linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(246,249,254,0.98)_100%)] p-0">
        <div className="analytics-grid-floor pointer-events-none absolute inset-0 opacity-70" />
        {submissions.length === 0 ? (
          <div className="flex flex-1 items-center justify-center p-8">
            <div className="max-w-md text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary shadow-[0_18px_36px_-24px_rgba(22,58,112,0.6)]">
                <Brain className="h-7 w-7" />
              </div>
              <h3 className="text-xl font-semibold text-slate-900">Open a submission to start chatting</h3>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                Click <span className="font-medium text-slate-700">Analyse</span> on any submission, or select multiple submissions and use batch analysis.
              </p>
            </div>
          </div>
        ) : (
          <>
            <div className="border-b border-white/70 bg-white/50 px-3 py-3 backdrop-blur sm:px-4">
              <div className="mx-auto grid w-full max-w-5xl gap-3 md:grid-cols-3">
                <div className="rounded-[24px] border border-white/80 bg-white/82 px-4 py-3 shadow-[0_20px_55px_-36px_rgba(15,23,42,0.35)] backdrop-blur">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Conversation Focus</p>
                  <p className="analytics-display-font mt-2 text-lg font-semibold text-slate-900">
                    {submissions.length > 1 ? 'Pattern synthesis' : 'Case deconstruction'}
                  </p>
                  <p className="mt-1 text-sm text-slate-600">Designed for causes, interventions, escalation points, and review notes.</p>
                </div>
                <div className="rounded-[24px] border border-white/80 bg-white/82 px-4 py-3 shadow-[0_20px_55px_-36px_rgba(15,23,42,0.35)] backdrop-blur">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Coverage Window</p>
                  <p className="analytics-display-font mt-2 text-lg font-semibold text-slate-900">
                    {locationCount} {locationCount === 1 ? 'location' : 'locations'}
                  </p>
                  <p className="mt-1 text-sm text-slate-600">
                    {scopePreview.length > 0 ? scopePreview.join(' • ') : 'Current analytics scope'}
                  </p>
                </div>
                <div className="rounded-[24px] border border-white/80 bg-white/82 px-4 py-3 shadow-[0_20px_55px_-36px_rgba(15,23,42,0.35)] backdrop-blur">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Review Rhythm</p>
                  <p className="analytics-display-font mt-2 text-lg font-semibold text-slate-900">
                    {messages.length > 0 ? `${messages.length} turns` : 'Auto-briefing ready'}
                  </p>
                  <p className="mt-1 text-sm text-slate-600">Use short prompts for faster DIG-ready talking points and deeper follow-ups when needed.</p>
                </div>
              </div>
            </div>

            <div ref={messagesContainerRef} className="min-h-0 flex-1 overflow-y-auto px-3 py-4 sm:px-4">
              <div className="mx-auto flex w-full max-w-4xl flex-col gap-4">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={cn('flex items-end gap-3', message.type === 'user' ? 'justify-end' : 'justify-start')}
                  >
                    {message.type === 'assistant' && (
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#163a70_0%,#2b5c8f_100%)] text-white shadow-[0_20px_45px_-24px_rgba(22,58,112,0.75)]">
                        <Bot className="h-4 w-4" />
                      </div>
                    )}
                    <div
                      className={cn(
                        'max-w-[min(100%,52rem)] rounded-[24px] px-4 py-3 shadow-sm backdrop-blur',
                        message.type === 'user'
                          ? 'rounded-br-md bg-[linear-gradient(135deg,#163a70_0%,#2b5c8f_100%)] text-primary-foreground shadow-[0_20px_50px_-30px_rgba(22,58,112,0.85)]'
                          : 'analytics-liquid-panel rounded-bl-md border border-white/80 bg-white/82 text-slate-800 shadow-[0_24px_64px_-40px_rgba(15,23,42,0.42)]'
                      )}
                    >
                      <div className="space-y-3 break-words">
                        {renderMessageContent(message.content, message.type === 'user')}
                      </div>
                      <p className={cn('mt-2 text-[11px]', message.type === 'user' ? 'text-primary-foreground/70' : 'text-slate-400')}>
                        {message.timestamp.toLocaleTimeString()}
                      </p>
                    </div>
                    {message.type === 'user' && (
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-slate-900 text-white shadow-[0_20px_40px_-30px_rgba(15,23,42,0.85)]">
                        <User className="h-4 w-4" />
                      </div>
                    )}
                  </div>
                ))}

                {isLoading && (
                  <div className="flex items-end gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#163a70_0%,#2b5c8f_100%)] text-white shadow-[0_20px_45px_-24px_rgba(22,58,112,0.75)]">
                      <Bot className="h-4 w-4" />
                    </div>
                    <div className="analytics-liquid-panel rounded-[24px] rounded-bl-md border border-white/80 bg-white/82 px-4 py-3 shadow-[0_24px_64px_-40px_rgba(15,23,42,0.42)]">
                      <div className="flex items-center gap-2">
                        <div className="h-2.5 w-2.5 animate-bounce rounded-full bg-blue-600" />
                        <div className="h-2.5 w-2.5 animate-bounce rounded-full bg-blue-500 [animation-delay:120ms]" />
                        <div className="h-2.5 w-2.5 animate-bounce rounded-full bg-amber-500 [animation-delay:240ms]" />
                      </div>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            </div>

            {!hasUserMessages && messages.length <= 2 && !isLoading && (
              <div className="border-t border-white/70 bg-white/68 px-3 py-3 backdrop-blur sm:px-4">
                <div className="mx-auto w-full max-w-4xl">
                  <div className="flex items-center gap-3 overflow-x-auto pb-1">
                    <p className="shrink-0 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                      Quick prompts
                    </p>
                    {visibleSuggestedQuestions.map((question) => (
                      <Button
                        key={question}
                        variant="outline"
                        size="sm"
                        onClick={() => handleSendMessage(question)}
                        className="h-9 shrink-0 rounded-full border-white/80 bg-white/82 px-4 text-xs text-slate-700 shadow-[0_18px_40px_-32px_rgba(15,23,42,0.35)] backdrop-blur hover:bg-white"
                      >
                        {question}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <div className="border-t border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.68)_0%,rgba(244,248,253,0.96)_100%)] px-3 py-3 sm:px-4">
              <div className="mx-auto w-full max-w-4xl">
                <div className="rounded-[28px] border border-white/80 bg-white/82 p-3 shadow-[0_30px_80px_-48px_rgba(15,23,42,0.45)] backdrop-blur-xl">
                  <div className="flex flex-col gap-3">
                    <Textarea
                      ref={inputRef}
                      value={inputValue}
                      onChange={(e) => setInputValue(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder="Ask for causes, hotspot patterns, engineering issues, preventive actions, or DIG-ready talking points..."
                      disabled={isLoading}
                      rows={3}
                      className="min-h-[92px] resize-none border-0 bg-transparent px-2 py-2 text-sm leading-7 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
                    />
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <p className="text-xs leading-5 text-slate-500">
                        Press <span className="font-semibold text-slate-700">Enter</span> to send and <span className="font-semibold text-slate-700">Shift + Enter</span> for a new line.
                      </p>
                      <Button
                        onClick={() => handleSendMessage(inputValue)}
                        disabled={!inputValue.trim() || isLoading}
                        className="h-11 rounded-full bg-[linear-gradient(135deg,#163a70_0%,#2b5c8f_100%)] px-5 text-white shadow-[0_22px_44px_-26px_rgba(22,58,112,0.82)] hover:opacity-95"
                      >
                        <Send className="mr-2 h-4 w-4" />
                        Send to AI Analyst
                      </Button>
                    </div>
                  </div>
                </div>
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm">
      <div className="h-[85vh] w-full max-w-6xl">
        {shell}
      </div>
    </div>
  );
};

export default AccidentChat;

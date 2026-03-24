import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Bot, Brain, Send, Sparkles, User, X } from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

interface Message {
  id: string;
  type: 'user' | 'assistant';
  content: string;
  timestamp: Date;
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
  const inputRef = useRef<HTMLInputElement>(null);
  const sessionKey = useMemo(
    () => submissions.map((submission) => submission.id).sort().join('|'),
    [submissions]
  );
  const messages = sessionMessages[sessionKey] || [];
  const isPanel = variant === 'panel';
  const hasUserMessages = messages.some((message) => message.type === 'user');

  const setMessagesForSession = (updater: Message[] | ((prev: Message[]) => Message[])) => {
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
  };

  const createMessage = (type: Message['type'], content: string): Message => ({
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type,
    content,
    timestamp: new Date(),
  });

  const runAnalysis = async (question?: string) => {
    if (submissions.length === 1) {
      return api.rag.analyze({ submissionId: submissions[0].id, question });
    }

    return api.rag.batchAnalyze({
      submissionIds: submissions.map((submission) => submission.id),
      question,
    });
  };

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
      } catch (err: any) {
        const message = err?.message || 'Unknown error';
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
  }, [isOpen, submissions, sessionKey, messages.length, isLoading]);

  const handleSendMessage = async (message: string) => {
    if (!message.trim() || isLoading || submissions.length === 0) return;

    setMessagesForSession((prev) => [...prev, createMessage('user', message)]);
    setInputValue('');
    setIsLoading(true);

    try {
      const { data, error } = await runAnalysis(message);

      if (error) {
        throw new Error(error);
      }

      setMessagesForSession((prev) => [
        ...prev,
        createMessage('assistant', data?.response || 'No analysis available'),
      ]);
    } catch (err: any) {
      const errorMessage = err?.message || 'Please try again.';
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

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage(inputValue);
    }
  };

  const shell = (
    <Card
      className={cn(
        'flex h-full min-h-[560px] flex-col overflow-hidden border-0 bg-white',
        isPanel && 'rounded-[28px] border border-slate-200/80 shadow-[0_20px_60px_-24px_rgba(15,23,42,0.35)]',
        !isPanel && 'shadow-2xl',
        className
      )}
    >
      <CardHeader className="border-b border-slate-200 bg-[linear-gradient(135deg,#f8fbff_0%,#eef4ff_52%,#fff8ef_100%)] px-4 py-3">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <Sparkles className="h-4.5 w-4.5" />
              </span>
              <div>
                <CardTitle className="text-base text-slate-900">{title}</CardTitle>
              </div>
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              <Badge variant="outline" className="rounded-full border-blue-200 bg-white/80 px-3 py-1 text-slate-700">
                <Brain className="mr-1 h-3.5 w-3.5 text-blue-600" />
                {submissions.length} {submissions.length === 1 ? 'submission' : 'submissions'}
              </Badge>
            </div>
          </div>
          {onClose && (
            <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full text-slate-500 hover:bg-white">
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="flex min-h-0 flex-1 flex-col bg-[radial-gradient(circle_at_top,#f8fbff,transparent_38%),linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] p-0">
        {submissions.length === 0 ? (
          <div className="flex flex-1 items-center justify-center p-8">
            <div className="max-w-md text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
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
            <div ref={messagesContainerRef} className="min-h-0 flex-1 overflow-y-auto px-3 py-3 sm:px-4">
              <div className="mx-auto flex w-full max-w-3xl flex-col gap-3">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={cn('flex items-end gap-3', message.type === 'user' ? 'justify-end' : 'justify-start')}
                  >
                    {message.type === 'assistant' && (
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-primary text-white shadow-sm">
                        <Bot className="h-4 w-4" />
                      </div>
                    )}
                    <div
                      className={cn(
                        'max-w-[min(100%,46rem)] rounded-[22px] px-4 py-2.5 text-sm leading-6 shadow-sm',
                        message.type === 'user'
                          ? 'rounded-br-md bg-primary text-primary-foreground'
                          : 'rounded-bl-md border border-slate-200 bg-white text-slate-800'
                      )}
                    >
                      <p className="whitespace-pre-wrap break-words">{message.content}</p>
                      <p className={cn('mt-2 text-[11px]', message.type === 'user' ? 'text-primary-foreground/70' : 'text-slate-400')}>
                        {message.timestamp.toLocaleTimeString()}
                      </p>
                    </div>
                    {message.type === 'user' && (
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-slate-900 text-white shadow-sm">
                        <User className="h-4 w-4" />
                      </div>
                    )}
                  </div>
                ))}

                {isLoading && (
                  <div className="flex items-end gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-primary text-white shadow-sm">
                      <Bot className="h-4 w-4" />
                    </div>
                    <div className="rounded-[22px] rounded-bl-md border border-slate-200 bg-white px-4 py-3 shadow-sm">
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
              <div className="border-t border-slate-200 bg-white/90 px-3 py-2.5 backdrop-blur sm:px-4">
                <div className="mx-auto w-full max-w-3xl">
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">
                    Suggested prompts
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {suggestedQuestions.slice(0, 4).map((question) => (
                      <Button
                        key={question}
                        variant="outline"
                        size="sm"
                        onClick={() => handleSendMessage(question)}
                        className="h-auto rounded-full border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-100"
                      >
                        {question}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <div className="border-t border-slate-200 bg-white px-3 py-3 sm:px-4">
              <div className="mx-auto w-full max-w-3xl">
                <div className="rounded-[24px] border border-slate-200 bg-slate-50/80 p-1.5 shadow-inner">
                  <div className="flex items-center gap-2">
                    <Input
                      ref={inputRef}
                      value={inputValue}
                      onChange={(e) => setInputValue(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder="Ask a follow-up about causes, patterns, recommendations, or investigation details..."
                      disabled={isLoading}
                      className="h-11 flex-1 rounded-full border-0 bg-transparent px-4 text-sm shadow-none focus-visible:ring-0"
                    />
                    <Button
                      onClick={() => handleSendMessage(inputValue)}
                      disabled={!inputValue.trim() || isLoading}
                      size="icon"
                      className="h-11 w-11 rounded-full bg-primary text-white hover:bg-primary/90"
                    >
                      <Send className="h-4 w-4" />
                    </Button>
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

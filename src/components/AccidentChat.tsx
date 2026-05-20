import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Bot, Brain, Send, Sparkles, User, X } from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
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

const tableDividerPattern = /^\|\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?$/;

const formatInlineContent = (text: string, isUserMessage = false) => {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);

  return parts.map((part, index) => {
    const match = part.match(/^\*\*([^*]+)\*\*$/);
    if (match) {
      return (
        <strong
          key={`${part}-${index}`}
          className={cn('font-semibold', isUserMessage ? 'text-white' : 'text-slate-950')}
        >
          {match[1]}
        </strong>
      );
    }

    return <React.Fragment key={`${part}-${index}`}>{part}</React.Fragment>;
  });
};

const renderTable = (lines: string[], blockIndex: number, isUserMessage: boolean) => {
  const rows = lines
    .filter((line) => !tableDividerPattern.test(line))
    .map((line) => line.replace(/^\||\|$/g, '').split('|').map((cell) => cell.trim()));
  const [header = [], ...body] = rows;

  if (header.length === 0 || body.length === 0) return null;

  return (
    <div key={`block-${blockIndex}`} className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <table className="w-full border-collapse text-left text-sm">
        <thead className="bg-slate-50 text-xs uppercase text-slate-500">
          <tr>
            {header.map((cell, index) => (
              <th key={`head-${blockIndex}-${index}`} className="border-b border-slate-200 px-3 py-2 font-semibold">
                {formatInlineContent(cell, isUserMessage)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {body.map((row, rowIndex) => (
            <tr key={`row-${blockIndex}-${rowIndex}`} className="border-b border-slate-100 last:border-b-0">
              {row.map((cell, cellIndex) => (
                <td key={`cell-${blockIndex}-${rowIndex}-${cellIndex}`} className="px-3 py-2 align-top text-slate-700">
                  {formatInlineContent(cell, isUserMessage)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const renderMessageContent = (content: string, isUserMessage = false) => {
  const blocks = content
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter(Boolean);

  return blocks.map((block, blockIndex) => {
    const headingMatch = block.match(/^(#{1,4})\s+(.+)$/);
    if (headingMatch) {
      return (
        <h3
          key={`block-${blockIndex}`}
          className={cn('text-[15px] font-bold leading-6', isUserMessage ? 'text-white' : 'text-slate-950')}
        >
          {formatInlineContent(headingMatch[2], isUserMessage)}
        </h3>
      );
    }

    const lines = block.split('\n').map((line) => line.trim()).filter(Boolean);
    const tableLines = lines.filter((line) => /^\|.+\|$/.test(line));
    const bulletLines = lines.filter((line) => /^(\*|-)\s+/.test(line));
    const orderedLines = lines.filter((line) => /^\d+\.\s+/.test(line));

    if (tableLines.length === lines.length && lines.length >= 3) {
      const table = renderTable(lines, blockIndex, isUserMessage);
      if (table) return table;
    }

    if (bulletLines.length === lines.length) {
      return (
        <ul key={`block-${blockIndex}`} className="space-y-2 pl-4">
          {lines.map((line, index) => (
            <li
              key={`item-${blockIndex}-${index}`}
              className={cn('list-disc text-sm leading-6', isUserMessage ? 'text-white' : 'text-slate-700')}
            >
              {formatInlineContent(line.replace(/^(\*|-)\s+/, ''), isUserMessage)}
            </li>
          ))}
        </ul>
      );
    }

    if (orderedLines.length === lines.length) {
      return (
        <ol key={`block-${blockIndex}`} className="space-y-2 pl-4">
          {lines.map((line, index) => (
            <li
              key={`item-${blockIndex}-${index}`}
              className={cn('list-decimal text-sm leading-6', isUserMessage ? 'text-white' : 'text-slate-700')}
            >
              {formatInlineContent(line.replace(/^\d+\.\s+/, ''), isUserMessage)}
            </li>
          ))}
        </ol>
      );
    }

    return (
      <p key={`block-${blockIndex}`} className={cn('text-sm leading-6', isUserMessage ? 'text-white' : 'text-slate-700')}>
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
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const sessionKey = useMemo(
    () => submissions.map((submission) => submission.id).sort().join('|'),
    [submissions]
  );
  const messages = useMemo(() => sessionMessages[sessionKey] || [], [sessionKey, sessionMessages]);
  const isPanel = variant === 'panel';

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
      setMessagesForSession([]);
      setIsLoading(true);

      try {
        const defaultQuestion = submissions.length === 1
          ? 'Provide a professional formatted analysis with executive summary, key causes, risk signals, and action points.'
          : 'Provide a professional formatted analysis with pattern summary, recurring causes, priority locations, and action points.';
        const { data, error } = await runAnalysis(defaultQuestion);

        if (error) {
          throw new Error(error);
        }

        setMessagesForSession([
          createMessage('assistant', data?.response || 'No analysis was returned for this submission.'),
        ]);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        console.error('Initial analysis error:', err);
        setMessagesForSession([
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
        'flex h-full min-h-[520px] flex-col overflow-hidden border border-slate-200 bg-white',
        isPanel && 'rounded-2xl shadow-[0_24px_70px_-42px_rgba(15,23,42,0.45)]',
        !isPanel && 'shadow-2xl',
        className
      )}
    >
      <CardHeader className="border-b border-slate-200 bg-white px-4 py-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#102a5c] text-white">
              <Sparkles className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <CardTitle className="truncate text-base font-semibold text-slate-950">{title}</CardTitle>
              <div className="mt-1 flex items-center gap-2 text-xs text-slate-500">
                <Brain className="h-3.5 w-3.5" />
                <span>{submissions.length} {submissions.length === 1 ? 'submission' : 'submissions'} in analysis</span>
              </div>
            </div>
          </div>
          {onClose && (
            <Button variant="ghost" size="icon" onClick={onClose} className="h-9 w-9 rounded-full text-slate-500 hover:bg-slate-100 hover:text-slate-900">
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="relative flex min-h-0 flex-1 flex-col overflow-hidden bg-slate-50 p-0">
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
            <div ref={messagesContainerRef} className="min-h-0 flex-1 overflow-y-auto px-3 py-4 sm:px-4">
              <div className="mx-auto flex w-full max-w-4xl flex-col gap-4">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={cn('flex items-end gap-3', message.type === 'user' ? 'justify-end' : 'justify-start')}
                  >
                    {message.type === 'assistant' && (
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#102a5c] text-white">
                        <Bot className="h-4 w-4" />
                      </div>
                    )}
                    <div
                      className={cn(
                        'max-w-[min(100%,52rem)] rounded-2xl px-4 py-3 shadow-sm',
                        message.type === 'user'
                          ? 'rounded-br-md bg-[#102a5c] text-primary-foreground'
                          : 'rounded-bl-md border border-slate-200 bg-white text-slate-800'
                      )}
                    >
                      <div className="space-y-3 break-words">
                        {renderMessageContent(message.content, message.type === 'user')}
                      </div>
                      <p className={cn('mt-2 text-[11px]', message.type === 'user' ? 'text-white/70' : 'text-slate-400')}>
                        {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                    {message.type === 'user' && (
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-white">
                        <User className="h-4 w-4" />
                      </div>
                    )}
                  </div>
                ))}

                {isLoading && (
                  <div className="flex items-end gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#102a5c] text-white">
                      <Bot className="h-4 w-4" />
                    </div>
                    <div className="rounded-2xl rounded-bl-md border border-slate-200 bg-white px-4 py-3 shadow-sm">
                      <div className="flex items-center gap-2">
                        <div className="h-2.5 w-2.5 animate-bounce rounded-full bg-blue-700" />
                        <div className="h-2.5 w-2.5 animate-bounce rounded-full bg-blue-600 [animation-delay:120ms]" />
                        <div className="h-2.5 w-2.5 animate-bounce rounded-full bg-amber-500 [animation-delay:240ms]" />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="border-t border-slate-200 bg-white px-3 py-3 sm:px-4">
              <div className="mx-auto w-full max-w-4xl">
                <div className="rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
                  <div className="flex flex-col gap-3">
                    <Textarea
                      ref={inputRef}
                      value={inputValue}
                      onChange={(e) => setInputValue(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder="Ask for causes, road risks, preventive actions, or officer-ready talking points..."
                      disabled={isLoading}
                      rows={3}
                      className="min-h-[76px] resize-none border-0 bg-transparent px-2 py-2 text-sm leading-6 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
                    />
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <p className="text-xs leading-5 text-slate-500">
                        Press <span className="font-semibold text-slate-700">Enter</span> to send and <span className="font-semibold text-slate-700">Shift + Enter</span> for a new line.
                      </p>
                      <Button
                        onClick={() => handleSendMessage(inputValue)}
                        disabled={!inputValue.trim() || isLoading}
                        className="h-10 rounded-full bg-[#102a5c] px-5 text-white hover:bg-[#163a70]"
                      >
                        <Send className="mr-2 h-4 w-4" />
                        Send
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-3 backdrop-blur-sm sm:p-4">
      <div className="h-[90dvh] w-[94vw] md:h-[85vh] md:w-[85vw]">
        {shell}
      </div>
    </div>
  );
};

export default AccidentChat;

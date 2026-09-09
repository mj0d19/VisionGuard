import { useState, useRef, useEffect } from 'react';
import { useAuthedApi } from '../lib/api';
import { useI18n } from '../i18n/useI18n';

export default function LLMQuery() {
  const { t, locale } = useI18n();
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [runId, setRunId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const chatEndRef = useRef(null);
  const nextId = useRef(1);
  const apiFetch = useAuthedApi();

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    let cancelled = false;

    async function loadContext() {
      setLoading(true);
      try {
        const runs = await apiFetch('/runs?limit=1');
        if (cancelled) return;

        if (!runs.length) {
          setRunId(null);
          setMessages([
            {
              id: 'no-run',
              role: 'assistant',
              content: t('llm.noRunMsg'),
              timestamp: new Date().toISOString(),
            },
          ]);
          return;
        }

        const id = runs[0].id;
        setRunId(id);

        const ctx = await apiFetch(`/runs/${id}/context`);
        if (cancelled) return;

        setMessages([
          {
            id: 'ctx-summary',
            role: 'assistant',
            content: t('llm.connectedIntro', {
              runId: `${id.slice(0, 8)}…`,
              summary: ctx.summary,
            }),
            timestamp: new Date().toISOString(),
          },
        ]);
      } catch {
        if (!cancelled) {
          setRunId(null);
          setMessages([
            {
              id: 'no-run',
              role: 'assistant',
              content: t('llm.noRunMsg'),
              timestamp: new Date().toISOString(),
            },
          ]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadContext();
    return () => {
      cancelled = true;
    };
  }, [apiFetch, locale, t]);

  const handleSend = async () => {
    if (!inputValue.trim() || sending) return;

    const content = inputValue.trim();
    const userMessage = {
      id: `u-${nextId.current++}`,
      role: 'user',
      content,
      timestamp: new Date().toISOString(),
    };

    setMessages((m) => [...m, userMessage]);
    setInputValue('');

    if (!runId) {
      setMessages((m) => [
        ...m,
        {
          id: `a-${nextId.current++}`,
          role: 'assistant',
          content: t('llm.noRunReply'),
          timestamp: new Date().toISOString(),
        },
      ]);
      return;
    }

    setSending(true);
    try {
      const data = await apiFetch(`/runs/${runId}/llm`, {
        method: 'POST',
        body: JSON.stringify({ question: content }),
      });
      const answer = data?.answer != null ? String(data.answer) : JSON.stringify(data);
      setMessages((m) => [
        ...m,
        {
          id: `a-${nextId.current++}`,
          role: 'assistant',
          content: answer,
          timestamp: new Date().toISOString(),
        },
      ]);
    } catch (e) {
      setMessages((m) => [
        ...m,
        {
          id: `a-${nextId.current++}`,
          role: 'assistant',
          content: t('llm.requestFailed', { message: e.message }),
          timestamp: new Date().toISOString(),
        },
      ]);
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const applySuggestion = (text) => {
    setInputValue(text);
  };

  return (
    <div className="h-[calc(100vh-8rem)] lg:h-[calc(100vh-4rem)] flex flex-col">
      <div className="flex-shrink-0 pb-4 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-vg-accent/20 flex items-center justify-center">
            <svg className="w-5 h-5 text-vg-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
              />
            </svg>
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">{t('llm.title')}</h1>
            <p className="text-vg-text-muted text-sm">
              {t('llm.subtitle')}
              {runId && (
                <span className="ms-2 text-vg-accent/80">
                  {t('llm.runHint', { runId: `${runId.slice(0, 8)}…` })}
                </span>
              )}
            </p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto py-4 space-y-4">
        <div className="text-center py-6">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-vg-card border border-white/10 text-sm text-vg-text-muted">
            <span className="w-2 h-2 rounded-full bg-vg-success animate-pulse" />
            {loading ? t('llm.connecting') : t('llm.ready')}
          </div>
        </div>

        {messages.map((message) => (
          <ChatMessage key={message.id} message={message} />
        ))}

        <div ref={chatEndRef} />
      </div>

      <div className="flex-shrink-0 py-3 border-t border-white/10">
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
          <SuggestionChip onPick={() => applySuggestion(t('llm.suggestion1'))}>{t('llm.suggestion1')}</SuggestionChip>
          <SuggestionChip onPick={() => applySuggestion(t('llm.suggestion2'))}>{t('llm.suggestion2')}</SuggestionChip>
          <SuggestionChip onPick={() => applySuggestion(t('llm.suggestion3'))}>{t('llm.suggestion3')}</SuggestionChip>
          <SuggestionChip onPick={() => applySuggestion(t('llm.suggestion4'))}>{t('llm.suggestion4')}</SuggestionChip>
        </div>
      </div>

      <div className="flex-shrink-0 pt-2">
        <div className="flex gap-3 items-end">
          <div className="flex-1 relative">
            <textarea
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={t('llm.placeholder')}
              rows={1}
              disabled={sending}
              className="w-full px-4 py-3 pe-12 rounded-xl bg-vg-card border border-white/10 
                text-white placeholder-vg-text-muted resize-none
                focus:outline-none focus:border-vg-accent/50 focus:ring-1 focus:ring-vg-accent/30
                transition-all disabled:opacity-50"
              style={{ minHeight: '48px', maxHeight: '120px' }}
            />
          </div>
          <button
            type="button"
            onClick={handleSend}
            className="flex-shrink-0 min-w-[3rem] h-12 px-3 rounded-xl bg-vg-accent flex items-center justify-center
              glow-blue-sm hover:glow-blue transition-all duration-300
              disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={!inputValue.trim() || sending}
          >
            {sending ? (
              <span className="text-xs text-white">…</span>
            ) : (
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            )}
          </button>
        </div>
        <p className="text-center text-xs text-vg-text-muted mt-3">{t('llm.footerNote')}</p>
      </div>
    </div>
  );
}

function ChatMessage({ message }) {
  const { t } = useI18n();
  const isUser = message.role === 'user';
  const timestamp = new Date(message.timestamp);

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} animate-fade-in`}>
      <div className={`max-w-[85%] md:max-w-[75%] ${isUser ? 'order-2' : 'order-1'}`}>
        <div className={`flex items-center gap-2 mb-1 ${isUser ? 'justify-end' : 'justify-start'}`}>
          {!isUser && (
            <div className="w-6 h-6 rounded-full bg-vg-accent/20 flex items-center justify-center">
              <span className="text-vg-accent text-xs font-bold">VG</span>
            </div>
          )}
          <span className="text-xs text-vg-text-muted">{isUser ? t('llm.you') : t('llm.assistant')}</span>
          <span className="text-xs text-vg-text-muted/60">
            {timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>

        <div
          className={`
            px-4 py-3 rounded-2xl
            ${
              isUser
                ? 'bg-vg-accent text-white rounded-tr-sm'
                : 'bg-vg-card border border-white/10 text-white rounded-tl-sm'
            }
          `}
        >
          <div className="text-sm whitespace-pre-wrap leading-relaxed">{message.content}</div>
        </div>
      </div>
    </div>
  );
}

function SuggestionChip({ children, onPick }) {
  return (
    <button
      type="button"
      onClick={onPick}
      className="flex-shrink-0 px-4 py-2 rounded-full bg-vg-card border border-white/10 
      text-sm text-vg-text-muted hover:text-white hover:border-vg-accent/30 
      transition-all whitespace-nowrap"
    >
      {children}
    </button>
  );
}

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Bot,
  Send,
  Trash2,
  AlertTriangle,
  CheckCircle,
  Loader2,
  WifiOff,
  Wifi,
  ChevronDown,
  Shield,
  User,
  Sparkles,
  Database,
  Network,
  Clock,
} from 'lucide-react';
import { sendMessage, clearHistory, checkHealth } from '../services/chatService';

// ── Suggested queries ──────────────────────────────────────────────────────────
const SUGGESTED_QUERIES = [
  { icon: AlertTriangle, label: 'High-Risk Accounts', query: 'Which accounts are currently flagged as high risk?' },
  { icon: Network,        label: 'Fraud Rings',        query: 'Are there any fraud rings or cycle patterns detected?' },
  { icon: Database,       label: 'Recent Alerts',      query: 'Show me all recent transaction alerts in the system.' },
  { icon: Clock,          label: 'Rapid In-Out',        query: 'Which accounts show rapid in-and-out transaction behavior?' },
];

// ── Typing indicator ──────────────────────────────────────────────────────────
function TypingIndicator() {
  return (
    <div className="flex items-end gap-3 mb-4">
      <div className="w-8 h-8 rounded-full bg-blue-500/20 border border-blue-500/40 flex items-center justify-center shrink-0 shadow-[0_0_12px_rgba(59,130,246,0.2)]">
        <Bot size={16} className="text-blue-400" />
      </div>
      <div className="bg-[#0B1324] border border-[#1E293B] rounded-2xl rounded-bl-sm px-4 py-3">
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 bg-blue-400/70 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
          <span className="w-2 h-2 bg-blue-400/70 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
          <span className="w-2 h-2 bg-blue-400/70 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>
      </div>
    </div>
  );
}

// ── Risk badge ────────────────────────────────────────────────────────────────
function RiskBadge({ accountId }) {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-rose-500/15 border border-rose-500/30 rounded-full text-xs font-semibold text-rose-400">
      <AlertTriangle size={10} />
      {accountId}
    </span>
  );
}

// ── Source badge ──────────────────────────────────────────────────────────────
function SourceBadge({ accountId }) {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-500/10 border border-blue-500/20 rounded-full text-xs font-medium text-blue-400/80">
      <Database size={10} />
      {accountId}
    </span>
  );
}

// ── Single message bubble ─────────────────────────────────────────────────────
function MessageBubble({ msg }) {
  const isHuman = msg.role === 'human';

  // Render markdown-style bullet points
  const renderContent = (text) => {
    if (!text) return null;
    const lines = text.split('\n');
    return lines.map((line, i) => {
      if (line.trim().startsWith('- ') || line.trim().startsWith('• ')) {
        return (
          <li key={i} className="ml-4 list-disc text-slate-300">
            {line.replace(/^[\-•]\s/, '')}
          </li>
        );
      }
      if (line.trim() === '') return <br key={i} />;
      return <p key={i} className="text-slate-300 leading-relaxed">{line}</p>;
    });
  };

  if (isHuman) {
    return (
      <div className="flex items-end gap-3 mb-4 justify-end">
        <div className="max-w-[75%] bg-blue-600/20 border border-blue-500/30 rounded-2xl rounded-br-sm px-4 py-3 shadow-[0_0_20px_rgba(59,130,246,0.05)]">
          <p className="text-slate-200 text-sm leading-relaxed">{msg.content}</p>
        </div>
        <div className="w-8 h-8 rounded-full bg-[#152033] border border-[#1E293B] flex items-center justify-center shrink-0 text-slate-300 font-bold text-xs">
          <User size={15} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-3 mb-4">
      <div className="w-8 h-8 rounded-full bg-blue-500/20 border border-blue-500/40 flex items-center justify-center shrink-0 mt-0.5 shadow-[0_0_12px_rgba(59,130,246,0.2)]">
        <Bot size={16} className="text-blue-400" />
      </div>
      <div className="max-w-[80%] flex flex-col gap-2">
        <div className="bg-[#0B1324] border border-[#1E293B] rounded-2xl rounded-tl-sm px-4 py-3">
          <div className="text-sm space-y-1">
            {renderContent(msg.content)}
          </div>
        </div>

        {/* Sources */}
        {msg.sources && msg.sources.length > 0 && (
          <div className="flex flex-wrap gap-1.5 px-1">
            <span className="text-xs text-slate-500 mr-1">Sources:</span>
            {msg.sources.map((s) => <SourceBadge key={s} accountId={s} />)}
          </div>
        )}

        {/* Risk Flags */}
        {msg.risk_flags && msg.risk_flags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 px-1 items-center">
            <span className="text-xs text-rose-400/70 mr-1 font-medium">⚠ HIGH RISK:</span>
            {msg.risk_flags.map((f) => <RiskBadge key={f} accountId={f} />)}
          </div>
        )}

        {/* Timestamp */}
        {msg.timestamp && (
          <span className="text-[11px] text-slate-600 px-1">
            {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        )}
      </div>
    </div>
  );
}

// ── Main ChatBot component ────────────────────────────────────────────────────
const ChatBot = () => {
  const [messages, setMessages]     = useState([]);
  const [input, setInput]           = useState('');
  const [isLoading, setIsLoading]   = useState(false);
  const [isTyping, setIsTyping]     = useState(false);
  const [health, setHealth]         = useState(null); // null | {status, qdrant, model}
  const [healthLoading, setHealthLoading] = useState(true);
  const [error, setError]           = useState(null);
  const [cleared, setCleared]       = useState(false);

  const messagesEndRef = useRef(null);
  const inputRef       = useRef(null);
  const textareaRef    = useRef(null);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  // Health check on mount
  useEffect(() => {
    setHealthLoading(true);
    checkHealth()
      .then(setHealth)
      .catch(() => setHealth({ status: 'error', qdrant: 'disconnected', model: 'N/A' }))
      .finally(() => setHealthLoading(false));
  }, []);

  // Show welcome message
  useEffect(() => {
    setMessages([
      {
        id: 'welcome',
        role: 'ai',
        content:
          'Welcome to MuleDNA Forensic Intelligence. I\'m your AI analyst, powered by your live transaction database.\n\n- Ask me about specific accounts, risk scores, or fraud patterns.\n- Mention an Account ID (e.g. ACC-1234) to pull its full profile.\n- I can identify mule rings, rapid in-out behavior, and device-sharing clusters.',
        sources: [],
        risk_flags: [],
        timestamp: new Date().toISOString(),
      },
    ]);
  }, []);

  const handleSend = useCallback(async (queryOverride) => {
    const query = (queryOverride || input).trim();
    if (!query || isLoading) return;

    const userMsg = {
      id: `user-${Date.now()}`,
      role: 'human',
      content: query,
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);
    setIsTyping(true);
    setError(null);

    try {
      const res = await sendMessage(query);
      setIsTyping(false);
      const aiMsg = {
        id: `ai-${Date.now()}`,
        role: 'ai',
        content: res.answer,
        sources: res.sources || [],
        risk_flags: res.risk_flags || [],
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, aiMsg]);
    } catch (err) {
      setIsTyping(false);
      setError(err.message || 'Failed to reach the MuleDNA backend.');
      const errMsg = {
        id: `err-${Date.now()}`,
        role: 'ai',
        content: `⚠ System Error: ${err.message || 'Unable to connect to the backend.'}`,
        sources: [],
        risk_flags: [],
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errMsg]);
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  }, [input, isLoading]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleClear = async () => {
    try {
      await clearHistory();
      setMessages([
        {
          id: `cleared-${Date.now()}`,
          role: 'ai',
          content: 'Conversation memory cleared. Starting fresh.',
          sources: [],
          risk_flags: [],
          timestamp: new Date().toISOString(),
        },
      ]);
      setCleared(true);
      setTimeout(() => setCleared(false), 2000);
    } catch (err) {
      setError('Failed to clear conversation: ' + err.message);
    }
  };

  // ── Status bar color ────────────────────────────────────────────────────────
  const qdrantOk = health?.qdrant === 'connected';

  return (
    <div className="flex flex-col h-full max-h-[calc(100vh-4rem)] bg-[#060B14]">

      {/* ── Page Header ──────────────────────────────────────────────────── */}
      <div className="px-6 py-5 border-b border-[#152033] flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <div className="relative">
            <div className="w-10 h-10 bg-[#0B1324] border border-blue-500/30 rounded-xl flex items-center justify-center shadow-[0_0_20px_rgba(59,130,246,0.15)]">
              <Bot size={20} className="text-blue-400" />
            </div>
            <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-[#060B14] ${qdrantOk ? 'bg-emerald-400' : 'bg-rose-500'}`} />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-slate-100 flex items-center gap-2">
              Forensic Intelligence
              <span className="px-2 py-0.5 text-[10px] font-bold tracking-widest uppercase bg-blue-500/10 border border-blue-500/30 text-blue-400 rounded-full">RAG AI</span>
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">Powered by live MuleDNA account & transaction data</p>
          </div>
        </div>

        {/* Health badge */}
        <div className="flex items-center gap-3">
          {healthLoading ? (
            <Loader2 size={14} className="text-slate-500 animate-spin" />
          ) : (
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border ${qdrantOk ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-rose-500/10 border-rose-500/30 text-rose-400'}`}>
              {qdrantOk ? <Wifi size={12} /> : <WifiOff size={12} />}
              {qdrantOk ? `Qdrant Online · ${health?.model}` : 'Qdrant Offline'}
            </div>
          )}
          <button
            id="clear-chat-btn"
            onClick={handleClear}
            title="Clear conversation"
            className="p-2 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-all duration-200 border border-transparent hover:border-rose-500/20"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      {/* ── Messages Area ───────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-6 py-5 scrollbar-hide space-y-1">

        {/* Suggested queries (only on fresh / cleared) */}
        {messages.length <= 1 && (
          <div className="mb-6">
            <p className="text-xs text-slate-500 uppercase tracking-widest font-semibold mb-3 flex items-center gap-2">
              <Sparkles size={12} className="text-blue-400" />
              Quick Queries
            </p>
            <div className="grid grid-cols-2 gap-2">
              {SUGGESTED_QUERIES.map((sq) => (
                <button
                  key={sq.label}
                  id={`suggest-${sq.label.toLowerCase().replace(/\s+/g, '-')}`}
                  onClick={() => handleSend(sq.query)}
                  className="flex items-center gap-3 p-3 bg-[#0B1324] border border-[#1E293B] rounded-xl text-left hover:border-blue-500/30 hover:bg-blue-500/5 transition-all duration-200 group"
                >
                  <div className="w-8 h-8 rounded-lg bg-[#152033] flex items-center justify-center text-blue-400/70 group-hover:text-blue-400 transition-colors shrink-0">
                    <sq.icon size={15} />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-300 group-hover:text-slate-100 transition-colors">{sq.label}</p>
                    <p className="text-[11px] text-slate-500 leading-tight mt-0.5 line-clamp-1">{sq.query}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Message list */}
        {messages.map((msg) => (
          <MessageBubble key={msg.id} msg={msg} />
        ))}

        {/* Typing indicator */}
        {isTyping && <TypingIndicator />}

        {/* Scroll anchor */}
        <div ref={messagesEndRef} />
      </div>

      {/* ── Input Bar ────────────────────────────────────────────────────── */}
      <div className="px-6 py-4 border-t border-[#152033] shrink-0">
        {/* Error bar */}
        {error && (
          <div className="mb-3 flex items-center gap-2 px-3 py-2 bg-rose-500/10 border border-rose-500/20 rounded-xl text-xs text-rose-400">
            <AlertTriangle size={13} />
            {error}
          </div>
        )}

        <div className="flex items-end gap-3">
          <div className="flex-1 relative">
            <textarea
              ref={inputRef}
              id="chat-input"
              rows={1}
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                // Auto-grow textarea
                e.target.style.height = 'auto';
                e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
              }}
              onKeyDown={handleKeyDown}
              placeholder="Ask about accounts, transactions, risk patterns..."
              disabled={isLoading}
              className="w-full bg-[#0B1324] border border-[#1E293B] rounded-xl px-4 py-3 pr-12 text-sm text-slate-200 placeholder-slate-600 resize-none focus:outline-none focus:border-blue-500/50 focus:shadow-[0_0_0_1px_rgba(59,130,246,0.2)] transition-all duration-200 disabled:opacity-50 scrollbar-hide"
              style={{ minHeight: '46px', maxHeight: '120px' }}
            />
            {/* Keyboard hint */}
            <span className="absolute right-3 bottom-3 text-[10px] text-slate-600 pointer-events-none select-none">↵</span>
          </div>

          <button
            id="send-chat-btn"
            onClick={() => handleSend()}
            disabled={!input.trim() || isLoading}
            className="w-11 h-11 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:bg-[#0B1324] disabled:border disabled:border-[#1E293B] disabled:text-slate-600 text-white flex items-center justify-center transition-all duration-200 shadow-[0_0_20px_rgba(59,130,246,0.2)] hover:shadow-[0_0_25px_rgba(59,130,246,0.35)] disabled:shadow-none shrink-0"
          >
            {isLoading
              ? <Loader2 size={18} className="animate-spin" />
              : <Send size={18} />
            }
          </button>
        </div>

        <p className="text-[11px] text-slate-600 mt-2 text-center">
          AI responses are grounded in live MuleDNA data — not generated from general knowledge.
        </p>
      </div>
    </div>
  );
};

export default ChatBot;

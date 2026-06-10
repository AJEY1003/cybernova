import React, { useState, useEffect, useRef } from 'react'
import axios from 'axios'
import { C, lbl } from '../theme'

export default function ChatBot() {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [health, setHealth] = useState(null)
  
  const endRef = useRef(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    axios.get('/api/chat/health')
      .then(res => setHealth(res.data))
      .catch(() => setHealth({ status: 'error' }))

    setMessages([
      { role: 'ai', content: 'Welcome to MuleDNA Forensic Intelligence. Ask me about specific accounts, risk scores, or fraud patterns.' }
    ])
  }, [])

  const handleSend = async () => {
    if (!input.trim() || isLoading) return
    const query = input.trim()
    setMessages(prev => [...prev, { role: 'human', content: query }])
    setInput('')
    setIsLoading(true)

    try {
      const res = await axios.post('/api/chat', { query })
      setMessages(prev => [...prev, { role: 'ai', content: res.data.answer, sources: res.data.sources, risk_flags: res.data.risk_flags }])
    } catch (e) {
      setMessages(prev => [...prev, { role: 'ai', content: '⚠ System Error: Failed to connect to AI backend.' }])
    } finally {
      setIsLoading(false)
    }
  }

  const handleClear = async () => {
    try {
      await axios.post('/api/chat/clear')
      setMessages([{ role: 'ai', content: 'Memory cleared. Starting fresh.' }])
    } catch(e) {}
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div style={{ padding: '20px 24px', borderBottom: `1px solid rgba(91,63,68,0.15)`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', shrink: 0 }}>
        <div>
          <h2 style={{ fontFamily: 'Space Grotesk,sans-serif', color: C.textMain, margin: 0 }}>FORENSIC AI</h2>
          <p style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: 12, color: C.textMuted, margin: '4px 0 0' }}>RAG-POWERED INVESTIGATION AGENT</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: health?.qdrant === 'connected' ? C.secondary : C.error, boxShadow: `0 0 8px ${health?.qdrant === 'connected' ? C.secondary : C.error}` }} />
            <span style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: 11, color: health?.qdrant === 'connected' ? C.secondary : C.error }}>
              {health?.qdrant === 'connected' ? 'QDRANT ONLINE' : 'QDRANT OFFLINE'}
            </span>
          </div>
          <button onClick={handleClear} style={{ padding: '6px 12px', background: 'transparent', color: C.textMuted, border: `1px solid ${C.outline}`, borderRadius: 4, cursor: 'pointer', fontFamily: 'Space Grotesk,sans-serif', fontSize: 10 }}>
            CLEAR MEMORY
          </button>
        </div>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
        {messages.map((msg, i) => (
          <div key={i} style={{ alignSelf: msg.role === 'human' ? 'flex-end' : 'flex-start', maxWidth: '75%' }}>
            <div style={{
              background: msg.role === 'human' ? 'rgba(255,177,192,0.1)' : C.surface,
              border: `1px solid ${msg.role === 'human' ? 'rgba(255,177,192,0.3)' : 'rgba(91,63,68,0.2)'}`,
              padding: '12px 16px', borderRadius: 8, color: C.textMain, fontFamily: 'Inter,sans-serif', fontSize: 14, lineHeight: 1.5
            }}>
              {msg.content}
              
              {/* Badges for AI responses */}
              {msg.role === 'ai' && (msg.sources?.length > 0 || msg.risk_flags?.length > 0) && (
                <div style={{ marginTop: 12, borderTop: `1px solid rgba(91,63,68,0.15)`, paddingTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {msg.sources?.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      <span style={{ fontSize: 10, fontFamily: 'JetBrains Mono,monospace', color: C.textMuted }}>SOURCES:</span>
                      {msg.sources.map(s => <span key={s} style={{ fontSize: 10, background: 'rgba(0,224,179,0.1)', color: C.secondary, padding: '2px 6px', borderRadius: 4 }}>{s}</span>)}
                    </div>
                  )}
                  {msg.risk_flags?.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      <span style={{ fontSize: 10, fontFamily: 'JetBrains Mono,monospace', color: C.error }}>HIGH RISK:</span>
                      {msg.risk_flags.map(f => <span key={f} style={{ fontSize: 10, background: 'rgba(255,76,131,0.15)', color: C.primary, padding: '2px 6px', borderRadius: 4 }}>{f}</span>)}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
        {isLoading && (
          <div style={{ alignSelf: 'flex-start', background: C.surface, padding: '12px 16px', borderRadius: 8, color: C.textMuted }}>
            <span style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: 12 }}>ANALYZING...</span>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {/* Input */}
      <div style={{ padding: 24, borderTop: `1px solid rgba(91,63,68,0.15)`, display: 'flex', gap: 12, shrink: 0 }}>
        <input 
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSend()}
          placeholder="Ask about accounts, risk scores, or fraud rings..."
          disabled={isLoading}
          style={{
            flex: 1, background: C.surface, border: `1px solid rgba(91,63,68,0.4)`, color: C.textMain,
            padding: '12px 16px', borderRadius: 8, outline: 'none', fontFamily: 'Inter,sans-serif', fontSize: 14
          }}
        />
        <button 
          onClick={handleSend}
          disabled={isLoading || !input.trim()}
          style={{
            padding: '0 24px', background: C.primary, color: '#000', border: 'none', borderRadius: 8,
            cursor: isLoading || !input.trim() ? 'not-allowed' : 'pointer', fontFamily: 'Space Grotesk,sans-serif', fontWeight: 700, letterSpacing: '0.1em', opacity: isLoading || !input.trim() ? 0.5 : 1
          }}
        >
          SEND
        </button>
      </div>
    </div>
  )
}

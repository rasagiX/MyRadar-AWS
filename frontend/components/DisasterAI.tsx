'use client'

import { useState, useRef, useEffect } from 'react'
import { useDisasterState, useNetworkStatus } from '@/store/disasterStore'
import { Bot, Send, ChevronRight, Cpu, Cloud } from 'lucide-react'
import { queryDisasterAI } from '@/services/aws/bedrock'
import { SUGGESTED_QUERIES } from '@/services/local/offlineAI'
import type { AIResponse } from '@/services/local/offlineAI'

interface Message {
  id: string
  role: 'user' | 'ai'
  text: string
  mode?: 'CLOUD' | 'LOCAL'
  timestamp: string
}

function MessageBubble({ msg }: { msg: Message }) {
  const isUser = msg.role === 'user'
  return (
    <div className={`flex flex-col gap-1 ${isUser ? 'items-end' : 'items-start'}`}>
      {isUser ? (
        <div className="max-w-[85%] border border-cyan-400/20 bg-cyan-400/[0.06] px-3 py-2">
          <p className="font-mono text-[8px] uppercase tracking-wider text-cyan-300 mb-1">YOU</p>
          <p className="text-[10px] text-white/80 leading-relaxed">{msg.text}</p>
        </div>
      ) : (
        <div className="max-w-[95%] border border-white/8 bg-[#0a1c24] px-3 py-2">
          <div className="flex items-center justify-between mb-1.5 gap-3">
            <p className="font-mono text-[8px] uppercase tracking-wider text-lime-300">NEXUS AI</p>
            {msg.mode && (
              <span className={`flex items-center gap-1 font-mono text-[7px] uppercase tracking-wider border px-1 py-0.5 ${msg.mode === 'CLOUD' ? 'border-cyan-400/25 text-cyan-300' : 'border-amber-400/25 text-amber-300'}`}>
                {msg.mode === 'CLOUD' ? <Cloud size={8} /> : <Cpu size={8} />}
                {msg.mode}
              </span>
            )}
          </div>
          <pre className="font-mono text-[9px] text-white/75 leading-relaxed whitespace-pre-wrap">{msg.text}</pre>
        </div>
      )}
      <span className="font-mono text-[7px] text-white/20">{msg.timestamp}</span>
    </div>
  )
}

export function DisasterAI() {
  const state = useDisasterState()
  const { isOffline } = useNetworkStatus()
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'ai',
      text: `NEXUS AI OPERATIONAL\n\nSynced to ${state.sensors.length} sensors, ${state.rescueTeams.length} teams, ${state.shelters.length} shelters.\n\nAsk me anything about the current disaster situation.`,
      mode: 'LOCAL',
      timestamp: new Date().toLocaleTimeString('en-GB', { hour12: false }),
    },
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function sendMessage(text: string) {
    if (!text.trim() || loading) return

    const userMsg: Message = {
      id: `u-${Date.now()}`,
      role: 'user',
      text: text.trim(),
      timestamp: new Date().toLocaleTimeString('en-GB', { hour12: false }),
    }

    setMessages(prev => [...prev, userMsg])
    setInput('')
    setLoading(true)

    try {
      const response: AIResponse = await queryDisasterAI(text.trim(), state)
      const aiMsg: Message = {
        id: `a-${Date.now()}`,
        role: 'ai',
        text: response.text,
        mode: response.mode,
        timestamp: new Date().toLocaleTimeString('en-GB', { hour12: false }),
      }
      setMessages(prev => [...prev, aiMsg])
    } catch {
      const errMsg: Message = {
        id: `e-${Date.now()}`,
        role: 'ai',
        text: 'AI query failed. Retrying with local knowledge base.',
        mode: 'LOCAL',
        timestamp: new Date().toLocaleTimeString('en-GB', { hour12: false }),
      }
      setMessages(prev => [...prev, errMsg])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/8 shrink-0">
        <div className="flex items-center gap-2">
          <Bot size={13} className="text-white/40" />
          <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-white/60">NEXUS AI</span>
        </div>
        <div className={`flex items-center gap-1.5 font-mono text-[8px] uppercase border px-1.5 py-0.5 ${isOffline ? 'border-amber-400/25 text-amber-300' : 'border-cyan-400/25 text-cyan-300'}`}>
          {isOffline ? <Cpu size={9} /> : <Cloud size={9} />}
          AI MODE: {isOffline ? 'LOCAL' : 'CLOUD'}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-3">
        {messages.map(msg => <MessageBubble key={msg.id} msg={msg} />)}
        {loading && (
          <div className="flex items-center gap-2 font-mono text-[9px] text-white/30">
            <span className="h-1 w-1 rounded-full bg-cyan-400 animate-ping" />
            <span className="h-1 w-1 rounded-full bg-cyan-400 animate-ping [animation-delay:0.15s]" />
            <span className="h-1 w-1 rounded-full bg-cyan-400 animate-ping [animation-delay:0.3s]" />
            <span className="ml-1">NEXUS processing…</span>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Suggested queries */}
      {messages.length <= 2 && (
        <div className="border-t border-white/8 p-3 flex flex-col gap-1 shrink-0">
          <p className="font-mono text-[7px] uppercase tracking-wider text-white/20 mb-1">Suggested Queries</p>
          {SUGGESTED_QUERIES.slice(0, 4).map(q => (
            <button
              key={q}
              onClick={() => sendMessage(q)}
              className="flex items-center justify-between gap-2 border border-white/8 px-2.5 py-1.5 text-left hover:border-cyan-400/25 hover:bg-cyan-400/[0.03] transition-colors"
            >
              <span className="text-[9px] text-white/55">{q}</span>
              <ChevronRight size={10} className="shrink-0 text-white/20" />
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="border-t border-white/8 p-3 shrink-0">
        <form
          onSubmit={(e) => { e.preventDefault(); sendMessage(input) }}
          className="flex gap-2"
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask NEXUS AI…"
            className="flex-1 bg-[#0a1820] border border-white/10 px-3 py-2 font-mono text-[10px] text-white/80 placeholder:text-white/20 focus:outline-none focus:border-cyan-400/40"
          />
          <button
            type="submit"
            disabled={!input.trim() || loading}
            className={`flex items-center gap-1.5 border px-3 py-2 font-mono text-[9px] uppercase tracking-wider transition-colors ${input.trim() && !loading ? 'border-cyan-400/40 text-cyan-300 hover:bg-cyan-400/10' : 'border-white/10 text-white/20 cursor-not-allowed'}`}
          >
            <Send size={11} />
          </button>
        </form>
        {isOffline && (
          <p className="mt-1.5 font-mono text-[7px] text-amber-300/60 uppercase tracking-wider">
            ⚡ Running on local AI — Bedrock unavailable offline
          </p>
        )}
      </div>
    </div>
  )
}

import React, { useEffect, useRef, useState } from 'react'
import { useGameStore } from '../store/gameStore'

const MAX_LEN = 200

export default function ChatPanel() {
  const messages = useGameStore((s) => s.chatMessages)
  const localPlayerId = useGameStore((s) => s.localPlayerId)
  const isSpectator = useGameStore((s) => s.isSpectator)
  const send = useGameStore((s) => s.send)
  const [text, setText] = useState('')
  const [unread, setUnread] = useState(0)
  const [open, setOpen] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const prevCountRef = useRef(messages.length)

  // Track unread when panel is closed
  useEffect(() => {
    if (!open && messages.length > prevCountRef.current) {
      setUnread((u) => u + (messages.length - prevCountRef.current))
    }
    prevCountRef.current = messages.length
  }, [messages.length, open])

  // Scroll to bottom when panel opens or new messages arrive
  useEffect(() => {
    if (open) {
      setUnread(0)
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [open, messages.length])

  function handleOpen() {
    setOpen(true)
    setUnread(0)
  }

  function handleSend() {
    const trimmed = text.trim()
    if (!trimmed) return
    send({ type: 'CHAT', text: trimmed })
    setText('')
  }

  function handleKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') handleSend()
  }

  return (
    <div className="fixed bottom-4 right-4 z-40 flex flex-col items-end gap-2">
      {/* Chat window */}
      {open && (
        <div className="w-72 sm:w-80 bg-[#0a0e1a] border border-[#1e2d4a] rounded-2xl shadow-2xl flex flex-col overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-800">
            <span className="text-sm font-bold text-blue-400">💬 Chat</span>
            <button onClick={() => setOpen(false)} className="text-gray-500 hover:text-gray-300 text-lg leading-none">✕</button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto max-h-64 px-3 py-2 space-y-1.5 text-sm">
            {messages.length === 0 && (
              <p className="text-gray-600 text-xs text-center py-4">No messages yet</p>
            )}
            {messages.map((m) => {
              const isMe = m.senderId === localPlayerId
              return (
                <div key={m.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                  {!isMe && (
                    <span className="text-[10px] text-gray-500 mb-0.5 px-1">{m.senderName}</span>
                  )}
                  <div
                    className={`max-w-[85%] px-3 py-1.5 rounded-2xl text-sm leading-snug break-words ${
                      isMe
                        ? 'bg-blue-700 text-white rounded-br-sm'
                        : 'bg-gray-800 text-gray-200 rounded-bl-sm'
                    }`}
                  >
                    {m.text}
                  </div>
                </div>
              )
            })}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="flex items-center gap-2 px-3 py-2.5 border-t border-gray-800">
            <input
              type="text"
              value={text}
              onChange={(e) => setText(e.target.value.slice(0, MAX_LEN))}
              onKeyDown={handleKey}
              placeholder={isSpectator ? 'Chat as spectator…' : 'Say something…'}
              className="flex-1 bg-gray-800 text-white text-sm rounded-xl px-3 py-1.5 outline-none placeholder:text-gray-600 focus:ring-1 focus:ring-blue-600"
            />
            <button
              onClick={handleSend}
              disabled={!text.trim()}
              className="bg-blue-600 hover:bg-blue-500 disabled:opacity-30 text-white rounded-xl px-3 py-1.5 text-sm font-bold transition-colors"
            >
              ↑
            </button>
          </div>
        </div>
      )}

      {/* Toggle button */}
      <button
        onClick={open ? () => setOpen(false) : handleOpen}
        className="relative bg-blue-700 hover:bg-blue-600 text-white rounded-full w-12 h-12 flex items-center justify-center shadow-lg transition-colors text-xl"
        title="Chat"
      >
        💬
        {!open && unread > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>
    </div>
  )
}

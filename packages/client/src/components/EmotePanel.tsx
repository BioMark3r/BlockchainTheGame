import React, { useEffect } from 'react'
import { useGameStore } from '../store/gameStore'

const EMOTES = ['🎉', '😤', '🤔', '💀', '🔥', '👑']

export default function EmotePanel() {
  const send = useGameStore((s) => s.send)
  const emoteBubbles = useGameStore((s) => s.emoteBubbles)

  function sendEmote(emote: string) {
    send({ type: 'EMOTE', emote })
  }

  return (
    <>
      {/* Floating bubbles overlay */}
      {emoteBubbles.map((b) => (
        <div
          key={b.id}
          className="fixed z-50 pointer-events-none select-none animate-emote-rise"
          style={{ left: `${b.x}%`, bottom: '80px' }}
        >
          <div className="flex flex-col items-center gap-0.5">
            <span className="text-4xl drop-shadow-lg">{b.emote}</span>
            <span className="text-[10px] text-white/70 bg-black/40 px-1.5 rounded-full">{b.senderName}</span>
          </div>
        </div>
      ))}

      {/* Quick-send buttons — fixed bottom-left */}
      <div className="fixed bottom-4 left-4 z-40 flex gap-1.5">
        {EMOTES.map((e) => (
          <button
            key={e}
            onClick={() => sendEmote(e)}
            title={`Send ${e}`}
            className="w-10 h-10 rounded-full bg-gray-800/80 hover:bg-gray-700 border border-gray-700 text-xl transition-all hover:scale-110 active:scale-95 shadow"
          >
            {e}
          </button>
        ))}
      </div>
    </>
  )
}

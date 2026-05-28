import React, { useEffect, useRef } from 'react'
import { useGameStore } from '../store/gameStore'
import type { LogEntry } from '../store/gameStore'

function entryColor(entry: LogEntry, localPlayerId: string | null): string {
  if (!entry.playerId) return 'text-gray-400'
  if (entry.playerId === localPlayerId) return 'text-cyan-300'
  return 'text-orange-300'
}

export default function GameLog() {
  const log = useGameStore((s) => s.gameLog)
  const localPlayerId = useGameStore((s) => s.localPlayerId)
  const bottomRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom on new entries
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [log.length])

  return (
    <div className="bg-[#0a0e1a] border border-[#1e2d4a] rounded-2xl p-3 flex flex-col gap-0.5">
      <h3 className="text-[10px] text-gray-500 uppercase tracking-widest font-semibold mb-1.5">
        📋 Game Log
      </h3>

      <div className="max-h-32 overflow-y-auto flex flex-col gap-0.5 pr-1" style={{ scrollbarWidth: 'thin' }}>
        {log.length === 0 && (
          <div className="text-gray-600 text-xs italic">No events yet…</div>
        )}
        {log.map((entry) => (
          <div key={entry.id} className="flex items-start gap-1.5 text-xs leading-snug">
            <span className="flex-shrink-0 w-4 text-center">{entry.icon}</span>
            <span className={entryColor(entry, localPlayerId)}>
              {entry.text}
            </span>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  )
}

import React from 'react'
import type { PlayerState, PlayerId } from '@shared/types'
import PlayerHand from './PlayerHand'
import { displayName } from '../utils/display'
import { useGameStore } from '../store/gameStore'

interface Props {
  player: PlayerState
  isLocal: boolean
  isCurrentTurn: boolean
  localPlayerId: PlayerId
  onInvalidTxPending?: (cardId: string | null) => void
}

export default function PlayerZone({ player, isLocal, isCurrentTurn, localPlayerId, onInvalidTxPending }: Props) {
  const playerNames = useGameStore((s) => s.playerNames)
  const borderClass = isCurrentTurn
    ? 'border-green-500/50 shadow-[0_0_20px_rgba(0,255,136,0.15)]'
    : 'border-gray-700/50'

  return (
    <div className={`bg-gray-900 border-2 rounded-2xl p-4 transition-all duration-300 ${borderClass}`}>
      {/* Header row */}
      <div className="flex items-center gap-3 mb-3">
        <div className="flex items-center gap-2">
          <span
            className={`inline-block w-2 h-2 rounded-full mr-1.5 ${isCurrentTurn ? 'bg-green-400 animate-pulse' : 'bg-gray-600'}`}
          />
          <span className="font-bold text-sm">{displayName(player.id, player.isCpu, playerNames)}</span>
          {isLocal && (
            <span className="text-[10px] font-bold text-cyan-400 border border-cyan-500/50 rounded px-1 py-0.5 ml-1">
              YOU
            </span>
          )}
        </div>

        <div className="ml-auto flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-400">
          <span>
            💰 <span className="text-white font-bold">{player.credits}</span> credits
          </span>
          <span>
            🔐 <span className="text-white font-bold">{player.validators.length}</span> validators
          </span>
          <span title="Cards in hand">
            🃏 <span className="text-white font-bold">{player.hand.length}</span> in hand
          </span>
          <span title="Cards remaining in draw pile">
            📦 <span className="text-white font-bold">{player.drawPile.length}</span> in deck
          </span>
          <span title="Cards in discard pile">
            🗑️ <span className="text-white font-bold">{player.discardPile.length}</span> discarded
          </span>
        </div>
      </div>

      {/* Validators row */}
      {player.validators.length > 0 && (
        <div className="flex gap-1 mb-3">
          {player.validators.map((v) => (
            <div
              key={v.id}
              className="text-xs bg-blue-900/40 border border-blue-600/50 rounded-lg px-2 py-1 text-blue-300"
            >
              🔐 {v.id}
            </div>
          ))}
        </div>
      )}

      {/* Hand — only shown for local player */}
      {isLocal ? (
        <PlayerHand
          hand={player.hand}
          localPlayerId={localPlayerId}
          isMyTurn={isCurrentTurn}
          {...(onInvalidTxPending ? { onInvalidTxPending } : {})}
        />
      ) : player.isCpu ? (
        <div className="flex gap-2">
          {Array.from({ length: player.hand.length }).map((_, i) => (
            <div
              key={i}
              className="w-16 h-24 sm:w-20 sm:h-28 rounded-xl border-2 border-gray-700 bg-gray-800 flex items-center justify-center text-2xl opacity-40"
            >
              🤖
            </div>
          ))}
        </div>
      ) : (
        /* Opponent human — show face-down cards */
        <div className="flex gap-2">
          {Array.from({ length: player.hand.length }).map((_, i) => (
            <div
              key={i}
              className="w-16 h-24 sm:w-20 sm:h-28 rounded-xl border-2 border-gray-700 bg-gray-800 flex items-center justify-center text-gray-600 text-sm"
            >
              🂠
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

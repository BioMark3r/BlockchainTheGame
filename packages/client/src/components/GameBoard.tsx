import React, { useState } from 'react'
import { useGameStore } from '../store/gameStore'
import ChainView from './ChainView'
import PlayerZone from './PlayerZone'
import GameOverModal from './GameOverModal'
import GameLog from './GameLog'
import type { PlayerState } from '@shared/types'
import { displayName } from '../utils/display'

interface Props {
  onReturnToLobby: () => void
}

export default function GameBoard({ onReturnToLobby }: Props) {
  const gameState = useGameStore((s) => s.gameState)
  const localPlayerId = useGameStore((s) => s.localPlayerId)
  const send = useGameStore((s) => s.send)
  const error = useGameStore((s) => s.error)
  const [invalidTxCardId, setInvalidTxCardId] = useState<string | null>(null)
  const [confirmingConcede, setConfirmingConcede] = useState(false)

  if (!gameState || !localPlayerId) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-400">
        Waiting for game to start…
      </div>
    )
  }

  const { players, currentTurn, chain, phase, validatorRedundancyCount, chainSplit } = gameState

  const localPlayer = players.find((p) => p.id === localPlayerId) as PlayerState
  const opponentPlayer = players.find((p) => p.id !== localPlayerId) as PlayerState

  const isMyTurn = currentTurn === localPlayerId

  const turnBanner = isMyTurn ? (
    <span className="text-green-400 font-bold tracking-wide">▶ YOUR TURN</span>
  ) : (
    <span className="text-gray-500">
      ⏳ <span className="text-white">{displayName(opponentPlayer.id, opponentPlayer.isCpu)}</span>'s turn
    </span>
  )

  return (
    <div className="min-h-screen flex flex-col p-4 gap-4 max-w-4xl mx-auto">
      {/* Top bar */}
      <div className="flex items-center justify-between bg-[#0a0e1a] border border-[#1e2d4a] rounded-xl px-5 py-3">
        <div className="flex items-center gap-3">
          <span className="text-yellow-400 font-bold">⛓️ Blockchain: The Game</span>
          {chainSplit.active && (
            <span className="text-xs bg-orange-950/60 border border-orange-500/50 text-orange-300 rounded-full px-2 py-0.5">
              🔱 Chain Split Active
            </span>
          )}
          {validatorRedundancyCount > 0 && (
            <span className="text-xs bg-cyan-950/60 border border-cyan-500/50 text-cyan-300 rounded-full px-2 py-0.5">
              ⚡ Redundancy ×{validatorRedundancyCount}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <div className="text-sm">{turnBanner}</div>
          {phase === 'playing' && (
            confirmingConcede ? (
              <span className="flex items-center gap-2 text-xs">
                <span className="text-gray-400">Sure?</span>
                <button
                  onClick={() => { send({ type: 'CONCEDE' }); setConfirmingConcede(false) }}
                  className="text-red-400 hover:text-red-300 font-medium"
                >
                  Yes, concede
                </button>
                <button
                  onClick={() => setConfirmingConcede(false)}
                  className="text-gray-500 hover:text-gray-300"
                >
                  Cancel
                </button>
              </span>
            ) : (
              <button
                onClick={() => setConfirmingConcede(true)}
                className="text-xs text-gray-500 hover:text-red-400"
              >
                🏳️ Concede
              </button>
            )
          )}
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="bg-red-900/60 border border-red-600 text-red-300 rounded-xl px-4 py-2 text-sm">
          {error}
        </div>
      )}

      {/* Opponent zone */}
      <PlayerZone
        player={opponentPlayer}
        isLocal={false}
        isCurrentTurn={currentTurn === opponentPlayer.id}
        localPlayerId={localPlayerId}
      />

      {/* Chain */}
      <ChainView
        chain={chain}
        genesisCard={gameState.genesisCard}
        selectingForInvalidTx={!!invalidTxCardId}
        onBlockSelected={(blockId) => {
          send({
            type: 'ACTION',
            action: { type: 'PLAY_CARD', playerId: localPlayerId, cardId: invalidTxCardId!, targetBlockId: blockId },
          })
          setInvalidTxCardId(null)
        }}
      />

      {/* Local player zone */}
      <PlayerZone
        player={localPlayer}
        isLocal={true}
        isCurrentTurn={isMyTurn}
        localPlayerId={localPlayerId}
        onInvalidTxPending={(id) => setInvalidTxCardId(id)}
      />

      {/* Game log */}
      <GameLog />

      {/* Game over modal */}
      {phase === 'ended' && (
        <GameOverModal
          gameState={gameState}
          localPlayerId={localPlayerId}
          onPlayAgain={onReturnToLobby}
        />
      )}
    </div>
  )
}

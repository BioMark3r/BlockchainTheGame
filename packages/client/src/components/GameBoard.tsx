import React, { useState, useEffect, useRef } from 'react'
import { useGameStore } from '../store/gameStore'
import ChainView from './ChainView'
import PlayerZone from './PlayerZone'
import GameOverModal from './GameOverModal'
import GameLog from './GameLog'
import HowToPlayModal from './HowToPlayModal'
import TurnTimer from './TurnTimer'
import type { PlayerState } from '@shared/types'
import { displayName } from '../utils/display'
import { soundYourTurn, soundBlockPublish, soundChainReorg, soundFork } from '../utils/sounds'

interface Props {
  onReturnToLobby: () => void
}

export default function GameBoard({ onReturnToLobby }: Props) {
  const gameState = useGameStore((s) => s.gameState)
  const localPlayerId = useGameStore((s) => s.localPlayerId)
  const send = useGameStore((s) => s.send)
  const error = useGameStore((s) => s.error)
  const playerNames = useGameStore((s) => s.playerNames)
  const cpuDifficulty = useGameStore((s) => s.cpuDifficulty)
  const [invalidTxCardId, setInvalidTxCardId] = useState<string | null>(null)
  const [confirmingConcede, setConfirmingConcede] = useState(false)
  const [showHowToPlay, setShowHowToPlay] = useState(false)

  // Sound effect hooks
  const prevTurnRef = useRef<string | null>(null)
  const prevChainLenRef = useRef<number>(0)
  const prevPhaseRef = useRef<string | null>(null)

  useEffect(() => {
    if (!gameState) return
    // Your turn ping
    if (gameState.currentTurn !== prevTurnRef.current && gameState.currentTurn === localPlayerId) {
      soundYourTurn()
    }
    prevTurnRef.current = gameState.currentTurn

    // Block published
    if (gameState.chain.length > prevChainLenRef.current && prevChainLenRef.current > 0) {
      soundBlockPublish()
    } else if (gameState.chain.length < prevChainLenRef.current) {
      // Chain reorg
      soundChainReorg()
    }
    prevChainLenRef.current = gameState.chain.length

    // Game ended
    if (gameState.phase === 'ended' && prevPhaseRef.current === 'playing') {
      soundFork()
    }
    prevPhaseRef.current = gameState.phase
  }, [gameState, localPlayerId])

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

  const diffLabel = cpuDifficulty === 'easy' ? '🟢 Easy' : cpuDifficulty === 'hard' ? '🔴 Hard' : cpuDifficulty === 'normal' ? '🟡 Normal' : null

  const turnBanner = isMyTurn ? (
    <span className="text-green-400 font-bold tracking-wide">▶ YOUR TURN</span>
  ) : opponentPlayer.isCpu ? (
    <span className="text-blue-400 animate-pulse font-medium">
      🤖 CPU{diffLabel ? <span className="text-xs ml-1.5 opacity-70 not-italic font-normal">{diffLabel}</span> : ''} is thinking…
    </span>
  ) : (
    <span className="text-gray-500">
      ⏳ <span className="text-white">{displayName(opponentPlayer.id, opponentPlayer.isCpu, playerNames)}</span>'s turn
    </span>
  )

  return (
    <div className="min-h-screen flex flex-col p-2 sm:p-4 gap-2 sm:gap-4 max-w-4xl mx-auto">
      {showHowToPlay && <HowToPlayModal onClose={() => setShowHowToPlay(false)} />}

      {/* Top bar */}
      <div className="flex items-center justify-between bg-[#0a0e1a] border border-[#1e2d4a] rounded-xl px-3 py-2 sm:px-5 sm:py-3">
        <div className="flex items-center gap-3">
          <span className="text-sm sm:text-base text-blue-400 font-bold">⛓️ Blockchain: The Game</span>
          <button
            onClick={() => setShowHowToPlay(true)}
            className="text-xs text-blue-400 hover:text-blue-300 border border-blue-800/60 hover:border-blue-600 px-2.5 py-1 rounded-lg transition-colors font-medium"
          >
            How to Play
          </button>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-sm">{turnBanner}</div>
          {phase === 'playing' && <TurnTimer isMyTurn={isMyTurn} key={currentTurn} />}
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

      {/* Credits scorebar */}
      {(() => {
        const total = localPlayer.credits + opponentPlayer.credits
        const localPct = total === 0 ? 50 : Math.round((localPlayer.credits / total) * 100)
        const oppPct = 100 - localPct
        const localName = displayName(localPlayer.id, localPlayer.isCpu, playerNames)
        const oppName = displayName(opponentPlayer.id, opponentPlayer.isCpu, playerNames)
        const localAhead = localPlayer.credits > opponentPlayer.credits
        const tied = localPlayer.credits === opponentPlayer.credits

        return (
          <div className="bg-[#0a0e1a] border border-[#1e2d4a] rounded-xl px-4 py-3">
            <div className="flex justify-between items-center mb-2 text-xs">
              <span className={`font-bold ${localAhead && !tied ? 'text-green-400' : 'text-gray-400'}`}>
                {localAhead && !tied ? '▲ ' : ''}{localName} — {localPlayer.credits} cr
              </span>
              <span className="text-gray-600 text-[10px] uppercase tracking-wider">Credits</span>
              <span className={`font-bold ${!localAhead && !tied ? 'text-orange-400' : 'text-gray-400'}`}>
                {opponentPlayer.credits} cr — {oppName}{!localAhead && !tied ? ' ▲' : ''}
              </span>
            </div>
            <div className="flex h-2 rounded-full overflow-hidden gap-px">
              <div
                className={`transition-all duration-500 rounded-l-full ${localAhead && !tied ? 'bg-green-500' : tied ? 'bg-blue-500' : 'bg-gray-600'}`}
                style={{ width: `${localPct}%` }}
              />
              <div
                className={`transition-all duration-500 rounded-r-full ${!localAhead && !tied ? 'bg-orange-500' : tied ? 'bg-blue-500' : 'bg-gray-700'}`}
                style={{ width: `${oppPct}%` }}
              />
            </div>
            {tied && total > 0 && <p className="text-center text-[10px] text-blue-400 mt-1">Tied</p>}
          </div>
        )
      })()}

      {/* Chain */}
      <ChainView
        chain={chain}
        genesisCard={gameState.genesisCard}
        selectingForInvalidTx={!!invalidTxCardId}
        localPlayerId={localPlayerId}
        chainSplit={chainSplit}
        validatorRedundancyCount={validatorRedundancyCount}
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

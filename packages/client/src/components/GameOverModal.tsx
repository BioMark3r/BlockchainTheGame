import React, { useEffect, useState } from 'react'
import type { GameState, PlayerId } from '@shared/types'
import { useGameStore } from '../store/gameStore'
import { computeGameStats, type PlayerStats } from '../utils/gameStats'
import { displayName } from '../utils/display'
import { recordResult } from '../utils/scoreboard'
import { apiRecordResult } from '../utils/auth'
import { soundWin, soundLose } from '../utils/sounds'
import ReplayModal from './ReplayModal'

function getReplayLink(roomCode: string): string {
  return `${window.location.origin}${window.location.pathname}?replay=${roomCode}`
}

interface Props {
  gameState: GameState
  localPlayerId: PlayerId | null
  onPlayAgain: () => void
  isSpectator?: boolean
  roomCode?: string | null
}

export default function GameOverModal({ gameState, localPlayerId, onPlayAgain, isSpectator = false, roomCode }: Props) {
  const { winner, players } = gameState
  const isLocalWinner = winner === localPlayerId
  const log = useGameStore((s) => s.gameLog)
  const playerNames = useGameStore((s) => s.playerNames)
  const stats = computeGameStats(log, gameState)
  const send = useGameStore((s) => s.send)
  const isRematching = useGameStore((s) => s.isRematching)
  const setIsRematching = useGameStore((s) => s.setIsRematching)
  const [showReplay, setShowReplay] = useState(false)
  const [linkCopied, setLinkCopied] = useState(false)

  function handleCopyLink() {
    if (!roomCode) return
    navigator.clipboard.writeText(getReplayLink(roomCode)).then(() => {
      setLinkCopied(true)
      setTimeout(() => setLinkCopied(false), 2000)
    }).catch(() => {})
  }

  useEffect(() => {
    if (isSpectator) return  // spectators don't record results
    if (localPlayerId) recordResult(localPlayerId, gameState.winner)
    const authUser = useGameStore.getState().authUser
    if (authUser) {
      const result = gameState.winner === null ? 'draw' : gameState.winner === localPlayerId ? 'win' : 'loss'
      const opponentPlayer = gameState.players.find((p) => p.id !== localPlayerId)
      const opponentName = opponentPlayer ? (opponentPlayer.isCpu ? 'CPU' : opponentPlayer.id) : undefined
      const opts: { replayId?: string; opponentName?: string } = {}
      if (roomCode) opts.replayId = roomCode
      if (opponentName) opts.opponentName = opponentName
      apiRecordResult(result, opts).catch(() => {})
    }
    if (gameState.winner === null) {
      // draw — no sound
    } else if (gameState.winner === localPlayerId) {
      soundWin()
    } else {
      soundLose()
    }
  }, [])

  function handleRematch() {
    setIsRematching(true)
    send({ type: 'REMATCH' })
  }

  const winnerPlayer = players.find((p) => p.id === winner)
  const winnerLabel = winnerPlayer
    ? winnerPlayer.isCpu
      ? '🤖 CPU'
      : winner === localPlayerId
        ? 'You'
        : displayName(winnerPlayer.id, false, playerNames)
    : 'Nobody'

  return (
    <>
    {showReplay && roomCode && (
      <ReplayModal roomCode={roomCode} onClose={() => setShowReplay(false)} />
    )}
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl p-8 w-full max-w-md shadow-2xl text-center">
        <div className="text-5xl mb-4">{isLocalWinner ? '🏆' : '💀'}</div>
        <h2 className="text-2xl font-bold mb-1 text-blue-400">Game Over</h2>
        <p className="text-gray-300 mb-6 text-lg">
          {winner ? (
            <>
              <span className="font-bold text-white">{winnerLabel}</span>
              {winner === localPlayerId ? ' win!' : ' wins!'}
            </>
          ) : (
            "It's a draw!"
          )}
        </p>

        {/* Credits breakdown */}
        <div className="bg-gray-800 rounded-xl p-4 mb-6">
          <h3 className="text-xs uppercase tracking-widest text-gray-400 mb-3 font-semibold">
            Final Credits
          </h3>
          <div className="space-y-2">
            {players.map((p) => {
              const label = p.isCpu ? '🤖 CPU' : p.id === localPlayerId ? 'You' : displayName(p.id, false, playerNames)
              const isWinner = p.id === winner
              return (
                <div
                  key={p.id}
                  className={`flex justify-between items-center px-3 py-2 rounded-lg ${
                    isWinner ? 'bg-blue-400/10 border border-blue-400/30' : 'bg-gray-700/40'
                  }`}
                >
                  <span className="font-medium text-sm">
                    {label} {isWinner && '👑'}
                  </span>
                  <span className={`font-bold text-lg ${isWinner ? 'text-blue-400' : 'text-white'}`}>
                    {p.credits}
                  </span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Match Stats */}
        <div className="bg-gray-800 rounded-xl p-4 mb-6 text-left">
          <h3 className="text-xs uppercase tracking-widest text-gray-400 mb-3 font-semibold text-center">
            📊 Match Stats
          </h3>
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr>
                <th className="text-left text-gray-500 font-medium pb-2 pr-2 w-1/2"></th>
                {players.map((p) => {
                  const label = p.isCpu ? '🤖 CPU' : p.id === localPlayerId ? 'You' : displayName(p.id, false, playerNames)
                  return (
                    <th
                      key={p.id}
                      className="text-center text-gray-300 font-semibold pb-2 border-b border-gray-700"
                    >
                      {label}
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody>
              {(
                [
                  { icon: '🏆', label: 'Final Credits', key: 'creditsEarned' as const },
                  { icon: '📦', label: 'Blocks Published', key: 'blocksPublished' as const },
                  { icon: '🛡️', label: 'Validators Played', key: 'validatorsPlayed' as const },
                  { icon: '⚡', label: 'Special Cards', key: 'cardSpecialsPlayed' as const },
                  { icon: '🃏', label: 'Discards & Redraws', key: 'discardsAndRedraws' as const },
                ] as { icon: string; label: string; key: keyof PlayerStats }[]
              ).map(({ icon, label, key }) => (
                <tr key={key} className="border-b border-gray-700/40 last:border-0">
                  <td className="py-1.5 pr-2 text-gray-400 text-xs">
                    {icon} {label}
                  </td>
                  {stats.players.map((ps) => (
                    <td key={ps.playerId} className="py-1.5 text-center font-bold text-white">
                      {ps[key]}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {isRematching ? (
          <div className="text-center text-gray-400 text-sm animate-pulse">Setting up rematch…</div>
        ) : (
          <div className="flex flex-col gap-3">
            {gameState.phase === 'ended' && !isSpectator && (
              <button
                onClick={handleRematch}
                className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-xl transition-colors"
              >
                🔄 Rematch
              </button>
            )}
            {roomCode && (
              <div className="flex gap-2">
                <button
                  onClick={() => setShowReplay(true)}
                  className="flex-1 bg-purple-800 hover:bg-purple-700 text-white font-bold py-3 rounded-xl transition-colors"
                >
                  🎬 Watch Replay
                </button>
                <button
                  onClick={handleCopyLink}
                  title="Copy shareable replay link"
                  className="bg-gray-700 hover:bg-gray-600 text-white font-bold px-4 py-3 rounded-xl transition-colors text-sm"
                >
                  {linkCopied ? '✓ Copied' : '🔗 Share'}
                </button>
              </div>
            )}
            <button
              onClick={onPlayAgain}
              className="w-full bg-gray-700 hover:bg-gray-600 text-white font-bold py-3 rounded-xl transition-colors"
            >
              🏠 Return to Lobby
            </button>
          </div>
        )}
      </div>
    </div>
    </>
  )
}

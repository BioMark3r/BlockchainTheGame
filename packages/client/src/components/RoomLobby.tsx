import React, { useState, useEffect } from 'react'
import { connectWebSocket } from '../ws/client'
import { useGameStore } from '../store/gameStore'
import HowToPlayModal from './HowToPlayModal'
import type { CpuDifficulty } from '@shared/types'
import { loadScoreboard, clearScoreboard } from '../utils/scoreboard'

export default function RoomLobby() {
  const [joinCode, setJoinCode] = useState('')
  const [vsCpu, setVsCpu] = useState(false)
  const [difficulty, setDifficulty] = useState<CpuDifficulty>('normal')
  const [board, setBoard] = useState(() => loadScoreboard())

  useEffect(() => {
    setBoard(loadScoreboard())
  }, [])
  const [showHowToPlay, setShowHowToPlay] = useState(false)
  const error = useGameStore((s) => s.error)
  const roomCode = useGameStore((s) => s.roomCode)
  const clearError = useGameStore((s) => s.clearError)
  const displayName = useGameStore((s) => s.displayName)
  const setDisplayName = useGameStore((s) => s.setDisplayName)

  function handleCreate() {
    clearError()
    connectWebSocket('create', '', vsCpu, displayName.trim() || 'Player 1', difficulty)
  }

  function handleJoin() {
    if (!joinCode.trim()) return
    clearError()
    connectWebSocket('join', joinCode.trim().toUpperCase(), false, displayName.trim() || 'Player 2')
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#060910]">
      {showHowToPlay && <HowToPlayModal onClose={() => setShowHowToPlay(false)} />}
      <div className="bg-[#0a0e1a] border border-[#1e2d4a] rounded-2xl p-5 sm:p-8 w-full max-w-md shadow-2xl">
        <h1 className="text-3xl font-bold text-center mb-2 text-yellow-400 drop-shadow-[0_0_8px_rgba(255,230,0,0.6)] tracking-tight">
          ⛓️ Blockchain: The Game
        </h1>
        <p className="text-center text-gray-400 text-sm mb-2">
          Build the longest chain. Earn the most credits.
        </p>
        <div className="text-center mb-6">
          <button onClick={() => setShowHowToPlay(true)} className="text-xs text-blue-400 hover:text-blue-300 underline">
            ❓ How to Play
          </button>
        </div>

        {error && (
          <div className="mb-4 bg-red-900/60 border border-red-600 text-red-300 rounded-lg px-4 py-2 text-sm">
            {error}
          </div>
        )}

        {/* Waiting for opponent */}
        {roomCode && (
          <div className="mb-6 bg-gray-800 border border-yellow-600 rounded-xl p-4 text-center">
            <p className="text-gray-400 text-sm mb-1">Share this code with your opponent:</p>
            <p className="text-3xl font-bold text-yellow-300 tracking-[0.3em]">{roomCode}</p>
            <p className="text-gray-500 text-xs mt-2">Waiting for player 2 to join…</p>
          </div>
        )}

        {/* Create room */}
        {!roomCode && (
          <>
            <div className="mb-5">
              <label className="block text-xs text-gray-400 mb-1">Your display name (optional)</label>
              <input
                type="text"
                placeholder="Enter your name"
                maxLength={20}
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full bg-gray-800 border border-gray-600 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-yellow-400 text-white placeholder:text-gray-500"
              />
            </div>

            <div className="mb-6">
              <div className="flex items-center gap-3 mb-3">
                <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={vsCpu}
                    onChange={(e) => setVsCpu(e.target.checked)}
                    className="accent-yellow-400 w-4 h-4"
                  />
                  Play vs CPU 🤖
                </label>
              </div>
              {vsCpu && (
                <div className="flex gap-2 mt-2">
                  {(['easy', 'normal', 'hard'] as const).map((d) => (
                    <button
                      key={d}
                      onClick={() => setDifficulty(d)}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-bold capitalize transition-colors ${
                        difficulty === d
                          ? 'bg-yellow-400 text-gray-900'
                          : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                      }`}
                    >
                      {d === 'easy' ? '🟢 Easy' : d === 'normal' ? '🟡 Normal' : '🔴 Hard'}
                    </button>
                  ))}
                </div>
              )}
              <button
                onClick={handleCreate}
                className="w-full bg-yellow-400 hover:bg-yellow-300 text-gray-950 font-bold py-3 rounded-xl transition-colors"
              >
                Create Room
              </button>
            </div>

            <div className="flex items-center gap-3 mb-6">
              <hr className="flex-1 border-gray-700" />
              <span className="text-gray-500 text-sm">or</span>
              <hr className="flex-1 border-gray-700" />
            </div>

            {/* Join room */}
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Enter 6-char room code"
                maxLength={6}
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                className="flex-1 bg-gray-800 border border-gray-600 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-yellow-400 uppercase tracking-widest placeholder:normal-case placeholder:tracking-normal"
              />
              <button
                onClick={handleJoin}
                disabled={joinCode.trim().length < 3}
                className="bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold px-5 py-2 rounded-xl transition-colors"
              >
                Join
              </button>
            </div>

            {board.gamesPlayed > 0 && (
              <div className="mt-6 pt-4 border-t border-gray-800">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-gray-500 uppercase tracking-widest">Your Record</span>
                  <button
                    onClick={() => { clearScoreboard(); setBoard(loadScoreboard()) }}
                    className="text-[10px] text-gray-600 hover:text-gray-400 underline"
                  >
                    Reset
                  </button>
                </div>
                <div className="flex gap-3 text-center">
                  <div className="flex-1 bg-green-950/40 border border-green-800/50 rounded-xl py-2">
                    <div className="text-lg font-bold text-green-400">{board.wins}</div>
                    <div className="text-[10px] text-gray-500 uppercase tracking-wide">Wins</div>
                  </div>
                  <div className="flex-1 bg-red-950/40 border border-red-800/50 rounded-xl py-2">
                    <div className="text-lg font-bold text-red-400">{board.losses}</div>
                    <div className="text-[10px] text-gray-500 uppercase tracking-wide">Losses</div>
                  </div>
                  <div className="flex-1 bg-gray-800/60 border border-gray-700/50 rounded-xl py-2">
                    <div className="text-lg font-bold text-gray-400">{board.draws}</div>
                    <div className="text-[10px] text-gray-500 uppercase tracking-wide">Draws</div>
                  </div>
                </div>
                <div className="text-center text-[10px] text-gray-600 mt-1">{board.gamesPlayed} games played</div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

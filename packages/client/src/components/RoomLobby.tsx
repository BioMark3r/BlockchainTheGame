import React, { useState } from 'react'
import { connectWebSocket } from '../ws/client'
import { useGameStore } from '../store/gameStore'
import HowToPlayModal from './HowToPlayModal'

export default function RoomLobby() {
  const [joinCode, setJoinCode] = useState('')
  const [vsCpu, setVsCpu] = useState(false)
  const [showHowToPlay, setShowHowToPlay] = useState(false)
  const error = useGameStore((s) => s.error)
  const roomCode = useGameStore((s) => s.roomCode)
  const clearError = useGameStore((s) => s.clearError)

  function handleCreate() {
    clearError()
    connectWebSocket('create', '', vsCpu)
  }

  function handleJoin() {
    if (!joinCode.trim()) return
    clearError()
    connectWebSocket('join', joinCode.trim().toUpperCase(), false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#060910]">
      {showHowToPlay && <HowToPlayModal onClose={() => setShowHowToPlay(false)} />}
      <div className="bg-[#0a0e1a] border border-[#1e2d4a] rounded-2xl p-8 w-full max-w-md shadow-2xl">
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
          </>
        )}
      </div>
    </div>
  )
}

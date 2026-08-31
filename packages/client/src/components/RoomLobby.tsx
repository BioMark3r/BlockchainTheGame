import React, { useState, useEffect } from 'react'
import { connectWebSocket, connectSpectator, attemptRejoin } from '../ws/client'
import { useGameStore } from '../store/gameStore'
import HowToPlayModal from './HowToPlayModal'
import type { CpuDifficulty } from '@shared/types'
import { loadScoreboard, clearScoreboard } from '../utils/scoreboard'
import {
  loadAuth, saveAuth, clearAuth,
  apiLogin, apiRegister, apiLeaderboard,
  type AuthUser,
} from '../utils/auth'

export default function RoomLobby() {
  const [joinCode, setJoinCode] = useState('')
  const [vsCpu, setVsCpu] = useState(false)
  const [difficulty, setDifficulty] = useState<CpuDifficulty>('normal')
  const [board, setBoard] = useState(() => loadScoreboard())
  const [hasRejoinable, setHasRejoinable] = useState(false)
  const setCpuDifficulty = useGameStore((s) => s.setCpuDifficulty)

  // Auth state
  const authUser = useGameStore((s) => s.authUser)
  const setAuthUser = useGameStore((s) => s.setAuthUser)
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login')
  const [authUsername, setAuthUsername] = useState('')
  const [authPassword, setAuthPassword] = useState('')
  const [authError, setAuthError] = useState<string | null>(null)
  const [authLoading, setAuthLoading] = useState(false)
  const [showLeaderboard, setShowLeaderboard] = useState(false)
  const [leaderboardData, setLeaderboardData] = useState<Array<{ username: string; wins: number; losses: number; draws: number; gamesPlayed: number }>>([])
  const [leaderboardLoading, setLeaderboardLoading] = useState(false)

  useEffect(() => {
    setBoard(loadScoreboard())
    // Restore auth session
    const saved = loadAuth()
    if (saved) setAuthUser(saved)
    // Check if there's a rejoinable session in sessionStorage
    setHasRejoinable(
      !!sessionStorage.getItem('btg_roomCode') &&
      !!sessionStorage.getItem('btg_playerToken')
    )
  }, [])
  const [showHowToPlay, setShowHowToPlay] = useState(false)
  const error = useGameStore((s) => s.error)
  const roomCode = useGameStore((s) => s.roomCode)
  const clearError = useGameStore((s) => s.clearError)
  const displayName = useGameStore((s) => s.displayName)
  const setDisplayName = useGameStore((s) => s.setDisplayName)

  async function handleAuth() {
    setAuthError(null)
    setAuthLoading(true)
    try {
      let user: AuthUser
      if (authMode === 'login') {
        user = await apiLogin(authUsername.trim(), authPassword)
      } else {
        user = await apiRegister(authUsername.trim(), authPassword)
      }
      saveAuth(user)
      setAuthUser(user)
      setAuthUsername('')
      setAuthPassword('')
    } catch (e) {
      setAuthError(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setAuthLoading(false)
    }
  }

  function handleSignOut() {
    clearAuth()
    setAuthUser(null)
  }

  async function handleOpenLeaderboard() {
    setShowLeaderboard(true)
    setLeaderboardLoading(true)
    try {
      const data = await apiLeaderboard()
      setLeaderboardData(data)
    } catch {
      setLeaderboardData([])
    } finally {
      setLeaderboardLoading(false)
    }
  }

  function handleCreate() {
    clearError()
    setCpuDifficulty(vsCpu ? difficulty : null)
    connectWebSocket('create', '', vsCpu, displayName.trim() || 'Player 1', difficulty)
  }

  function handleRejoin() {
    clearError()
    const ok = attemptRejoin()
    if (!ok) setHasRejoinable(false)
  }

  function handleJoin() {
    if (!joinCode.trim()) return
    clearError()
    connectWebSocket('join', joinCode.trim().toUpperCase(), false, displayName.trim() || 'Player 2')
  }

  function handleWatch() {
    if (!joinCode.trim()) return
    clearError()
    connectSpectator(joinCode.trim().toUpperCase())
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#060910]">
      {showHowToPlay && <HowToPlayModal onClose={() => setShowHowToPlay(false)} />}

      {/* Leaderboard modal */}
      {showLeaderboard && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-[#0a0e1a] border border-[#1e2d4a] rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-blue-400">🏆 Leaderboard</h2>
              <button onClick={() => setShowLeaderboard(false)} className="text-gray-500 hover:text-gray-300 text-xl leading-none">✕</button>
            </div>
            {leaderboardLoading ? (
              <p className="text-center text-gray-500 py-6 text-sm">Loading…</p>
            ) : leaderboardData.length === 0 ? (
              <p className="text-center text-gray-500 py-6 text-sm">No entries yet — play some games!</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-gray-500 text-xs uppercase tracking-wide border-b border-gray-700">
                    <th className="text-left pb-2">#</th>
                    <th className="text-left pb-2">Player</th>
                    <th className="text-center pb-2 text-green-500">W</th>
                    <th className="text-center pb-2 text-red-500">L</th>
                    <th className="text-center pb-2 text-gray-400">D</th>
                    <th className="text-center pb-2 text-blue-400">Win%</th>
                  </tr>
                </thead>
                <tbody>
                  {leaderboardData.map((row, i) => {
                    const winPct = row.gamesPlayed >= 3
                      ? Math.round((row.wins / row.gamesPlayed) * 100)
                      : null
                    return (
                      <tr key={row.username} className={`border-b border-gray-800/50 last:border-0 ${authUser?.username === row.username ? 'text-blue-300' : 'text-gray-300'}`}>
                        <td className="py-1.5 text-gray-600 text-xs">{i + 1}</td>
                        <td className="py-1.5 font-medium">{row.username}{authUser?.username === row.username ? ' (you)' : ''}</td>
                        <td className="py-1.5 text-center text-green-400 font-bold">{row.wins}</td>
                        <td className="py-1.5 text-center text-red-400 font-bold">{row.losses}</td>
                        <td className="py-1.5 text-center text-gray-400">{row.draws}</td>
                        <td className="py-1.5 text-center text-blue-300 font-semibold">
                          {winPct !== null ? `${winPct}%` : <span className="text-gray-600 text-xs">—</span>}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
      <div className="bg-[#0a0e1a] border border-[#1e2d4a] rounded-2xl p-5 sm:p-8 w-full max-w-md shadow-2xl">
        <h1 className="text-3xl font-bold text-center mb-2 text-blue-400 drop-shadow-[0_0_8px_rgba(59,130,246,0.6)] tracking-tight">
          ⛓️ Blockchain: The Game
        </h1>
        <p className="text-center text-gray-400 text-sm mb-2">
          Build the longest chain. Earn the most credits.
        </p>
        <div className="text-center mb-6">
          <button
            onClick={() => setShowHowToPlay(true)}
            className="text-xs text-blue-400 hover:text-blue-300 border border-blue-800/60 hover:border-blue-600 px-3 py-1.5 rounded-lg transition-colors font-medium"
          >
            How to Play
          </button>
        </div>

        {error && (
          <div className="mb-4 bg-red-900/60 border border-red-600 text-red-300 rounded-lg px-4 py-2 text-sm">
            {error}
          </div>
        )}

        {/* Rejoin banner */}
        {hasRejoinable && !roomCode && (
          <div className="mb-4 bg-blue-950/60 border border-blue-600/60 rounded-xl px-4 py-3 flex items-center justify-between">
            <div>
              <div className="text-blue-300 text-sm font-semibold">🔄 Game in progress</div>
              <div className="text-gray-500 text-xs mt-0.5">You may have disconnected from an active game.</div>
            </div>
            <button
              onClick={handleRejoin}
              className="ml-4 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold px-4 py-2 rounded-lg transition-colors flex-shrink-0"
            >
              Rejoin
            </button>
          </div>
        )}

        {/* Waiting for opponent */}
        {roomCode && (
          <div className="mb-6 bg-gray-800 border border-blue-600 rounded-xl p-4 text-center">
            <p className="text-gray-400 text-sm mb-1">Share this code with your opponent:</p>
            <p className="text-3xl font-bold text-blue-300 tracking-[0.3em]">{roomCode}</p>
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
                className="w-full bg-gray-800 border border-gray-600 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-blue-400 text-white placeholder:text-gray-500"
              />
            </div>

            <div className="mb-6">
              <div className="flex items-center gap-3 mb-3">
                <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={vsCpu}
                    onChange={(e) => setVsCpu(e.target.checked)}
                    className="accent-blue-500 w-4 h-4"
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
                          ? 'bg-blue-600 text-white'
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
                className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-xl transition-colors"
              >
                Create Room
              </button>
            </div>

            <div className="flex items-center gap-3 mb-6">
              <hr className="flex-1 border-gray-700" />
              <span className="text-gray-500 text-sm">or</span>
              <hr className="flex-1 border-gray-700" />
            </div>

            {/* Join / Watch room */}
            <div className="flex gap-2 flex-wrap">
              <input
                type="text"
                placeholder="Enter 6-char room code"
                maxLength={6}
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                className="flex-1 bg-gray-800 border border-gray-600 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-blue-400 uppercase tracking-widest placeholder:normal-case placeholder:tracking-normal"
              />
              <button
                onClick={handleJoin}
                disabled={joinCode.trim().length < 3}
                className="bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold px-5 py-2 rounded-xl transition-colors"
              >
                Join
              </button>
              <button
                onClick={handleWatch}
                disabled={joinCode.trim().length < 3}
                title="Watch this game as a spectator"
                className="bg-gray-700 hover:bg-gray-600 disabled:opacity-40 disabled:cursor-not-allowed text-gray-300 font-bold px-4 py-2 rounded-xl transition-colors text-sm"
              >
                👁 Watch
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

            {/* Auth section */}
            <div className="mt-6 pt-4 border-t border-gray-800">
              {authUser ? (
                /* Logged in */
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm text-gray-300 font-medium">👤 {authUser.username}</span>
                    <button onClick={handleSignOut} className="text-[10px] text-gray-600 hover:text-gray-400 underline">Sign out</button>
                  </div>
                  <div className="flex gap-2 mb-3">
                    <div className="flex-1 bg-green-950/40 border border-green-800/50 rounded-xl py-1.5 text-center">
                      <div className="text-base font-bold text-green-400">{authUser.stats.wins}</div>
                      <div className="text-[10px] text-gray-500 uppercase tracking-wide">W</div>
                    </div>
                    <div className="flex-1 bg-red-950/40 border border-red-800/50 rounded-xl py-1.5 text-center">
                      <div className="text-base font-bold text-red-400">{authUser.stats.losses}</div>
                      <div className="text-[10px] text-gray-500 uppercase tracking-wide">L</div>
                    </div>
                    <div className="flex-1 bg-gray-800/60 border border-gray-700/50 rounded-xl py-1.5 text-center">
                      <div className="text-base font-bold text-gray-400">{authUser.stats.draws}</div>
                      <div className="text-[10px] text-gray-500 uppercase tracking-wide">D</div>
                    </div>
                  </div>
                  <button
                    onClick={handleOpenLeaderboard}
                    className="w-full bg-gray-800 hover:bg-gray-700 border border-gray-600 text-gray-200 font-semibold py-2 rounded-xl text-sm transition-colors"
                  >
                    🏆 Leaderboard
                  </button>
                </div>
              ) : (
                /* Not logged in */
                <div>
                  <p className="text-xs text-gray-500 mb-3 text-center">
                    🏆 Track your wins — {authMode === 'login' ? 'Sign in' : 'Create account'}
                  </p>
                  {authError && (
                    <div className="mb-2 bg-red-900/60 border border-red-700 text-red-300 rounded-lg px-3 py-1.5 text-xs">
                      {authError}
                    </div>
                  )}
                  <div className="flex flex-col gap-2 mb-2">
                    <input
                      type="text"
                      placeholder="Username"
                      value={authUsername}
                      onChange={(e) => setAuthUsername(e.target.value)}
                      className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-blue-400 text-white placeholder:text-gray-500"
                    />
                    <input
                      type="password"
                      placeholder="Password"
                      value={authPassword}
                      onChange={(e) => setAuthPassword(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleAuth() }}
                      className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-blue-400 text-white placeholder:text-gray-500"
                    />
                  </div>
                  <button
                    onClick={handleAuth}
                    disabled={authLoading || !authUsername.trim() || !authPassword}
                    className="w-full bg-blue-700 hover:bg-blue-600 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold py-2 rounded-lg text-sm transition-colors mb-2"
                  >
                    {authLoading ? '…' : authMode === 'login' ? 'Sign In' : 'Register'}
                  </button>
                  <p className="text-center text-[11px] text-gray-600">
                    {authMode === 'login' ? (
                      <>No account?{' '}
                        <button onClick={() => { setAuthMode('register'); setAuthError(null) }} className="text-blue-500 hover:text-blue-400 underline">Register</button>
                      </>
                    ) : (
                      <>Already have one?{' '}
                        <button onClick={() => { setAuthMode('login'); setAuthError(null) }} className="text-blue-500 hover:text-blue-400 underline">Sign in</button>
                      </>
                    )}
                  </p>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

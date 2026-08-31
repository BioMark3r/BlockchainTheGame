import React, { useState, useEffect } from 'react'
import { apiProfile, type ProfileData } from '../utils/auth'
import ReplayModal from './ReplayModal'

interface Props {
  username: string
  onClose: () => void
}

function winPct(stats: ProfileData['stats']): string {
  if (stats.gamesPlayed < 3) return '—'
  return `${Math.round((stats.wins / stats.gamesPlayed) * 100)}%`
}

function resultBadge(result: 'win' | 'loss' | 'draw') {
  if (result === 'win') return <span className="text-green-400 font-bold text-xs">WIN</span>
  if (result === 'loss') return <span className="text-red-400 font-bold text-xs">LOSS</span>
  return <span className="text-gray-400 text-xs">DRAW</span>
}

function timeAgo(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime()
  const m = Math.floor(diff / 60_000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

export default function ProfileModal({ username, onClose }: Props) {
  const [profile, setProfile] = useState<ProfileData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [replayId, setReplayId] = useState<string | null>(null)

  useEffect(() => {
    apiProfile(username)
      .then(setProfile)
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load profile'))
      .finally(() => setLoading(false))
  }, [username])

  const initials = username.slice(0, 2).toUpperCase()

  return (
    <>
      {replayId && (
        <ReplayModal roomCode={replayId} onClose={() => setReplayId(null)} />
      )}
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <div className="bg-[#0a0e1a] border border-[#1e2d4a] rounded-2xl w-full max-w-sm shadow-2xl">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-700 flex items-center justify-center font-bold text-white text-sm">
                {initials}
              </div>
              <div>
                <div className="font-bold text-white">{username}</div>
                {profile && (
                  <div className="text-[10px] text-gray-500">
                    member since {new Date(profile.createdAt).toLocaleDateString()}
                  </div>
                )}
              </div>
            </div>
            <button onClick={onClose} className="text-gray-500 hover:text-gray-300 text-xl leading-none">✕</button>
          </div>

          <div className="p-5">
            {loading && <p className="text-center text-gray-500 py-8 text-sm animate-pulse">Loading…</p>}
            {error && <p className="text-center text-red-400 py-8 text-sm">{error}</p>}

            {profile && (
              <>
                {/* Stats row */}
                <div className="grid grid-cols-4 gap-2 mb-5">
                  {[
                    { label: 'Games', value: profile.stats.gamesPlayed, color: 'text-white' },
                    { label: 'Wins', value: profile.stats.wins, color: 'text-green-400' },
                    { label: 'Losses', value: profile.stats.losses, color: 'text-red-400' },
                    { label: 'Win%', value: winPct(profile.stats), color: 'text-blue-300' },
                  ].map(({ label, value, color }) => (
                    <div key={label} className="bg-gray-800/60 rounded-xl py-2 text-center">
                      <div className={`text-lg font-bold ${color}`}>{value}</div>
                      <div className="text-[10px] text-gray-500 uppercase tracking-wide">{label}</div>
                    </div>
                  ))}
                </div>

                {/* Recent games */}
                <div>
                  <h3 className="text-xs text-gray-500 uppercase tracking-widest mb-2 font-semibold">Recent Games</h3>
                  {profile.history.length === 0 ? (
                    <p className="text-center text-gray-600 text-sm py-4">No games recorded yet</p>
                  ) : (
                    <div className="space-y-1.5">
                      {profile.history.map((g, i) => (
                        <div key={i} className="flex items-center justify-between bg-gray-800/40 rounded-lg px-3 py-2">
                          <div className="flex items-center gap-2">
                            {resultBadge(g.result)}
                            {g.opponentName && (
                              <span className="text-gray-400 text-xs">vs {g.opponentName}</span>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-gray-600">{timeAgo(g.ts)}</span>
                            {g.replayId && (
                              <button
                                onClick={() => setReplayId(g.replayId!)}
                                className="text-[10px] text-purple-400 hover:text-purple-300 border border-purple-800/60 rounded px-1.5 py-0.5 transition-colors"
                              >
                                🎬
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  )
}

import React, { useState, useEffect, useCallback } from 'react'
import type { GameState, PlayerId, TurnAction } from '@shared/types'
import { applyAction, createGame } from '../../../../src/engine/index'
import ChainView from './ChainView'
import { displayName } from '../utils/display'

interface ActionLogEntry {
  action: TurnAction
  turn: number
}

interface ReplayData {
  roomCode: string
  initialPlayerIds: [PlayerId, PlayerId]
  isCpuGame: boolean
  displayNames: Record<string, string>
  actionLog: ActionLogEntry[]
  finalState: GameState
}

interface Props {
  roomCode: string
  onClose: () => void
}

function getServerBase(): string {
  const proto = window.location.protocol
  return `${proto}//${window.location.host}`
}

export default function ReplayModal({ roomCode, onClose }: Props) {
  const [replayData, setReplayData] = useState<ReplayData | null>(null)
  const [states, setStates] = useState<GameState[]>([])
  const [step, setStep] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [autoPlay, setAutoPlay] = useState(false)

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`${getServerBase()}/api/replay/${roomCode}`)
        if (!res.ok) throw new Error('Replay not available')
        const data: ReplayData = await res.json() as ReplayData
        setReplayData(data)

        // Reconstruct all states by replaying actions from initial state
        const initial = createGame(data.initialPlayerIds[0], data.initialPlayerIds[1], data.isCpuGame)
        const allStates: GameState[] = [initial]
        let cur = initial
        for (const entry of data.actionLog) {
          const result = applyAction(cur, entry.action)
          if (result.success) {
            cur = result.state
            allStates.push(cur)
          }
        }
        setStates(allStates)
        setStep(0)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load replay')
      } finally {
        setLoading(false)
      }
    }
    void load()
  }, [roomCode])

  const goTo = useCallback((s: number) => {
    setStep(Math.max(0, Math.min(s, states.length - 1)))
  }, [states.length])

  // Auto-play
  useEffect(() => {
    if (!autoPlay || states.length === 0) return
    if (step >= states.length - 1) { setAutoPlay(false); return }
    const t = setTimeout(() => goTo(step + 1), 1200)
    return () => clearTimeout(t)
  }, [autoPlay, step, states.length, goTo])

  const current = states[step]
  const names = replayData?.displayNames ?? {}

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-[#0a0e1a] border border-[#1e2d4a] rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
          <div>
            <h2 className="text-lg font-bold text-blue-400">🎬 Game Replay</h2>
            <p className="text-gray-500 text-xs mt-0.5">Room {roomCode}</p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-300 text-xl leading-none">✕</button>
        </div>

        <div className="p-6">
          {loading && (
            <div className="text-center text-gray-500 py-12 animate-pulse">Loading replay…</div>
          )}
          {error && (
            <div className="text-center text-red-400 py-12">{error}</div>
          )}

          {!loading && !error && current && (
            <>
              {/* Step info */}
              <div className="flex items-center justify-between mb-4 text-sm">
                <span className="text-gray-400">
                  Action <span className="text-white font-bold">{step}</span> / {states.length - 1}
                  {step === 0 && <span className="text-gray-600 ml-2">(start)</span>}
                  {step === states.length - 1 && <span className="text-yellow-400 ml-2">(final)</span>}
                </span>
                {step > 0 && replayData && step <= replayData.actionLog.length && (
                  <span className="text-xs text-gray-500">
                    {replayData.actionLog[step - 1]!.action.type.replace(/_/g, ' ')}
                    {' by '}
                    <span className="text-blue-300">
                      {displayName(replayData.actionLog[step - 1]!.action.playerId, replayData.actionLog[step - 1]!.action.playerId === 'cpu', names)}
                    </span>
                  </span>
                )}
              </div>

              {/* Credits */}
              <div className="flex gap-3 mb-4">
                {current.players.map((p) => (
                  <div key={p.id} className={`flex-1 rounded-xl border px-3 py-2 text-center ${current.currentTurn === p.id ? 'border-green-600/60 bg-green-950/20' : 'border-gray-700 bg-gray-900/40'}`}>
                    <div className="text-xs text-gray-500 mb-0.5">{displayName(p.id, p.isCpu, names)}</div>
                    <div className="text-xl font-bold text-blue-300">{p.credits} <span className="text-xs text-gray-500">cr</span></div>
                    <div className="text-xs text-gray-500">{p.validators.length} validators</div>
                  </div>
                ))}
              </div>

              {/* Chain */}
              <ChainView
                chain={current.chain}
                genesisCard={current.genesisCard}
                chainSplit={current.chainSplit}
                validatorRedundancyCount={current.validatorRedundancyCount}
              />

              {/* Controls */}
              <div className="flex items-center justify-center gap-3 mt-5">
                <button
                  onClick={() => { setAutoPlay(false); goTo(0) }}
                  disabled={step === 0}
                  className="bg-gray-800 hover:bg-gray-700 disabled:opacity-30 text-gray-300 px-3 py-2 rounded-lg text-sm transition-colors"
                  title="Jump to start"
                >⏮</button>
                <button
                  onClick={() => { setAutoPlay(false); goTo(step - 1) }}
                  disabled={step === 0}
                  className="bg-gray-800 hover:bg-gray-700 disabled:opacity-30 text-gray-300 px-4 py-2 rounded-lg text-sm transition-colors"
                >◀ Prev</button>
                <button
                  onClick={() => setAutoPlay(a => !a)}
                  className={`px-5 py-2 rounded-lg text-sm font-bold transition-colors ${autoPlay ? 'bg-yellow-600 hover:bg-yellow-500 text-black' : 'bg-blue-600 hover:bg-blue-500 text-white'}`}
                >
                  {autoPlay ? '⏸ Pause' : '▶ Play'}
                </button>
                <button
                  onClick={() => { setAutoPlay(false); goTo(step + 1) }}
                  disabled={step >= states.length - 1}
                  className="bg-gray-800 hover:bg-gray-700 disabled:opacity-30 text-gray-300 px-4 py-2 rounded-lg text-sm transition-colors"
                >Next ▶</button>
                <button
                  onClick={() => { setAutoPlay(false); goTo(states.length - 1) }}
                  disabled={step >= states.length - 1}
                  className="bg-gray-800 hover:bg-gray-700 disabled:opacity-30 text-gray-300 px-3 py-2 rounded-lg text-sm transition-colors"
                  title="Jump to end"
                >⏭</button>
              </div>

              {/* Scrubber */}
              <div className="mt-4 px-1">
                <input
                  type="range"
                  min={0}
                  max={states.length - 1}
                  value={step}
                  onChange={(e) => { setAutoPlay(false); goTo(parseInt(e.target.value)) }}
                  className="w-full accent-blue-500"
                />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

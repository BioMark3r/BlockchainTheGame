import { create } from 'zustand'
import type { GameState, PlayerId, TurnAction } from '@shared/types'
import { deriveLogEntries } from '../utils/gameLog'

export interface ClientMessage {
  type: 'PLAY_CARD' | 'PUBLISH_BLOCK' | 'DISCARD_REDRAW'
  payload: TurnAction
}

export interface LogEntry {
  id: string
  text: string
  icon: string
  playerId: PlayerId | null
  turn: number
}

interface GameStore {
  gameState: GameState | null
  localPlayerId: PlayerId | null
  roomCode: string | null
  playerToken: string | null
  ws: WebSocket | null
  error: string | null
  gameLog: LogEntry[]
  isReconnecting: boolean

  setGameState: (state: GameState) => void
  setLocalPlayerId: (id: PlayerId) => void
  setRoomCode: (code: string) => void
  setPlayerToken: (token: string) => void
  setWs: (ws: WebSocket | null) => void
  setError: (msg: string | null) => void
  setIsReconnecting: (v: boolean) => void
  send: (msg: unknown) => void
  clearError: () => void
  clearLog: () => void
}

export const useGameStore = create<GameStore>((set, get) => ({
  gameState: null,
  localPlayerId: null,
  roomCode: null,
  playerToken: null,
  ws: null,
  error: null,
  gameLog: [],
  isReconnecting: false,

  setGameState: (newState) => {
    const prev = get().gameState
    const newEntries = deriveLogEntries(prev, newState, get().gameLog.length)
    set((s) => ({
      gameState: newState,
      gameLog: newEntries.length > 0 ? [...s.gameLog, ...newEntries] : s.gameLog,
    }))
  },
  setLocalPlayerId: (id) => set({ localPlayerId: id }),
  setRoomCode: (code) => set({ roomCode: code }),
  setPlayerToken: (token) => set({ playerToken: token }),
  setWs: (ws) => set({ ws }),
  setError: (msg) => set({ error: msg }),
  setIsReconnecting: (v) => set({ isReconnecting: v }),
  clearError: () => set({ error: null }),
  clearLog: () => set({ gameLog: [] }),

  send: (msg) => {
    const { ws } = get()
    if (!ws || ws.readyState !== WebSocket.OPEN) return
    ws.send(JSON.stringify(msg))
  },
}))

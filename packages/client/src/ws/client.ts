import { useGameStore } from '../store/gameStore'
import type { PlayerId, GameState, CpuDifficulty } from '@shared/types'

type ServerMessage =
  | { type: 'ROOM_CREATED';    roomCode: string; playerToken: string; playerId: PlayerId }
  | { type: 'ROOM_JOINED';     roomCode: string; playerToken: string; playerId: PlayerId }
  | { type: 'GAME_STARTED';    state: GameState; displayNames?: Record<string, string> }
  | { type: 'GAME_STATE';      state: GameState; displayNames?: Record<string, string> }
  | { type: 'WAITING_FOR_PLAYER' }
  | { type: 'ERROR';           message: string }
  | { type: 'REMATCH_CREATED'; roomCode: string; playerToken: string }
  | { type: 'REMATCH_INVITE';  roomCode: string }

// Connect via the same host+port that served the page, on the /ws path.
// nginx (Docker) and Vite (dev) both proxy /ws → the WebSocket server.
// This means only port 80/443 needs to be open — no separate port 3001.
// Override VITE_WS_URL at build time only if you need a completely different host.
const _proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
const WS_URL = import.meta.env.VITE_WS_URL ?? `${_proto}//${window.location.host}/ws`

// ---------------------------------------------------------------------------
// sessionStorage helpers
// ---------------------------------------------------------------------------

const KEYS = {
  roomCode:    'btg_roomCode',
  playerToken: 'btg_playerToken',
  playerId:    'btg_playerId',
} as const

function saveReconnectInfo(roomCode: string, playerToken: string, playerId: string): void {
  sessionStorage.setItem(KEYS.roomCode,    roomCode)
  sessionStorage.setItem(KEYS.playerToken, playerToken)
  sessionStorage.setItem(KEYS.playerId,    playerId)
}

export function clearReconnectStorage(): void {
  sessionStorage.removeItem(KEYS.roomCode)
  sessionStorage.removeItem(KEYS.playerToken)
  sessionStorage.removeItem(KEYS.playerId)
}

// ---------------------------------------------------------------------------
// Main connection
// ---------------------------------------------------------------------------

export function connectWebSocket(action: 'create' | 'join', roomCode: string, vsCpu: boolean, playerDisplayName?: string, difficulty?: CpuDifficulty): WebSocket {
  const ws = new WebSocket(WS_URL)

  ws.addEventListener('open', () => {
    useGameStore.getState().setWs(ws)
    useGameStore.getState().setError(null)

    if (action === 'create') {
      ws.send(JSON.stringify({ type: 'CREATE_ROOM', vsComp: vsCpu, difficulty, displayName: playerDisplayName }))
    } else {
      ws.send(JSON.stringify({ type: 'JOIN_ROOM', roomCode, displayName: playerDisplayName }))
    }
  })

  ws.addEventListener('message', (event: MessageEvent<string>) => {
    let msg: ServerMessage
    try {
      msg = JSON.parse(event.data) as ServerMessage
    } catch {
      console.error('Failed to parse server message', event.data)
      return
    }

    const store = useGameStore.getState()

    switch (msg.type) {
      case 'ROOM_CREATED':
        store.setRoomCode(msg.roomCode)
        store.setPlayerToken(msg.playerToken)
        store.setLocalPlayerId(msg.playerId)
        saveReconnectInfo(msg.roomCode, msg.playerToken, msg.playerId)
        break
      case 'ROOM_JOINED':
        store.setRoomCode(msg.roomCode)
        store.setPlayerToken(msg.playerToken)
        store.setLocalPlayerId(msg.playerId)
        saveReconnectInfo(msg.roomCode, msg.playerToken, msg.playerId)
        break
      case 'GAME_STARTED':
        store.clearLog()
        store.setGameState(msg.state)
        store.setIsRematching(false)
        if (msg.displayNames) store.setPlayerNames(msg.displayNames)
        break
      case 'GAME_STATE':
        store.setGameState(msg.state)
        if (msg.displayNames) store.setPlayerNames(msg.displayNames)
        break
      case 'WAITING_FOR_PLAYER':
        // no-op — lobby shows "waiting" based on roomCode being set with no gameState
        break
      case 'ERROR':
        store.setError(msg.message)
        break
      case 'REMATCH_CREATED':
        useGameStore.setState({ roomCode: msg.roomCode, playerToken: msg.playerToken, gameState: null, gameLog: [], isRematching: false })
        saveReconnectInfo(msg.roomCode, msg.playerToken, store.localPlayerId ?? 'player1')
        break
      case 'REMATCH_INVITE':
        // Player 2 auto-joins the new room
        ws.send(JSON.stringify({ type: 'JOIN_ROOM', roomCode: msg.roomCode }))
        break
    }
  })

  ws.addEventListener('close', () => {
    const store = useGameStore.getState()
    const { gameState } = store
    const isActiveMidGame = gameState !== null && gameState.phase === 'playing'

    if (isActiveMidGame) {
      // Stay in game view but signal that we're trying to reconnect
      store.setIsReconnecting(true)
    } else {
      clearReconnectStorage()
    }

    store.setWs(null)
  })

  ws.addEventListener('error', () => {
    useGameStore.getState().setError('WebSocket connection error. Check the server is running.')
  })

  return ws
}

// ---------------------------------------------------------------------------
// Rejoin
// ---------------------------------------------------------------------------

export function attemptRejoin(): boolean {
  const storedRoomCode    = sessionStorage.getItem(KEYS.roomCode)
  const storedPlayerToken = sessionStorage.getItem(KEYS.playerToken)
  const storedPlayerId    = sessionStorage.getItem(KEYS.playerId)

  if (!storedRoomCode || !storedPlayerToken || !storedPlayerId) {
    return false
  }

  const ws = new WebSocket(WS_URL)

  ws.addEventListener('open', () => {
    ws.send(JSON.stringify({ type: 'REJOIN', roomCode: storedRoomCode, playerToken: storedPlayerToken }))
  })

  ws.addEventListener('message', (event: MessageEvent<string>) => {
    let msg: ServerMessage
    try {
      msg = JSON.parse(event.data) as ServerMessage
    } catch {
      console.error('Failed to parse rejoin server message', event.data)
      return
    }

    const store = useGameStore.getState()

    switch (msg.type) {
      case 'GAME_STATE': {
        store.setLocalPlayerId(storedPlayerId as PlayerId)
        store.setWs(ws)
        store.setGameState(msg.state)
        store.setIsReconnecting(false)
        break
      }
      case 'ERROR': {
        clearReconnectStorage()
        store.setIsReconnecting(false)
        store.setError(msg.message)
        ws.close()
        break
      }
      default:
        break
    }
  })

  ws.addEventListener('close', () => {
    const store = useGameStore.getState()
    const { gameState } = store
    const isActiveMidGame = gameState !== null && gameState.phase === 'playing'

    if (isActiveMidGame) {
      store.setIsReconnecting(true)
    } else {
      clearReconnectStorage()
    }

    // Only null out ws if it's still this socket
    if (store.ws === ws) {
      store.setWs(null)
    }
  })

  ws.addEventListener('error', () => {
    useGameStore.getState().setError('WebSocket connection error during rejoin.')
  })

  return true
}

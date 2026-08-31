import { useGameStore } from '../store/gameStore'
import type { PlayerId, GameState, CpuDifficulty } from '@shared/types'
import { randomUUID } from '../utils/uuid'

type ServerMessage =
  | { type: 'ROOM_CREATED';    roomCode: string; playerToken: string; playerId: PlayerId }
  | { type: 'ROOM_JOINED';     roomCode: string; playerToken: string; playerId: PlayerId }
  | { type: 'GAME_STARTED';    state: GameState; displayNames?: Record<string, string>; spectating?: boolean }
  | { type: 'GAME_STATE';      state: GameState; displayNames?: Record<string, string>; spectating?: boolean }
  | { type: 'WAITING_FOR_PLAYER' }
  | { type: 'ERROR';           message: string }
  | { type: 'REMATCH_CREATED'; roomCode: string; playerToken: string }
  | { type: 'REMATCH_INVITE';  roomCode: string }
  | { type: 'CHAT_MSG';          senderId: string; senderName: string; text: string; ts: number }
  | { type: 'EMOTE_BROADCAST';   emote: string; senderName: string }

// Always derive the WebSocket URL at runtime from window.location.
// Both Vite dev (proxy config) and Docker/nginx (location /ws) route this correctly.
// Using window.location means nothing is baked into the bundle at build time,
// so the same image works on any hostname without rebuilding.
function getWsUrl(): string {
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  return `${proto}//${window.location.host}/ws`
}
const WS_URL = getWsUrl()

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
        store.clearChat()
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
      case 'CHAT_MSG':
        store.addChatMessage({ id: randomUUID(), senderId: msg.senderId, senderName: msg.senderName, text: msg.text, ts: msg.ts })
        break
      case 'EMOTE_BROADCAST': {
        const id = randomUUID()
        const x = Math.floor(Math.random() * 70) + 10
        store.addEmoteBubble({ id, emote: msg.emote, senderName: msg.senderName, x })
        setTimeout(() => store.removeEmoteBubble(id), 2500)
        break
      }
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
// Spectate
// ---------------------------------------------------------------------------

export function connectSpectator(roomCode: string): WebSocket {
  const ws = new WebSocket(WS_URL)

  ws.addEventListener('open', () => {
    useGameStore.getState().setWs(ws)
    useGameStore.getState().setError(null)
    ws.send(JSON.stringify({ type: 'SPECTATE', roomCode: roomCode.toUpperCase() }))
  })

  ws.addEventListener('message', (event: MessageEvent<string>) => {
    let msg: ServerMessage
    try {
      msg = JSON.parse(event.data) as ServerMessage
    } catch {
      return
    }

    const store = useGameStore.getState()

    switch (msg.type) {
      case 'GAME_STATE':
      case 'GAME_STARTED':
        store.setGameState(msg.state)
        store.setIsSpectator(true)
        if (msg.displayNames) store.setPlayerNames(msg.displayNames)
        break
      case 'ERROR':
        store.setError(msg.message)
        break
      case 'CHAT_MSG':
        store.addChatMessage({ id: randomUUID(), senderId: msg.senderId, senderName: msg.senderName, text: msg.text, ts: msg.ts })
        break
      case 'EMOTE_BROADCAST': {
        const id = randomUUID()
        const x = Math.floor(Math.random() * 70) + 10
        store.addEmoteBubble({ id, emote: msg.emote, senderName: msg.senderName, x })
        setTimeout(() => store.removeEmoteBubble(id), 2500)
        break
      }
      default:
        break
    }
  })

  ws.addEventListener('close', () => {
    useGameStore.getState().setWs(null)
  })

  ws.addEventListener('error', () => {
    useGameStore.getState().setError('Spectator connection error.')
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

import { useGameStore } from '../store/gameStore'
import type { PlayerId, GameState } from '@shared/types'

type ServerMessage =
  | { type: 'ROOM_CREATED'; roomCode: string; playerToken: string; playerId: PlayerId }
  | { type: 'ROOM_JOINED';  roomCode: string; playerToken: string; playerId: PlayerId }
  | { type: 'GAME_STARTED'; state: GameState }
  | { type: 'GAME_STATE';   state: GameState }
  | { type: 'WAITING_FOR_PLAYER' }
  | { type: 'ERROR';        message: string }

export function connectWebSocket(action: 'create' | 'join', roomCode: string, vsCpu: boolean): WebSocket {
  const ws = new WebSocket(`ws://localhost:3001`)

  ws.addEventListener('open', () => {
    useGameStore.getState().setWs(ws)
    useGameStore.getState().setError(null)

    if (action === 'create') {
      ws.send(JSON.stringify({ type: 'CREATE_ROOM', vsComp: vsCpu }))
    } else {
      ws.send(JSON.stringify({ type: 'JOIN_ROOM', roomCode }))
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
        break
      case 'ROOM_JOINED':
        store.setRoomCode(msg.roomCode)
        store.setPlayerToken(msg.playerToken)
        store.setLocalPlayerId(msg.playerId)
        break
      case 'GAME_STARTED':
        store.clearLog()
        store.setGameState(msg.state)
        break
      case 'GAME_STATE':
        store.setGameState(msg.state)
        break
      case 'WAITING_FOR_PLAYER':
        // no-op — lobby shows "waiting" based on roomCode being set with no gameState
        break
      case 'ERROR':
        store.setError(msg.message)
        break
    }
  })

  ws.addEventListener('close', () => {
    useGameStore.getState().setWs(null)
  })

  ws.addEventListener('error', () => {
    useGameStore.getState().setError('WebSocket connection error. Check the server is running.')
  })

  return ws
}

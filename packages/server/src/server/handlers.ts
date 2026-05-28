import { randomUUID } from 'crypto'
import type { WebSocket } from 'ws'
import { createGame, applyAction } from '../../../../src/engine/index.js'
import type { GameState, TurnAction } from '../../../../src/shared/types.js'
import type { Room, RoomPlayer } from './rooms.js'
import { RoomManager } from './rooms.js'
import { ReconnectManager } from './reconnect.js'
import { triggerCpuTurn } from './ai.js'

// ---------------------------------------------------------------------------
// Message shapes (incoming)
// ---------------------------------------------------------------------------

interface CreateRoomMsg { type: 'CREATE_ROOM'; vsComp: boolean; displayName?: string }
interface JoinRoomMsg   { type: 'JOIN_ROOM';   roomCode: string; displayName?: string }
interface RejoinMsg     { type: 'REJOIN';       roomCode: string; playerToken: string }
interface ActionMsg     { type: 'ACTION';       action: TurnAction }
interface ConcedeMsg    { type: 'CONCEDE' }

type IncomingMsg = CreateRoomMsg | JoinRoomMsg | RejoinMsg | ActionMsg | ConcedeMsg

// ---------------------------------------------------------------------------
// Turn timer
// ---------------------------------------------------------------------------

const TURN_TIMEOUT_MS = 60_000

function clearTurnTimer(room: Room): void {
  if (room.turnTimer) {
    clearTimeout(room.turnTimer)
    room.turnTimer = null
  }
}

function startTurnTimer(room: Room): void {
  clearTurnTimer(room)
  if (!room.gameState || room.gameState.phase !== 'playing') return

  const activePlayerId = room.gameState.currentTurn
  // Skip CPU turns — they act immediately via triggerCpuTurn
  const activePlayer = room.gameState.players.find(p => p.id === activePlayerId)
  if (activePlayer?.isCpu) return

  room.turnTimer = setTimeout(() => {
    if (!room.gameState || room.gameState.phase !== 'playing') return
    if (room.gameState.currentTurn !== activePlayerId) return

    // Auto-skip: discard 0 cards (just advances turn + draws to 5)
    const result = applyAction(room.gameState, {
      type: 'DISCARD_REDRAW',
      playerId: activePlayerId,
      cardIdsToDiscard: [],
    })
    if (result.success) {
      room.gameState = result.state
      broadcastState(room, result.state)
      if (result.state.phase === 'playing') {
        startTurnTimer(room) // start timer for next player
      }
    }
  }, TURN_TIMEOUT_MS)
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function send(ws: WebSocket, payload: unknown): void {
  if (ws.readyState === ws.OPEN) {
    ws.send(JSON.stringify(payload))
  }
}

function sendError(ws: WebSocket, message: string): void {
  send(ws, { type: 'ERROR', message })
}

function getDisplayNames(room: Room): Record<string, string> {
  const names: Record<string, string> = {}
  for (const p of room.players) {
    if (p) names[p.playerId] = p.displayName
  }
  return names
}

/** Broadcast the current game state to all human players in a room */
function broadcastState(room: Room, state: GameState): void {
  const payload = { type: 'GAME_STATE', state, displayNames: getDisplayNames(room) }
  for (const player of room.players) {
    if (player && !player.isCpu && player.ws) {
      send(player.ws, payload)
    }
  }
}

/** Start the game for a fully-populated room */
function startGame(room: Room, rooms: RoomManager, reconnect: ReconnectManager): void {
  const [p1, p2] = room.players
  if (!p1 || !p2) return

  const state = createGame(p1.playerId, p2.playerId, p2.isCpu)
  room.gameState = state

  const startPayload = { type: 'GAME_STARTED', state, displayNames: getDisplayNames(room) }
  for (const player of room.players) {
    if (player && !player.isCpu && player.ws) {
      send(player.ws, startPayload)
    }
  }

  // If it's the CPU's first turn, kick off its loop; otherwise start human turn timer
  if (p2.isCpu && state.currentTurn === p2.playerId) {
    setTimeout(() => {
      triggerCpuTurn(room, broadcastState)
      if (room.gameState && room.gameState.phase === 'playing') {
        startTurnTimer(room)
      }
    }, 500)
  } else {
    startTurnTimer(room)
  }
}

/** Fill slot 2 with the CPU and immediately start the game */
function fillCpuAndStart(room: Room, rooms: RoomManager, reconnect: ReconnectManager): void {
  room.players[1] = {
    playerId: 'cpu',
    playerToken: randomUUID(), // not used for auth but keeps type consistent
    isCpu: true,
    ws: null,
    displayName: '🤖 CPU',
  }
  room.cpuSlot = true
  startGame(room, rooms, reconnect)
}

const WAITING_INTERVAL_MS = 5_000
const AUTO_CPU_DELAY_MS   = 30_000

// ---------------------------------------------------------------------------
// Handler entry points
// ---------------------------------------------------------------------------

export function handleCreateRoom(
  ws: WebSocket,
  msg: CreateRoomMsg,
  rooms: RoomManager,
  reconnect: ReconnectManager,
): void {
  const { room, playerToken } = rooms.createRoom(msg.vsComp)

  // Attach the creator's WebSocket and set display name
  room.players[0]!.ws = ws
  room.players[0]!.displayName = msg.displayName ?? 'Player 1'

  send(ws, {
    type: 'ROOM_CREATED',
    roomCode: room.code,
    playerToken,
    playerId: 'player1',
  })

  if (msg.vsComp) {
    // vs CPU — fill immediately and start
    fillCpuAndStart(room, rooms, reconnect)
  } else {
    // vs human — send periodic WAITING_FOR_PLAYER, auto-fill CPU at 30s
    room.waitingTimer = setInterval(() => {
      send(ws, { type: 'WAITING_FOR_PLAYER' })
    }, WAITING_INTERVAL_MS)

    room.autoCpuTimer = setTimeout(() => {
      if (room.waitingTimer !== null) {
        clearInterval(room.waitingTimer)
        room.waitingTimer = null
      }
      room.autoCpuTimer = null
      fillCpuAndStart(room, rooms, reconnect)
    }, AUTO_CPU_DELAY_MS)
  }
}

export function handleJoinRoom(
  ws: WebSocket,
  msg: JoinRoomMsg,
  rooms: RoomManager,
  reconnect: ReconnectManager,
): void {
  const result = rooms.joinRoom(msg.roomCode)
  if (!result.ok) {
    sendError(ws, result.error)
    return
  }

  const { room, playerToken } = result
  room.players[1]!.ws = ws
  room.players[1]!.displayName = msg.displayName ?? 'Player 2'

  send(ws, {
    type: 'ROOM_JOINED',
    roomCode: room.code,
    playerToken,
    playerId: 'player2',
  })

  startGame(room, rooms, reconnect)
}

export function handleRejoin(
  ws: WebSocket,
  msg: RejoinMsg,
  rooms: RoomManager,
  reconnect: ReconnectManager,
): void {
  const result = reconnect.rejoin(msg.roomCode, msg.playerToken, ws)
  if (!result.ok) {
    sendError(ws, result.error)
    return
  }

  const room = rooms.getRoom(msg.roomCode)!
  if (room.gameState) {
    send(ws, { type: 'GAME_STATE', state: room.gameState })
  }
}

export function handlePlayerAction(
  ws: WebSocket,
  msg: ActionMsg,
  playerToken: string,
  rooms: RoomManager,
  reconnect: ReconnectManager,
): void {
  // Find the room this player belongs to
  let foundRoom: Room | undefined
  let foundPlayer: RoomPlayer | undefined

  // We need to locate the room by matching the playerToken
  // Iterate all rooms — in practice <1000 rooms so this is fine
  for (const [, room] of rooms.allRooms()) {
    for (const p of room.players) {
      if (p && p.playerToken === playerToken) {
        foundRoom = room
        foundPlayer = p
        break
      }
    }
    if (foundRoom) break
  }

  if (!foundRoom || !foundPlayer || !foundRoom.gameState) {
    sendError(ws, 'Room or game not found')
    return
  }

  const room = foundRoom
  const action = msg.action

  // Validate that the acting playerId matches this connection's playerId
  if (action.playerId !== foundPlayer.playerId) {
    sendError(ws, 'Action playerId does not match your player identity')
    return
  }

  if (!room.gameState) {
    sendError(ws, 'Game has not started yet')
    return
  }
  const result = applyAction(room.gameState, action)
  if (!result.success) {
    sendError(ws, result.error ?? 'Invalid action')
    return
  }

  room.gameState = result.state
  broadcastState(room, result.state)

  // Schedule room cleanup after game ends (cancel reconnect timers first)
  if (result.state.phase === 'ended') {
    clearTurnTimer(room)
    setTimeout(() => {
      reconnect.cancelAllForRoom(room.code)
      rooms.destroyRoom(room.code)
    }, 60_000)
    return
  }

  // Trigger CPU turn if it's now the CPU's turn, otherwise start human turn timer
  if (result.state.phase === 'playing') {
    const cpuPlayer = room.players.find((p) => p?.isCpu)
    if (cpuPlayer && result.state.currentTurn === cpuPlayer.playerId) {
      setTimeout(() => {
        triggerCpuTurn(room, broadcastState)
        // After CPU turn, start timer for next human turn (if game still playing)
        if (room.gameState && room.gameState.phase === 'playing') {
          startTurnTimer(room)
        }
      }, 500)
    } else {
      startTurnTimer(room)
    }
  }
}

export function handleConcede(
  ws: WebSocket,
  playerToken: string,
  rooms: RoomManager,
  reconnect: ReconnectManager,
): void {
  let foundRoom: Room | undefined
  let foundPlayer: RoomPlayer | undefined

  for (const [, room] of rooms.allRooms()) {
    for (const p of room.players) {
      if (p && p.playerToken === playerToken) {
        foundRoom = room
        foundPlayer = p
        break
      }
    }
    if (foundRoom) break
  }

  if (!foundRoom || !foundPlayer || !foundRoom.gameState) {
    sendError(ws, 'Room or game not found')
    return
  }

  if (foundRoom.gameState.phase !== 'playing') {
    sendError(ws, 'Game is not in progress')
    return
  }

  const room = foundRoom
  const concedingId = foundPlayer.playerId
  const otherPlayer = room.players.find((p) => p && p.playerId !== concedingId)
  if (!otherPlayer) {
    sendError(ws, 'Opponent not found')
    return
  }

  const prevState = room.gameState!
  room.gameState = {
    phase: 'ended',
    players: prevState.players,
    currentTurn: prevState.currentTurn,
    chain: prevState.chain,
    chainSplit: prevState.chainSplit,
    validatorRedundancyCount: prevState.validatorRedundancyCount,
    winner: otherPlayer.playerId,
    forkReason: 'fork_card',
    genesisCard: prevState.genesisCard,
  }

  clearTurnTimer(room)
  broadcastState(room, room.gameState!)

  setTimeout(() => {
    reconnect.cancelAllForRoom(room.code)
    rooms.destroyRoom(room.code)
  }, 60_000)
}

// ---------------------------------------------------------------------------
// Top-level message dispatcher
// Attached per-connection in index.ts
// ---------------------------------------------------------------------------

export function createMessageHandler(
  ws: WebSocket,
  rooms: RoomManager,
  reconnect: ReconnectManager,
) {
  /** playerToken of this connection once they have created/joined/rejoined */
  let myToken: string | null = null

  return function onMessage(raw: string): void {
    let msg: IncomingMsg
    try {
      msg = JSON.parse(raw) as IncomingMsg
    } catch {
      sendError(ws, 'Invalid JSON')
      return
    }

    switch (msg.type) {
      case 'CREATE_ROOM': {
        handleCreateRoom(ws, msg, rooms, reconnect)
        // After CREATE_ROOM the server sends ROOM_CREATED which includes the token —
        // the client will use it for subsequent ACTION messages, but we also cache it here
        // by peeking at the room just created.
        // We find the new room by checking which room has this ws as player1.
        for (const [, room] of rooms.allRooms()) {
          if (room.players[0]?.ws === ws) {
            myToken = room.players[0].playerToken
            break
          }
        }
        break
      }
      case 'JOIN_ROOM': {
        handleJoinRoom(ws, msg, rooms, reconnect)
        for (const [, room] of rooms.allRooms()) {
          if (room.players[1]?.ws === ws) {
            myToken = room.players[1].playerToken
            break
          }
        }
        break
      }
      case 'REJOIN': {
        myToken = msg.playerToken
        handleRejoin(ws, msg, rooms, reconnect)
        break
      }
      case 'ACTION': {
        if (!myToken) {
          sendError(ws, 'Not authenticated — send CREATE_ROOM or JOIN_ROOM first')
          return
        }
        handlePlayerAction(ws, msg, myToken, rooms, reconnect)
        break
      }
      case 'CONCEDE': {
        if (!myToken) {
          sendError(ws, 'Not authenticated — send CREATE_ROOM or JOIN_ROOM first')
          return
        }
        handleConcede(ws, myToken, rooms, reconnect)
        break
      }
      default: {
        sendError(ws, `Unknown message type`)
      }
    }
  }
}

import { randomUUID } from 'crypto'
import type { WebSocket } from 'ws'
import type { GameState, PlayerId, CpuDifficulty } from '../../../../src/shared/types.js'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RoomPlayer {
  playerId: PlayerId
  playerToken: string
  isCpu: boolean
  ws: WebSocket | null
  displayName: string
}

export interface Room {
  code: string
  /** Slot 0 = player1, slot 1 = player2 / cpu */
  players: [RoomPlayer, RoomPlayer | null]
  gameState: GameState | null
  cpuSlot: boolean
  /** Timer that fires every 5s to send WAITING_FOR_PLAYER, cancelled at 30s */
  waitingTimer: ReturnType<typeof setInterval> | null
  /** Timer that auto-fills CPU after 30s when no human joins */
  autoCpuTimer: ReturnType<typeof setTimeout> | null
  /** Timer that auto-skips the active player's turn after 60s */
  turnTimer: ReturnType<typeof setTimeout> | null
  /** CPU difficulty level */
  cpuDifficulty: CpuDifficulty
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function randomRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // no I/O/0/1 ambiguity
  let code = ''
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)]
  }
  return code
}

// ---------------------------------------------------------------------------
// RoomManager
// ---------------------------------------------------------------------------

export class RoomManager {
  private rooms = new Map<string, Room>()

  createRoom(vsComp: boolean): { room: Room; playerToken: string } {
    let code: string
    do {
      code = randomRoomCode()
    } while (this.rooms.has(code))

    const playerToken = randomUUID()

    const room: Room = {
      code,
      players: [
        { playerId: 'player1', playerToken, isCpu: false, ws: null, displayName: 'Player 1' },
        null,
      ],
      gameState: null,
      cpuSlot: vsComp,
      waitingTimer: null,
      autoCpuTimer: null,
      turnTimer: null,
      cpuDifficulty: 'normal',
    }

    this.rooms.set(code, room)
    return { room, playerToken }
  }

  joinRoom(
    roomCode: string,
  ): { ok: true; room: Room; playerToken: string } | { ok: false; error: string } {
    const room = this.rooms.get(roomCode)
    if (!room) return { ok: false, error: `Room ${roomCode} not found` }
    if (room.players[1] !== null) return { ok: false, error: 'Room is already full' }
    if (room.cpuSlot) return { ok: false, error: 'Room is CPU-only' }

    const playerToken = randomUUID()
    room.players[1] = { playerId: 'player2', playerToken, isCpu: false, ws: null, displayName: 'Player 2' }

    // Cancel the waiting / auto-cpu timers since a human joined
    if (room.waitingTimer !== null) {
      clearInterval(room.waitingTimer)
      room.waitingTimer = null
    }
    if (room.autoCpuTimer !== null) {
      clearTimeout(room.autoCpuTimer)
      room.autoCpuTimer = null
    }

    return { ok: true, room, playerToken }
  }

  getRoom(roomCode: string): Room | undefined {
    return this.rooms.get(roomCode)
  }

  /** Iterate all rooms — used by handlers to locate a room by ws/token */
  allRooms(): IterableIterator<[string, Room]> {
    return this.rooms.entries()
  }

  destroyRoom(roomCode: string): void {
    const room = this.rooms.get(roomCode)
    if (!room) return
    // Cancel any lingering timers
    if (room.waitingTimer !== null) clearInterval(room.waitingTimer)
    if (room.autoCpuTimer !== null) clearTimeout(room.autoCpuTimer)
    if (room.turnTimer !== null) clearTimeout(room.turnTimer)
    this.rooms.delete(roomCode)
  }
}

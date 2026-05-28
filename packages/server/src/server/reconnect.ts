import type { WebSocket } from 'ws'
import type { RoomManager, RoomPlayer } from './rooms.js'

const RECONNECT_TIMEOUT_MS = 60_000

export class ReconnectManager {
  /** roomCode+playerId -> timer handle */
  private timers = new Map<string, ReturnType<typeof setTimeout>>()

  constructor(private rooms: RoomManager) {}

  private key(roomCode: string, playerId: string): string {
    return `${roomCode}:${playerId}`
  }

  /**
   * Called when a player's WebSocket closes. Starts a 60s countdown; if the
   * player does not rejoin the room is destroyed (with all its timers cleaned).
   */
  holdState(roomCode: string, playerId: string): void {
    const k = this.key(roomCode, playerId)
    // Clear any existing timer for this slot first
    this.cancelTimer(k)

    const timer = setTimeout(() => {
      this.timers.delete(k)
      const room = this.rooms.getRoom(roomCode)
      if (room) {
        // Cancel all other pending timers for this room before destroying it
        for (const player of room.players) {
          if (player) {
            const otherKey = this.key(roomCode, player.playerId)
            this.cancelTimer(otherKey)
          }
        }
        this.rooms.destroyRoom(roomCode)
      }
    }, RECONNECT_TIMEOUT_MS)

    this.timers.set(k, timer)
  }

  /**
   * Called on REJOIN. Validates the token, cancels the pending timer, re-attaches
   * the new WebSocket, and returns the current GameState for the caller to relay.
   * Returns an error string on failure.
   */
  rejoin(
    roomCode: string,
    playerToken: string,
    ws: WebSocket,
  ): { ok: true; player: RoomPlayer } | { ok: false; error: string } {
    const room = this.rooms.getRoom(roomCode)
    if (!room) return { ok: false, error: `Room ${roomCode} not found` }

    const player = room.players.find((p) => p?.playerToken === playerToken)
    if (!player) return { ok: false, error: 'Invalid player token' }

    const k = this.key(roomCode, player.playerId)
    this.cancelTimer(k)

    // Re-attach the new WebSocket
    player.ws = ws

    return { ok: true, player }
  }

  /**
   * Cancel all timers associated with a room (called when the room is explicitly
   * destroyed, e.g. after game end garbage collection).
   */
  cancelAllForRoom(roomCode: string): void {
    const room = this.rooms.getRoom(roomCode)
    if (!room) return
    for (const player of room.players) {
      if (player) {
        this.cancelTimer(this.key(roomCode, player.playerId))
      }
    }
  }

  private cancelTimer(k: string): void {
    const existing = this.timers.get(k)
    if (existing !== undefined) {
      clearTimeout(existing)
      this.timers.delete(k)
    }
  }
}

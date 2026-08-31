import { createServer } from 'http'
import { WebSocketServer, WebSocket } from 'ws'
import { RoomManager } from './rooms.js'
import { ReconnectManager } from './reconnect.js'
import { createMessageHandler } from './handlers.js'
import { checkRateLimit } from './rateLimit.js'
import { handleLeaderboardRoute } from './leaderboard.js'
import { loadReplay } from './replay.js'
import type { ServerResponse } from 'http'

const PORT = parseInt(process.env['PORT'] ?? '3001', 10)

function jsonResponse(res: ServerResponse, status: number, data: unknown): void {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.writeHead(status, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(data))
}

const httpServer = createServer(async (req, res) => {
  const url = req.url ?? ''

  // Replay endpoint — GET /api/replay/:roomCode (checks live room first, then disk)
  const replayMatch = url.match(/^\/api\/replay\/([A-Z0-9]{6})$/)
  if (req.method === 'GET' && replayMatch) {
    const roomCode = replayMatch[1]!
    const room = rooms.getRoom(roomCode)
    if (room && room.gameState && room.initialPlayerIds) {
      jsonResponse(res, 200, {
        roomCode,
        initialPlayerIds: room.initialPlayerIds,
        isCpuGame: room.cpuSlot,
        displayNames: Object.fromEntries(
          room.players.filter(Boolean).map((p) => [p!.playerId, p!.displayName])
        ),
        actionLog: room.actionLog,
        finalState: room.gameState,
      })
      return
    }
    // Room not in memory — try disk
    const saved = loadReplay(roomCode)
    if (!saved) {
      jsonResponse(res, 404, { error: 'Replay not found' })
      return
    }
    jsonResponse(res, 200, saved)
    return
  }

  const handled = await handleLeaderboardRoute(req, res)
  if (handled) return
  res.writeHead(200, { 'Content-Type': 'text/plain' })
  res.end('Blockchain: The Game — WebSocket server\n')
})

const wss = new WebSocketServer({ server: httpServer })

const rooms = new RoomManager()
const reconnect = new ReconnectManager(rooms)

wss.on('connection', (ws: WebSocket) => {
  console.log('[WS] Client connected')

  const onMessage = createMessageHandler(ws, rooms, reconnect)

  ws.on('message', (data) => {
    if (!checkRateLimit(ws)) {
      ws.send(JSON.stringify({ type: 'ERROR', message: 'Rate limit exceeded. Please slow down.' }))
      return
    }
    const raw = data.toString()
    onMessage(raw)
  })

  ws.on('close', () => {
    console.log('[WS] Client disconnected')
    // Find which room+player this ws belongs to and start reconnect hold timer
    for (const [roomCode, room] of rooms.allRooms()) {
      for (const player of room.players) {
        if (player && player.ws === ws) {
          console.log(`[WS] Starting reconnect timer for ${player.playerId} in room ${roomCode}`)
          player.ws = null
          reconnect.holdState(roomCode, player.playerId)
          return
        }
      }
    }
    // If not a player, remove from spectators
    rooms.removeSpectator(ws)
  })

  ws.on('error', (err) => {
    console.error('[WS] Socket error:', err)
  })
})

httpServer.listen(PORT, () => {
  console.log(`[Server] Listening on http://localhost:${PORT}`)
  console.log(`[Server] WebSocket endpoint: ws://localhost:${PORT}`)
})

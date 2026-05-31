import { createServer } from 'http'
import { WebSocketServer, WebSocket } from 'ws'
import { RoomManager } from './rooms.js'
import { ReconnectManager } from './reconnect.js'
import { createMessageHandler } from './handlers.js'
import { checkRateLimit } from './rateLimit.js'
import { handleLeaderboardRoute } from './leaderboard.js'

const PORT = parseInt(process.env['PORT'] ?? '3001', 10)

const httpServer = createServer(async (req, res) => {
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
  })

  ws.on('error', (err) => {
    console.error('[WS] Socket error:', err)
  })
})

httpServer.listen(PORT, () => {
  console.log(`[Server] Listening on http://localhost:${PORT}`)
  console.log(`[Server] WebSocket endpoint: ws://localhost:${PORT}`)
})

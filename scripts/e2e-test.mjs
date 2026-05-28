import pkg from '../node_modules/ws/index.js'
const { WebSocket } = pkg

const WS_URL = 'ws://localhost:3001'
const TIMEOUT_MS = 5000

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function connect() {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(WS_URL)
    ws.on('open', () => resolve(ws))
    ws.on('error', reject)
  })
}

/**
 * Wait for the next WebSocket message of the given type.
 * If type is null, returns any next message.
 * Rejects on timeout or if an ERROR message is received.
 */
function waitForMessage(ws, type) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      ws.removeListener('message', onMsg)
      reject(new Error(`Timeout waiting for message type: ${type}`))
    }, TIMEOUT_MS)

    function onMsg(raw) {
      let msg
      try { msg = JSON.parse(raw) } catch { return }

      if (msg.type === 'ERROR') {
        clearTimeout(timer)
        ws.removeListener('message', onMsg)
        reject(new Error(`Server ERROR: ${msg.message}`))
        return
      }

      if (type === null || msg.type === type) {
        clearTimeout(timer)
        ws.removeListener('message', onMsg)
        resolve(msg)
      }
    }

    ws.on('message', onMsg)
  })
}

function send(ws, payload) {
  ws.send(JSON.stringify(payload))
}

// ---------------------------------------------------------------------------
// Action selection logic
// ---------------------------------------------------------------------------

function pickAction(state, playerId) {
  const playerState = state.players.find(p => p.id === playerId)
  if (!playerState) throw new Error(`Player ${playerId} not found in state`)
  const hand = playerState.hand

  // Priority a: 3+ TRANSACTION cards → PUBLISH_BLOCK with first 3
  const txCards = hand.filter(c => c.type === 'TRANSACTION')
  if (txCards.length >= 3) {
    return {
      type: 'PUBLISH_BLOCK',
      playerId,
      cardIds: [txCards[0].id, txCards[1].id, txCards[2].id],
    }
  }

  // Priority b: has VALIDATOR → PLAY_CARD
  const validator = hand.find(c => c.type === 'VALIDATOR')
  if (validator) {
    return {
      type: 'PLAY_CARD',
      playerId,
      cardId: validator.id,
    }
  }

  // Priority c: DISCARD_REDRAW all non-TRANSACTION cards (or all if none)
  const nonTx = hand.filter(c => c.type !== 'TRANSACTION')
  const toDiscard = nonTx.length > 0 ? nonTx : hand
  return {
    type: 'DISCARD_REDRAW',
    playerId,
    cardIdsToDiscard: toDiscard.map(c => c.id),
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log('Connecting player1 and player2...')

  let ws1, ws2
  try {
    ws1 = await connect()
    ws2 = await connect()
  } catch (err) {
    console.error('Failed to connect:', err.message)
    process.exit(1)
  }

  // Attach error listeners that will reject the test
  let fatalError = null
  ws1.on('error', err => { fatalError = err })
  ws2.on('error', err => { fatalError = err })

  try {
    // Step 1: player1 creates room
    console.log('\n[Setup] Player1 creating room...')
    send(ws1, { type: 'CREATE_ROOM', vsComp: false })
    const roomCreated = await waitForMessage(ws1, 'ROOM_CREATED')
    const { roomCode, playerToken: token1 } = roomCreated
    console.log(`[Setup] Room created: ${roomCode}`)

    // Step 2: player2 joins
    console.log('[Setup] Player2 joining room...')
    send(ws2, { type: 'JOIN_ROOM', roomCode })
    const roomJoined = await waitForMessage(ws2, 'ROOM_JOINED')
    const token2 = roomJoined.playerToken
    console.log(`[Setup] Player2 joined, token: ${token2.slice(0, 8)}...`)

    // Step 3: both receive GAME_STARTED
    const [gameStarted1, gameStarted2] = await Promise.all([
      waitForMessage(ws1, 'GAME_STARTED'),
      waitForMessage(ws2, 'GAME_STARTED'),
    ])
    let state = gameStarted1.state
    console.log(`[Setup] Game started! First turn: ${state.currentTurn}`)
    console.log(`        Phase: ${state.phase}`)

    // Map playerId -> ws and token
    const players = {
      player1: { ws: ws1, token: token1 },
      player2: { ws: ws2, token: token2 },
    }

    // Step 4: simulate up to 20 turns
    let turnsPlayed = 0
    const MAX_TURNS = 20

    while (turnsPlayed < MAX_TURNS && state.phase === 'playing') {
      if (fatalError) throw fatalError

      const activeId = state.currentTurn
      const { ws: activeWs } = players[activeId]

      const action = pickAction(state, activeId)
      turnsPlayed++

      console.log(`\n[Turn ${turnsPlayed}] ${activeId} → ${action.type}` +
        (action.type === 'PUBLISH_BLOCK' ? ` (cards: ${action.cardIds.join(', ')})` :
         action.type === 'PLAY_CARD' ? ` (card: ${action.cardId})` :
         ` (discard ${action.cardIdsToDiscard?.length ?? 0} cards)`))

      send(activeWs, { type: 'ACTION', action })

      // Server broadcasts GAME_STATE to BOTH players — drain both to avoid stale queue buildup
      const passiveId = activeId === 'player1' ? 'player2' : 'player1'
      const { ws: passiveWs } = players[passiveId]
      const [stateMsg] = await Promise.all([
        waitForMessage(activeWs, 'GAME_STATE'),
        waitForMessage(passiveWs, 'GAME_STATE'),
      ])
      state = stateMsg.state

      const p1 = state.players.find(p => p.id === 'player1')
      const p2 = state.players.find(p => p.id === 'player2')
      console.log(`         Chain: ${state.chain.length} blocks | p1 credits: ${p1?.credits} | p2 credits: ${p2?.credits} | phase: ${state.phase}`)

      if (state.phase === 'ended') {
        console.log(`         Game ended! Winner: ${state.winner}`)
        break
      }
    }

    // Step 5: summary
    const p1Final = state.players.find(p => p.id === 'player1')
    const p2Final = state.players.find(p => p.id === 'player2')

    console.log('\n==============================')
    console.log('          GAME SUMMARY')
    console.log('==============================')
    console.log(`Turns played:       ${turnsPlayed}`)
    console.log(`Phase:              ${state.phase}`)
    console.log(`Winner:             ${state.winner ?? 'N/A (game still in progress)'}`)
    console.log(`Chain length:       ${state.chain.length} blocks`)
    console.log(`Player1 credits:    ${p1Final?.credits ?? '?'}`)
    console.log(`Player2 credits:    ${p2Final?.credits ?? '?'}`)
    console.log('==============================')
    console.log('e2e test PASSED')

  } catch (err) {
    console.error('\ne2e test FAILED:', err.message)
    ws1?.close()
    ws2?.close()
    process.exit(1)
  }

  ws1?.close()
  ws2?.close()
  process.exit(0)
}

main()

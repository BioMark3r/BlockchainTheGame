import React from 'react'
import { useGameStore } from './store/gameStore'
import RoomLobby from './components/RoomLobby'
import GameBoard from './components/GameBoard'

export default function App() {
  const gameState = useGameStore((s) => s.gameState)
  const ws = useGameStore((s) => s.ws)

  function handleReturnToLobby() {
    if (ws) ws.close()
    useGameStore.setState({ gameState: null, localPlayerId: null, roomCode: null, playerToken: null, ws: null, error: null })
  }

  const phase = gameState?.phase

  if (phase === 'playing' || phase === 'ended') {
    return <GameBoard onReturnToLobby={handleReturnToLobby} />
  }

  return <RoomLobby />
}

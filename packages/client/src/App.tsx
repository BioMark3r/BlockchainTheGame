import React, { useEffect } from 'react'
import { useGameStore } from './store/gameStore'
import RoomLobby from './components/RoomLobby'
import GameBoard from './components/GameBoard'
import { attemptRejoin, clearReconnectStorage } from './ws/client'

export default function App() {
  const gameState      = useGameStore((s) => s.gameState)
  const ws             = useGameStore((s) => s.ws)
  const isReconnecting = useGameStore((s) => s.isReconnecting)

  useEffect(() => {
    if (sessionStorage.getItem('btg_playerToken')) {
      useGameStore.getState().setIsReconnecting(true)
      attemptRejoin()
    }
  }, [])

  function handleReturnToLobby() {
    if (ws) ws.close()
    useGameStore.setState({ gameState: null, localPlayerId: null, roomCode: null, playerToken: null, ws: null, error: null, isReconnecting: false })
    clearReconnectStorage()
  }

  if (isReconnecting) {
    return (
      <div className="fixed inset-0 bg-[#060910] flex flex-col items-center justify-center gap-4 z-50">
        <div className="text-yellow-400 text-2xl animate-pulse">⛓️</div>
        <p className="text-white font-bold">Reconnecting to game…</p>
        <button
          onClick={() => {
            clearReconnectStorage()
            useGameStore.getState().setIsReconnecting(false)
          }}
          className="text-xs text-gray-500 hover:text-gray-300 underline mt-2"
        >
          Cancel and return to lobby
        </button>
      </div>
    )
  }

  const phase = gameState?.phase

  if (phase === 'playing' || phase === 'ended') {
    return <GameBoard onReturnToLobby={handleReturnToLobby} />
  }

  return <RoomLobby />
}

import React, { useState, useEffect } from 'react'
import type { Card, PlayerId } from '@shared/types'
import { CardType } from '@shared/types'
import CardTile from './CardTile'
import { useGameStore } from '../store/gameStore'
import { getHint } from '../utils/hint'

interface Props {
  hand: Card[]
  localPlayerId: PlayerId
  isMyTurn: boolean
  onInvalidTxPending?: (cardId: string | null) => void
}

export default function PlayerHand({ hand, localPlayerId, isMyTurn, onInvalidTxPending }: Props) {
  const send = useGameStore((s) => s.send)
  const gameState = useGameStore((s) => s.gameState)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [discardSelectMode, setDiscardSelectMode] = useState(false)
  const [discardSelectedIds, setDiscardSelectedIds] = useState<string[]>([])
  const [pendingInvalidTxCardId, setPendingInvalidTxCardId] = useState<string | null>(null)
  const [showHint, setShowHint] = useState(false)

  function setPendingInvalidTx(cardId: string | null) {
    setPendingInvalidTxCardId(cardId)
    onInvalidTxPending?.(cardId)
  }

  useEffect(() => {
    if (pendingInvalidTxCardId && !hand.find(c => c.id === pendingInvalidTxCardId)) {
      setPendingInvalidTxCardId(null)
      onInvalidTxPending?.(null)
    }
  }, [hand, pendingInvalidTxCardId])

  useEffect(() => {
    if (!isMyTurn) setShowHint(false)
  }, [isMyTurn])

  function handlePassTurn() {
    send({ type: 'ACTION', action: { type: 'DISCARD_REDRAW', playerId: localPlayerId, cardIdsToDiscard: [] } })
  }

  function toggleSelect(cardId: string) {
    setSelectedIds((prev) => {
      if (prev.includes(cardId)) return prev.filter((id) => id !== cardId)
      if (prev.length >= 3) return prev // max 3 for a block
      return [...prev, cardId]
    })
  }

  function toggleDiscardSelect(cardId: string) {
    setDiscardSelectedIds((prev) =>
      prev.includes(cardId) ? prev.filter((id) => id !== cardId) : [...prev, cardId]
    )
  }

  function enterDiscardMode() {
    setDiscardSelectMode(true)
    setSelectedIds([])
    setPendingInvalidTx(null)
  }

  function cancelDiscardMode() {
    setDiscardSelectMode(false)
    setDiscardSelectedIds([])
  }

  function handleCardClick(card: Card) {
    if (!isMyTurn) return

    if (discardSelectMode) {
      toggleDiscardSelect(card.id)
      return
    }

    if (card.type === CardType.TRANSACTION) {
      setPendingInvalidTx(null)
      toggleSelect(card.id)
    } else if (card.type === CardType.INVALID_TRANSACTION) {
      setSelectedIds([])
      setPendingInvalidTx(card.id)
    } else {
      setPendingInvalidTx(null)
      send({
        type: 'ACTION',
        action: { type: 'PLAY_CARD', playerId: localPlayerId, cardId: card.id },
      })
    }
  }

  function handlePublishBlock() {
    if (selectedIds.length !== 3) return
    send({
      type: 'ACTION',
      action: {
        type: 'PUBLISH_BLOCK',
        playerId: localPlayerId,
        cardIds: [selectedIds[0]!, selectedIds[1]!, selectedIds[2]!] as [string, string, string],
      },
    })
    setSelectedIds([])
  }

  function handleConfirmDiscard() {
    if (discardSelectedIds.length === 0) return
    send({
      type: 'ACTION',
      action: { type: 'DISCARD_REDRAW', playerId: localPlayerId, cardIdsToDiscard: discardSelectedIds },
    })
    setDiscardSelectMode(false)
    setDiscardSelectedIds([])
    setSelectedIds([])
  }

  const transactionCards = hand.filter((c) => c.type === CardType.TRANSACTION)
  const otherCards = hand.filter((c) => c.type !== CardType.TRANSACTION)
  const txCount = transactionCards.length

  return (
    <div>
      {/* Invalid TX pending banner */}
      {pendingInvalidTxCardId && (
        <div className="flex items-center gap-3 mb-2 bg-red-950/60 border border-red-600/60 rounded-lg px-3 py-2 text-sm text-red-300">
          <span>🎯 Click a block in The Chain to invalidate it</span>
          <button
            onClick={() => setPendingInvalidTx(null)}
            className="ml-auto text-red-400 hover:text-white underline text-xs"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-2 mb-3 flex-wrap">
        {!discardSelectMode && selectedIds.length > 0 && (
          <div className="text-xs text-blue-300 flex items-center gap-2">
            <span>{selectedIds.length}/3 transactions selected</span>
            <button
              onClick={() => setSelectedIds([])}
              className="text-gray-400 hover:text-white underline"
            >
              clear
            </button>
          </div>
        )}

        {!discardSelectMode && selectedIds.length === 3 && (
          <button
            onClick={handlePublishBlock}
            className="bg-green-600 hover:bg-green-500 text-white text-xs font-bold px-4 py-1.5 rounded-lg transition-colors"
          >
            📦 Publish Block
          </button>
        )}

        {isMyTurn && !discardSelectMode && (
          <div className="ml-auto flex gap-2">
            <button
              onClick={() => setShowHint(h => !h)}
              className={`text-xs px-3 py-1.5 rounded-lg transition-colors border ${
                showHint
                  ? 'bg-yellow-500/10 border-yellow-500/50 text-yellow-300'
                  : 'bg-gray-800 border-gray-700 text-gray-400 hover:text-yellow-300 hover:border-yellow-600'
              }`}
            >
              💡 Hint
            </button>
            <button
              onClick={handlePassTurn}
              className="text-xs text-gray-600 hover:text-gray-400 border border-gray-700 hover:border-gray-500 px-3 py-1.5 rounded-lg transition-colors"
            >
              End Turn
            </button>
            <button
              onClick={enterDiscardMode}
              className="bg-gray-700 hover:bg-gray-600 text-gray-300 text-xs px-3 py-1.5 rounded-lg transition-colors"
            >
              🔀 Select cards to discard
            </button>
          </div>
        )}

        {discardSelectMode && (
          <>
            <span className="text-xs text-rose-300 flex items-center">
              Select cards to discard ({discardSelectedIds.length} selected)
            </span>
            <button
              onClick={handleConfirmDiscard}
              disabled={discardSelectedIds.length === 0}
              className="bg-rose-700 hover:bg-rose-600 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold px-4 py-1.5 rounded-lg transition-colors"
            >
              Discard {discardSelectedIds.length} card{discardSelectedIds.length !== 1 ? 's' : ''}
            </button>
            <button
              onClick={cancelDiscardMode}
              className="bg-gray-700 hover:bg-gray-600 text-gray-300 text-xs px-3 py-1.5 rounded-lg transition-colors"
            >
              Cancel
            </button>
          </>
        )}
      </div>

      {showHint && gameState && (() => {
        const hint = getHint(hand, gameState, localPlayerId)
        const borderColor = hint.priority === 'high' ? 'border-green-600/50 bg-green-950/30'
          : hint.priority === 'medium' ? 'border-blue-600/50 bg-blue-950/30'
          : 'border-gray-600/50 bg-gray-800/30'
        return (
          <div className={`mt-2 rounded-xl border px-4 py-2.5 text-sm text-gray-200 leading-snug ${borderColor}`}>
            <span className="mr-2">{hint.icon}</span>{hint.text}
          </div>
        )
      })()}

      {hand.length === 0 ? (
        <div className="text-gray-600 text-sm text-center py-4">No cards in hand</div>
      ) : (
        <div className="flex gap-1.5 sm:gap-2 flex-wrap">
          {/* Transaction cards first (for publish block grouping) */}
          {transactionCards.map((card) => (
            <CardTile
              key={card.id}
              card={card}
              isMyTurn={isMyTurn}
              isSelected={!discardSelectMode && selectedIds.includes(card.id)}
              isDiscardSelected={discardSelectMode && discardSelectedIds.includes(card.id)}
              onClick={() => handleCardClick(card)}
            />
          ))}

          {/* Divider if both types present */}
          {transactionCards.length > 0 && otherCards.length > 0 && (
            <div className="w-px bg-gray-700 self-stretch mx-1" />
          )}

          {/* Other cards */}
          {otherCards.map((card) => (
            <CardTile
              key={card.id}
              card={card}
              isMyTurn={isMyTurn}
              isSelected={false}
              isDiscardSelected={discardSelectMode && discardSelectedIds.includes(card.id)}
              isDisabled={card.type === CardType.BLOCK_REWARD && txCount < 2}
              onClick={() => handleCardClick(card)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

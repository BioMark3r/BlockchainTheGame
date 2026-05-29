import React, { useState } from 'react'
import type { Card, CardType } from '@shared/types'
import { CardType as CT } from '@shared/types'

interface Props {
  card: Card
  isMyTurn: boolean
  isSelected?: boolean
  isDiscardSelected?: boolean
  onClick?: () => void
}

const CARD_LABELS: Record<CardType, string> = {
  [CT.GENESIS]: 'Genesis',
  [CT.VALIDATOR]: 'Validator',
  [CT.TRANSACTION]: 'Transaction',
  [CT.RESHUFFLE]: 'Reshuffle',
  [CT.CHAIN_SPLIT]: 'Chain Split',
  [CT.VALIDATOR_REDUNDANCY]: 'Redundancy',
  [CT.INVALID_TRANSACTION]: 'Invalid Txn',
  [CT.CHAIN_REORG]: 'Chain Reorg',
  [CT.FORK]: 'Fork',
}

const CARD_TOOLTIPS: Record<CardType, string> = {
  [CT.TRANSACTION]: 'Select 3 Transaction cards, then click Publish Block to add a block to the chain and earn credits.',
  [CT.VALIDATOR]: 'Play to add a validator node. Each active validator increases the credits you earn per block.',
  [CT.VALIDATOR_REDUNDANCY]: 'Doubles credits earned for the next block published, then resets. Not stackable — play it just before publishing for maximum effect.',
  [CT.CHAIN_SPLIT]: 'From now on, only you earn credits when you publish blocks. Your opponent earns nothing per block for the rest of the game.',
  [CT.CHAIN_REORG]: 'Reorganize the chain — removes the last block, undoing its credits.',
  [CT.INVALID_TRANSACTION]: 'Mark a block as invalid and remove it from the chain.',
  [CT.FORK]: 'Trigger a hard fork! Ends the game immediately. The player with the most credits wins.',
  [CT.RESHUFFLE]: 'Shuffle your entire discard pile back into your draw pile for more cards.',
  [CT.GENESIS]: 'The genesis block. This card cannot be played.',
}

const CARD_COLORS: Record<CardType, { border: string; bg: string; glow: string; accent: string }> = {
  [CT.TRANSACTION]:          { border: 'border-blue-500/70',   bg: 'bg-blue-950/50',   glow: 'rgba(59,130,246,0.5)',  accent: 'text-blue-300' },
  [CT.VALIDATOR]:            { border: 'border-green-500/70',  bg: 'bg-green-950/50',  glow: 'rgba(34,197,94,0.5)',   accent: 'text-green-300' },
  [CT.VALIDATOR_REDUNDANCY]: { border: 'border-teal-400/70',   bg: 'bg-teal-950/50',   glow: 'rgba(45,212,191,0.5)',  accent: 'text-teal-300' },
  [CT.CHAIN_SPLIT]:          { border: 'border-orange-400/70', bg: 'bg-orange-950/50', glow: 'rgba(251,146,60,0.5)',  accent: 'text-orange-300' },
  [CT.CHAIN_REORG]:          { border: 'border-sky-400/70',    bg: 'bg-sky-950/50',    glow: 'rgba(56,189,248,0.5)',  accent: 'text-sky-300' },
  [CT.INVALID_TRANSACTION]:  { border: 'border-red-500/70',    bg: 'bg-red-950/50',    glow: 'rgba(239,68,68,0.5)',   accent: 'text-red-300' },
  [CT.FORK]:                 { border: 'border-amber-400/80',  bg: 'bg-amber-950/60',  glow: 'rgba(251,191,36,0.5)',  accent: 'text-amber-300' },
  [CT.RESHUFFLE]:            { border: 'border-emerald-400/70',bg: 'bg-emerald-950/50',glow: 'rgba(52,211,153,0.5)',  accent: 'text-emerald-300' },
  [CT.GENESIS]:              { border: 'border-yellow-500/80', bg: 'bg-yellow-950/60', glow: 'rgba(234,179,8,0.5)',   accent: 'text-yellow-300' },
}

const CARD_ICONS: Record<CardType, string> = {
  [CT.TRANSACTION]: '⬡',
  [CT.VALIDATOR]: '🛡️',
  [CT.VALIDATOR_REDUNDANCY]: '⚡',
  [CT.CHAIN_SPLIT]: '🔱',
  [CT.CHAIN_REORG]: '🔄',
  [CT.INVALID_TRANSACTION]: '❌',
  [CT.FORK]: '⑂',
  [CT.RESHUFFLE]: '🔀',
  [CT.GENESIS]: '🌐',
}

export default function CardTile({ card, isMyTurn, isSelected = false, isDiscardSelected = false, onClick }: Props) {
  const [showTooltip, setShowTooltip] = useState(false)
  const [playing, setPlaying] = useState(false)
  const disabled = !isMyTurn
  const colors = CARD_COLORS[card.type] ?? { border: 'border-gray-500', bg: 'bg-gray-800', glow: 'rgba(0,0,0,0)', accent: 'text-gray-300' }

  function handleClick() {
    if (!disabled && card.type !== CT.TRANSACTION) {
      setPlaying(true)
      setTimeout(() => setPlaying(false), 250)
    }
    onClick?.()
  }

  return (
    <div className="relative flex-shrink-0">
      <button
        onClick={handleClick}
        disabled={disabled}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        className={[
          'relative flex flex-col items-center justify-between',
          'w-16 h-24 sm:w-20 sm:h-28 rounded-xl border-2 text-xs font-semibold transition-all duration-150 p-1.5',
          'animate-card-draw',
          colors.border,
          colors.bg,
          disabled
            ? 'opacity-30 grayscale cursor-not-allowed'
            : 'cursor-pointer hover:scale-105 active:scale-95',
          isSelected
            ? `ring-2 ring-blue-400 scale-105`
            : isDiscardSelected
            ? `ring-2 ring-rose-500 scale-105`
            : '',
          playing ? 'animate-card-play' : '',
        ].join(' ')}
        style={
          isSelected
            ? { boxShadow: `0 0 14px rgba(59,130,246,0.6)` }
            : isDiscardSelected
            ? { boxShadow: `0 0 14px rgba(244,63,94,0.6)` }
            : undefined
        }
      >
        {/* Top: card type label */}
        <span className={`text-[8px] sm:text-[9px] font-bold uppercase tracking-wider w-full text-left ${colors.accent}`}>
          {CARD_LABELS[card.type]}
        </span>

        {/* Center: icon */}
        <span className="text-2xl sm:text-3xl leading-none">{CARD_ICONS[card.type]}</span>

        {/* Bottom: short ID */}
        <span className="text-[8px] sm:text-[9px] text-gray-500 font-mono w-full text-right">
          {card.id.slice(-4)}
        </span>

        {isSelected && (
          <span className="absolute top-1 right-1 text-blue-400 text-[10px] font-bold">✓</span>
        )}
        {isDiscardSelected && (
          <span className="absolute top-1 right-1 text-rose-400 text-[10px] font-bold">🗑</span>
        )}
      </button>

      {/* Hover tooltip */}
      {showTooltip && !disabled && (
        <div
          className="absolute z-50 bottom-full mb-2 left-1/2 -translate-x-1/2 w-48 rounded-lg border border-gray-600 bg-gray-900 px-3 py-2 text-xs text-gray-200 shadow-xl pointer-events-none"
          style={{ boxShadow: `0 0 16px ${colors.glow}` }}
        >
          <div className={`font-bold mb-1 ${colors.accent}`}>{CARD_LABELS[card.type]}</div>
          <div className="leading-snug text-gray-300">{CARD_TOOLTIPS[card.type]}</div>
          {/* Arrow */}
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-600" />
        </div>
      )}
    </div>
  )
}

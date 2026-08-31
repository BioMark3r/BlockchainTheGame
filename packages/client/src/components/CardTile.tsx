import React, { useState } from 'react'
import type { Card, CardType } from '@shared/types'
import { CardType as CT } from '@shared/types'

interface Props {
  card: Card
  isMyTurn: boolean
  isSelected?: boolean
  isDiscardSelected?: boolean
  isDisabled?: boolean
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
  [CT.BLOCK_REWARD]: 'Block Reward',
  // L2
  [CT.SEQUENCER]: 'Sequencer',
  [CT.DATA_BLOB]: 'Data Blob',
  [CT.OPTIMISTIC_ROLLUP]: 'Opt. Rollup',
  [CT.FRAUD_PROOF]: 'Fraud Proof',
  [CT.ZK_PROOF]: 'ZK Proof',
  [CT.MEV_BOT]: 'MEV Bot',
  [CT.BRIDGE]: 'Bridge',
  [CT.GAS_SPIKE]: 'Gas Spike',
  [CT.HARD_FORK]: 'Hard Fork',
}

const CARD_TOOLTIPS: Record<CardType, string> = {
  [CT.TRANSACTION]: 'Select 3 Transaction cards, then click Publish Block to add a block to the chain and earn credits.',
  [CT.VALIDATOR]: 'Play to add a validator node. Each active validator increases the credits you earn per block.',
  [CT.VALIDATOR_REDUNDANCY]: 'Doubles credits earned for the next block published, then resets. Not stackable — play it just before publishing for maximum effect.',
  [CT.CHAIN_SPLIT]: 'From now on, only you earn credits when you publish blocks. Your opponent earns nothing per block for the rest of the game.',
  [CT.CHAIN_REORG]: 'Reorganize the chain — removes the last 3 blocks from the chain.',
  [CT.INVALID_TRANSACTION]: 'Mark a block as invalid and remove it from the chain.',
  [CT.FORK]: 'Trigger a hard fork! Ends the game immediately. The player with the most credits wins.',
  [CT.RESHUFFLE]: 'Shuffle your entire discard pile back into your draw pile for more cards.',
  [CT.GENESIS]: 'The genesis block. This card cannot be played.',
  [CT.BLOCK_REWARD]: 'Auto-publish a block using this card + 2 Transaction cards from your hand. Earns half credits. Useful when you only have 2 Transaction cards.',
  // L2
  [CT.SEQUENCER]: 'L2: Place a sequencer node in play. Earns 1 credit per batch published (same as Validator in L1).',
  [CT.DATA_BLOB]: 'L2: Publish a batch using this card + 1 Transaction card. Earns full credits. Fast and efficient.',
  [CT.OPTIMISTIC_ROLLUP]: 'L2: Publish a batch using this card + 2 Transaction cards. Credits go into escrow until your next turn. Opponent can cancel with Fraud Proof (unless ZK-proven).',
  [CT.FRAUD_PROOF]: 'L2: Cancel the most recent unprotected Optimistic Rollup batch from your opponent. Their escrowed credits are forfeited.',
  [CT.ZK_PROOF]: 'L2: Your next Optimistic Rollup batch is ZK-proven — immune to Fraud Proof and earns credits instantly instead of going into escrow.',
  [CT.MEV_BOT]: 'L2: Set a MEV trap. When your opponent next publishes any batch, steal 2 credits from them.',
  [CT.BRIDGE]: 'L2: Your next batch earns double credits for you as publisher. Clears after one use.',
  [CT.GAS_SPIKE]: 'L2: Your opponent skips their auto-draw refill on their next turn (they draw 0 extra cards).',
  [CT.HARD_FORK]: 'L2: Trigger a hard fork — ends the game immediately. The player with the most credits wins.',
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
  [CT.BLOCK_REWARD]:         { border: 'border-violet-400/70', bg: 'bg-violet-950/50', glow: 'rgba(139,92,246,0.5)',  accent: 'text-violet-300' },
  // L2
  [CT.SEQUENCER]:            { border: 'border-cyan-500/70',   bg: 'bg-cyan-950/50',   glow: 'rgba(6,182,212,0.5)',   accent: 'text-cyan-300' },
  [CT.DATA_BLOB]:            { border: 'border-indigo-400/70', bg: 'bg-indigo-950/50', glow: 'rgba(99,102,241,0.5)',  accent: 'text-indigo-300' },
  [CT.OPTIMISTIC_ROLLUP]:    { border: 'border-purple-400/70', bg: 'bg-purple-950/50', glow: 'rgba(168,85,247,0.5)',  accent: 'text-purple-300' },
  [CT.FRAUD_PROOF]:          { border: 'border-rose-500/70',   bg: 'bg-rose-950/50',   glow: 'rgba(244,63,94,0.5)',   accent: 'text-rose-300' },
  [CT.ZK_PROOF]:             { border: 'border-fuchsia-400/70',bg: 'bg-fuchsia-950/50',glow: 'rgba(232,121,249,0.5)', accent: 'text-fuchsia-300' },
  [CT.MEV_BOT]:              { border: 'border-red-400/70',    bg: 'bg-red-950/50',    glow: 'rgba(248,113,113,0.5)', accent: 'text-red-300' },
  [CT.BRIDGE]:               { border: 'border-lime-400/70',   bg: 'bg-lime-950/50',   glow: 'rgba(163,230,53,0.5)',  accent: 'text-lime-300' },
  [CT.GAS_SPIKE]:            { border: 'border-orange-500/70', bg: 'bg-orange-950/50', glow: 'rgba(249,115,22,0.5)',  accent: 'text-orange-300' },
  [CT.HARD_FORK]:            { border: 'border-amber-500/80',  bg: 'bg-amber-950/60',  glow: 'rgba(245,158,11,0.5)',  accent: 'text-amber-300' },
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
  [CT.BLOCK_REWARD]: '🪙',
  // L2
  [CT.SEQUENCER]: '🔵',
  [CT.DATA_BLOB]: '💾',
  [CT.OPTIMISTIC_ROLLUP]: '🔮',
  [CT.FRAUD_PROOF]: '🕵️',
  [CT.ZK_PROOF]: '🔐',
  [CT.MEV_BOT]: '🤖',
  [CT.BRIDGE]: '🌉',
  [CT.GAS_SPIKE]: '⛽',
  [CT.HARD_FORK]: '⚡',
}

export default function CardTile({ card, isMyTurn, isSelected = false, isDiscardSelected = false, isDisabled, onClick }: Props) {
  const [showTooltip, setShowTooltip] = useState(false)
  const [playing, setPlaying] = useState(false)
  const disabled = !isMyTurn || (isDisabled ?? false)
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
            ? `ring-4 ring-blue-400 scale-110 brightness-125`
            : isDiscardSelected
            ? `ring-4 ring-rose-400 scale-110 brightness-125`
            : '',
          playing ? 'animate-card-play' : '',
        ].join(' ')}
        style={
          isSelected
            ? { boxShadow: '0 0 24px rgba(59,130,246,0.9)' }
            : isDiscardSelected
            ? { boxShadow: '0 0 24px rgba(244,63,94,0.9)' }
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

        {(isSelected || isDiscardSelected) && (
          <div className={`absolute inset-0 rounded-xl pointer-events-none ${
            isSelected ? 'bg-blue-400/15' : 'bg-rose-400/15'
          }`} />
        )}

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

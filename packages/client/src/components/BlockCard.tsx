import React from 'react'
import type { Block } from '@shared/types'
import { displayName } from '../utils/display'
import { useGameStore } from '../store/gameStore'

interface Props {
  block: Block
  index: number
  isFlashing: boolean
  isNew?: boolean
  isTargetable?: boolean
  onSelect?: (blockId: string) => void
}

export default function BlockCard({ block, index, isFlashing, isNew = false, isTargetable = false, onSelect }: Props) {
  const playerNames = useGameStore((s) => s.playerNames)
  const isCpu = block.publishedBy === 'cpu'
  const publisher = displayName(block.publishedBy, isCpu, playerNames)

  return (
    <div
      onClick={isTargetable && onSelect ? () => onSelect(block.id) : undefined}
      className={[
        'flex-shrink-0 w-20 sm:w-28 rounded-xl border px-2 sm:px-3 py-2 text-xs transition-colors duration-300',
        isFlashing
          ? 'border-red-500 shadow-[0_0_16px_rgba(255,45,85,0.7)] animate-pulse bg-red-900/60 chain-reorg-flash'
          : 'bg-[#0a0e1a] border-[#1e2d4a]',
        isTargetable
          ? 'cursor-pointer hover:ring-2 hover:ring-red-500 hover:shadow-[0_0_12px_rgba(239,68,68,0.6)]'
          : '',
        isNew ? 'animate-block-pop' : '',
      ].join(' ')}
    >
      <div className="font-mono text-cyan-400 mb-1">#{index + 1}</div>
      <div className="font-bold text-yellow-300 truncate">{publisher}</div>
      <div className="text-gray-400 mt-1">{block.transactions.length} txns</div>
    </div>
  )
}

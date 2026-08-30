import React, { useState } from 'react'
import type { Block } from '@shared/types'
import { CardType } from '@shared/types'
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
  const [showTooltip, setShowTooltip] = useState(false)

  const hasBlockReward = block.transactions.some(t => t.type === CardType.BLOCK_REWARD)
  const txTypes = block.transactions.map(t => t.type)

  return (
    <div
      className="relative flex-shrink-0"
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <div
        onClick={isTargetable && onSelect ? () => onSelect(block.id) : undefined}
        className={[
          'w-20 sm:w-28 rounded-xl border px-2 sm:px-3 py-2 text-xs transition-colors duration-300',
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
        <div className="text-gray-400 mt-1">
          {hasBlockReward ? '🪙 2 txns' : `${block.transactions.length} txns`}
        </div>
      </div>

      {showTooltip && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-20 w-44 bg-gray-900 border border-gray-600 rounded-xl p-3 text-xs shadow-xl pointer-events-none">
          <div className="font-bold text-white mb-1">Block #{index + 1}</div>
          <div className="text-gray-400 mb-1">Published by <span className="text-yellow-300">{publisher}</span></div>
          <div className="text-gray-500 mb-2">Transactions:</div>
          <div className="space-y-0.5">
            {txTypes.map((t, i) => (
              <div key={i} className="text-gray-300 flex items-center gap-1">
                {t === CardType.BLOCK_REWARD ? '🪙' : '📄'} {t.replace(/_/g, ' ')}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

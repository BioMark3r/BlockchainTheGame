import React, { useEffect, useRef, useState } from 'react'
import type { Block, Card } from '@shared/types'
import BlockCard from './BlockCard'

interface Props {
  chain: Block[]
  genesisCard: Card
  selectingForInvalidTx?: boolean
  onBlockSelected?: (blockId: string) => void
}

export default function ChainView({ chain, genesisCard, selectingForInvalidTx = false, onBlockSelected }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const prevLengthRef = useRef(chain.length)
  const seenIdsRef = useRef<Set<string>>(new Set(chain.map((b) => b.id)))
  const [flashingIds, setFlashingIds] = useState<Set<string>>(new Set())
  const [newIds, setNewIds] = useState<Set<string>>(new Set())

  // Detect chain reorg: chain shrinks
  useEffect(() => {
    const prev = prevLengthRef.current
    const curr = chain.length

    if (curr < prev) {
      // All current blocks are from a reorg — flash them briefly
      const ids = new Set(chain.map((b) => b.id))
      setFlashingIds(ids)
      const timer = setTimeout(() => setFlashingIds(new Set()), 700)
      prevLengthRef.current = curr
      return () => clearTimeout(timer)
    }

    prevLengthRef.current = curr
  }, [chain])

  // Detect new blocks added to the chain
  useEffect(() => {
    const incoming = new Set<string>()
    for (const block of chain) {
      if (!seenIdsRef.current.has(block.id)) {
        incoming.add(block.id)
      }
    }
    if (incoming.size > 0) {
      setNewIds(incoming)
      for (const id of incoming) seenIdsRef.current.add(id)
      const timer = setTimeout(() => setNewIds(new Set()), 400)
      return () => clearTimeout(timer)
    }
  }, [chain])

  // Auto-scroll right when new blocks are added
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollLeft = scrollRef.current.scrollWidth
    }
  }, [chain.length])

  return (
    <div className="bg-gray-900 border border-gray-700 rounded-2xl p-4">
      <h2 className="text-xs text-gray-400 uppercase tracking-widest mb-3 font-semibold">
        ⛓ The Chain — {chain.length} block{chain.length !== 1 ? 's' : ''}
      </h2>

      {selectingForInvalidTx && (
        <div className="mb-3 bg-red-950/60 border border-red-600/60 text-red-300 text-sm rounded-lg px-3 py-2 animate-pulse">
          🎯 Select a block to invalidate
        </div>
      )}

      <div
        ref={scrollRef}
        className="flex gap-2 overflow-x-auto pb-2 scroll-smooth items-center"
        style={{ scrollbarWidth: 'thin' }}
      >
        {/* Genesis block — always shown */}
        <div className="flex-shrink-0 flex flex-col items-center justify-center rounded-xl border-2 border-yellow-500/60 bg-yellow-950/40 w-20 h-24 text-center px-1">
          <div className="text-lg mb-0.5">🌐</div>
          <div className="text-yellow-400 text-xs font-bold uppercase tracking-wide">Genesis</div>
          <div className="text-yellow-600 text-[10px] mt-0.5 font-mono">{genesisCard.id.slice(-4)}</div>
        </div>

        {chain.map((block, i) => (
          <React.Fragment key={block.id}>
            {/* Chain link connector */}
            <div className="flex-shrink-0 text-gray-600 text-xs">→</div>
            <BlockCard
              block={block}
              index={i}
              isFlashing={flashingIds.has(block.id)}
              isNew={newIds.has(block.id)}
              isTargetable={selectingForInvalidTx}
              {...(onBlockSelected ? { onSelect: onBlockSelected } : {})}
            />
          </React.Fragment>
        ))}

        {chain.length === 0 && (
          <div className="text-gray-600 text-sm pl-3 self-center">
            → publish a block to extend the chain
          </div>
        )}
      </div>
    </div>
  )
}

import React, { useEffect, useRef, useState } from 'react'
import type { Block, Card, ChainSplitState, PendingBatch, PlayerId } from '@shared/types'
import BlockCard from './BlockCard'

interface Props {
  chain: Block[]
  genesisCard: Card
  selectingForInvalidTx?: boolean
  onBlockSelected?: (blockId: string) => void
  localPlayerId?: string
  chainSplit?: ChainSplitState
  validatorRedundancyCount?: number
  pendingBatches?: PendingBatch[]
  zkProofActive?: PlayerId | null
  bridgeActive?: PlayerId | null
  mevActive?: PlayerId | null
  gasSpike?: PlayerId | null
  gameMode?: 'l1' | 'l2'
}

export default function ChainView({ chain, genesisCard, selectingForInvalidTx = false, onBlockSelected, localPlayerId, chainSplit, validatorRedundancyCount, pendingBatches = [], zkProofActive, bridgeActive, mevActive, gasSpike, gameMode }: Props) {
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
    <div className="min-w-0 bg-gray-900 border border-gray-700 rounded-2xl p-4">
      <h2 className="text-xs text-gray-400 uppercase tracking-widest mb-2 font-semibold">
        ⛓ The Chain — {chain.length} block{chain.length !== 1 ? 's' : ''}
      </h2>

      {(chainSplit?.active || (validatorRedundancyCount ?? 0) > 0 || zkProofActive || bridgeActive || mevActive || gasSpike) && (
        <div className="flex gap-2 mb-2 flex-wrap">
          {chainSplit?.active && (
            <span className="text-xs bg-orange-950/60 border border-orange-500/50 text-orange-300 rounded-full px-2 py-0.5">
              🔱 Chain Split Active
            </span>
          )}
          {(validatorRedundancyCount ?? 0) > 0 && (
            <span className="text-xs bg-blue-950/60 border border-blue-500/50 text-blue-300 rounded-full px-2 py-0.5">
              ⚡ Validator Redundancy Active — next block earns 2×
            </span>
          )}
          {zkProofActive && (
            <span className="text-xs bg-fuchsia-950/60 border border-fuchsia-500/50 text-fuchsia-300 rounded-full px-2 py-0.5">
              🔐 ZK Proof ready ({zkProofActive})
            </span>
          )}
          {bridgeActive && (
            <span className="text-xs bg-lime-950/60 border border-lime-500/50 text-lime-300 rounded-full px-2 py-0.5">
              🌉 Bridge active ({bridgeActive}) — next batch earns 2×
            </span>
          )}
          {mevActive && (
            <span className="text-xs bg-red-950/60 border border-red-500/50 text-red-300 rounded-full px-2 py-0.5">
              🤖 MEV Bot active ({mevActive})
            </span>
          )}
          {gasSpike && (
            <span className="text-xs bg-orange-950/60 border border-orange-500/50 text-orange-300 rounded-full px-2 py-0.5">
              ⛽ Gas Spike on {gasSpike} — next draw skipped
            </span>
          )}
        </div>
      )}

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

        {chain.map((block, i) => {
          const isPendingBatch = pendingBatches.some((pb) => pb.blockId === block.id)
          return (
            <React.Fragment key={block.id}>
              {/* Chain link connector */}
              <div className="flex-shrink-0 text-gray-600 text-xs">→</div>
              <div className="relative flex-shrink-0">
                <BlockCard
                  block={block}
                  index={i}
                  isFlashing={flashingIds.has(block.id)}
                  isNew={newIds.has(block.id)}
                  isTargetable={selectingForInvalidTx && (localPlayerId ? block.publishedBy !== localPlayerId : true)}
                  {...(onBlockSelected ? { onSelect: onBlockSelected } : {})}
                />
                {isPendingBatch && (
                  <div className="absolute -top-2 left-1/2 -translate-x-1/2 bg-orange-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full whitespace-nowrap">
                    ⏳ Pending
                  </div>
                )}
              </div>
            </React.Fragment>
          )
        })}

        {chain.length === 0 && (
          <div className="text-gray-600 text-sm pl-3 self-center">
            → publish a block to extend the chain
          </div>
        )}
      </div>
    </div>
  )
}

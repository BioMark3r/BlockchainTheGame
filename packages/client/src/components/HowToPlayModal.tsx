import React from 'react'

interface Props {
  onClose: () => void
}

const CARD_REFERENCE = [
  { name: 'Transaction',           count: 30, accent: 'text-blue-300',     effect: 'Select 3 to publish a block' },
  { name: 'Validator',             count: 10, accent: 'text-green-300',    effect: 'Earns 1 credit per block published (by anyone)' },
  { name: 'Reshuffle',             count: 3,  accent: 'text-emerald-300',  effect: 'Shuffle discard pile back into draw deck' },
  { name: 'Validator Redundancy',  count: 2,  accent: 'text-teal-300',     effect: 'Doubles credit multiplier for the game (stackable)' },
  { name: 'Invalid Transaction',   count: 2,  accent: 'text-red-300',      effect: 'Remove one block from the chain' },
  { name: 'Chain Split',           count: 1,  accent: 'text-orange-300',   effect: 'Only you earn credits per block from now on' },
  { name: 'Chain Reorg',           count: 1,  accent: 'text-sky-300',      effect: 'Remove ALL blocks from the chain' },
  { name: 'Fork',                  count: 1,  accent: 'text-amber-300',    effect: 'End the game immediately' },
  { name: 'Genesis',               count: 1,  accent: 'text-yellow-300',   effect: 'Removed before play; starts the chain' },
]

export default function HowToPlayModal({ onClose }: Props) {
  return (
    <div
      className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-[#0a0e1a] border border-[#1e2d4a] rounded-2xl max-w-2xl w-full max-h-[85vh] overflow-y-auto p-6 relative">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-500 hover:text-gray-200 text-xl font-bold leading-none"
          aria-label="Close"
        >
          ×
        </button>

        <h2 className="text-yellow-400 font-bold text-xl tracking-tight mb-6 drop-shadow-[0_0_8px_rgba(255,230,0,0.4)]">
          ⛓️ How to Play
        </h2>

        {/* Objective */}
        <section className="mb-6">
          <h3 className="text-yellow-400 font-bold text-sm uppercase tracking-widest mb-2">🎯 Objective</h3>
          <p className="text-gray-300 text-sm leading-relaxed">
            Earn the most credits before the blockchain forks. Build validators, publish blocks, and disrupt your opponent's chain.
          </p>
        </section>

        {/* Turn Actions */}
        <section className="mb-6">
          <h3 className="text-yellow-400 font-bold text-sm uppercase tracking-widest mb-2">🔄 Turn Actions</h3>
          <p className="text-gray-400 text-sm mb-2">Each turn, pick <span className="text-white font-semibold">ONE</span>:</p>
          <ol className="list-decimal list-inside space-y-2 text-sm text-gray-300">
            <li>
              <span className="text-white font-semibold">Play a card</span>
              {' '}— play a Validator, utility, or Fork card from your hand
            </li>
            <li>
              <span className="text-white font-semibold">Publish a Block</span>
              {' '}— select exactly 3 Transaction cards and click "Publish Block" to add a block to the chain and earn credits
            </li>
            <li>
              <span className="text-white font-semibold">Discard &amp; Redraw</span>
              {' '}— select cards to discard, then draw back up to 5
            </li>
          </ol>
        </section>

        {/* Earning Credits */}
        <section className="mb-6">
          <h3 className="text-yellow-400 font-bold text-sm uppercase tracking-widest mb-2">💰 Earning Credits</h3>
          <p className="text-gray-300 text-sm leading-relaxed">
            When any player publishes a block, each player earns <span className="text-white font-semibold">1 credit per Validator</span> they have in play.{' '}
            <span className="text-orange-300 font-semibold">Chain Split</span> changes this so only the publisher earns credits.
          </p>
        </section>

        {/* Card Reference */}
        <section className="mb-6">
          <h3 className="text-yellow-400 font-bold text-sm uppercase tracking-widest mb-3">🃏 Card Reference</h3>
          <div className="rounded-xl border border-[#1e2d4a] overflow-hidden text-sm">
            {/* Header */}
            <div className="grid grid-cols-[1fr_2rem_2fr] gap-x-4 px-4 py-2 bg-[#111827] text-gray-500 text-xs uppercase tracking-widest font-semibold">
              <span>Card</span>
              <span className="text-center">#</span>
              <span>Effect</span>
            </div>
            {CARD_REFERENCE.map((card, i) => (
              <div
                key={card.name}
                className={`grid grid-cols-[1fr_2rem_2fr] gap-x-4 px-4 py-2.5 ${
                  i < CARD_REFERENCE.length - 1 ? 'border-b border-gray-800' : ''
                }`}
              >
                <span className={`font-semibold ${card.accent}`}>{card.name}</span>
                <span className="text-center text-gray-400">{card.count}</span>
                <span className="text-gray-300">{card.effect}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Game End */}
        <section className="mb-6">
          <h3 className="text-yellow-400 font-bold text-sm uppercase tracking-widest mb-2">🏁 Game End</h3>
          <p className="text-gray-300 text-sm leading-relaxed">
            The game ends when a player plays the <span className="text-amber-300 font-semibold">Fork</span> card, or when Player 1 runs out of cards.
            The player with the most credits wins.
          </p>
        </section>

        {/* Tips */}
        <section>
          <h3 className="text-yellow-400 font-bold text-sm uppercase tracking-widest mb-2">💡 Tips</h3>
          <ul className="space-y-1.5 text-sm text-gray-300">
            <li className="flex gap-2"><span className="text-yellow-500 flex-shrink-0">•</span><span>Keep 3+ Transaction cards to publish blocks whenever possible</span></li>
            <li className="flex gap-2"><span className="text-yellow-500 flex-shrink-0">•</span><span>Validators are your engine — play them early</span></li>
            <li className="flex gap-2"><span className="text-yellow-500 flex-shrink-0">•</span><span>Use Invalid Transaction to deny an opponent's best block</span></li>
            <li className="flex gap-2"><span className="text-yellow-500 flex-shrink-0">•</span><span>Save Fork for when you're ahead and running low on cards</span></li>
          </ul>
        </section>
      </div>
    </div>
  )
}

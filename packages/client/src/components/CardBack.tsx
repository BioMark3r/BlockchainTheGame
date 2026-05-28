import React from 'react'

interface Props {
  size?: 'sm' | 'md'
}

export default function CardBack({ size = 'md' }: Props) {
  const w = size === 'sm' ? 64 : 80
  const h = size === 'sm' ? 96 : 112

  return (
    <div
      className="flex-shrink-0 rounded-xl border-2 border-blue-900/60 overflow-hidden relative"
      style={{ width: w, height: h, background: 'linear-gradient(135deg, #0a1628 0%, #0d1f3c 50%, #091221 100%)' }}
    >
      {/* SVG chain-link pattern */}
      <svg
        width={w}
        height={h}
        className="absolute inset-0 opacity-30"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <pattern id="chainpat" x="0" y="0" width="16" height="16" patternUnits="userSpaceOnUse">
            {/* Hexagon dot grid */}
            <circle cx="4" cy="4" r="1.5" fill="#3b82f6" />
            <circle cx="12" cy="12" r="1.5" fill="#3b82f6" />
            <circle cx="4" cy="12" r="0.8" fill="#1d4ed8" />
            <circle cx="12" cy="4" r="0.8" fill="#1d4ed8" />
            {/* Connecting lines */}
            <line x1="4" y1="4" x2="12" y2="12" stroke="#1e3a5f" strokeWidth="0.5" />
            <line x1="12" y1="4" x2="4" y2="12" stroke="#1e3a5f" strokeWidth="0.5" />
          </pattern>
        </defs>
        <rect width={w} height={h} fill="url(#chainpat)" />
      </svg>

      {/* Center chain emoji */}
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-2xl opacity-40 select-none">⛓️</span>
      </div>

      {/* Top/bottom accent lines */}
      <div className="absolute top-1.5 left-1.5 right-1.5 h-px bg-blue-500/20 rounded" />
      <div className="absolute bottom-1.5 left-1.5 right-1.5 h-px bg-blue-500/20 rounded" />
      <div className="absolute top-1.5 bottom-1.5 left-1.5 w-px bg-blue-500/20 rounded" />
      <div className="absolute top-1.5 bottom-1.5 right-1.5 w-px bg-blue-500/20 rounded" />
    </div>
  )
}

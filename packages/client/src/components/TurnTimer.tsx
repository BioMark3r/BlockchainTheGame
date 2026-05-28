import React, { useEffect, useState } from 'react'

interface Props {
  isMyTurn: boolean
  // Each time currentTurn changes, the timer resets — pass currentTurn as key externally
}

export default function TurnTimer({ isMyTurn }: Props) {
  const [seconds, setSeconds] = useState(60)

  useEffect(() => {
    setSeconds(60)
    const interval = setInterval(() => {
      setSeconds(s => {
        if (s <= 1) { clearInterval(interval); return 0 }
        return s - 1
      })
    }, 1000)
    return () => clearInterval(interval)
  }, []) // reset happens via key prop on the parent

  const pct = seconds / 60
  const urgent = seconds <= 10
  const color = urgent ? 'text-red-400' : seconds <= 20 ? 'text-orange-400' : 'text-gray-400'
  const ringColor = urgent ? 'stroke-red-500' : seconds <= 20 ? 'stroke-orange-400' : 'stroke-cyan-500'

  // Simple circular progress: SVG circle
  const radius = 10
  const circumference = 2 * Math.PI * radius
  const dashOffset = circumference * (1 - pct)

  return (
    <div className="flex items-center gap-1.5" title={`${seconds}s remaining`}>
      <svg width="28" height="28" className="-rotate-90">
        <circle cx="14" cy="14" r={radius} fill="none" stroke="#1e2d4a" strokeWidth="3" />
        <circle
          cx="14" cy="14" r={radius}
          fill="none"
          className={ringColor}
          strokeWidth="3"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 1s linear' }}
        />
      </svg>
      <span className={`text-xs font-mono font-bold ${color} ${urgent ? 'animate-pulse' : ''}`}>
        {seconds}s
      </span>
    </div>
  )
}

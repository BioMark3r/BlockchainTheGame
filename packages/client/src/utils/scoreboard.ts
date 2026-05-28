export interface ScoreboardEntry {
  wins: number
  losses: number
  draws: number
  gamesPlayed: number
}

const KEY = 'btg_scoreboard'

export function loadScoreboard(): ScoreboardEntry {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return { wins: 0, losses: 0, draws: 0, gamesPlayed: 0 }
    return JSON.parse(raw) as ScoreboardEntry
  } catch {
    return { wins: 0, losses: 0, draws: 0, gamesPlayed: 0 }
  }
}

export function recordResult(localPlayerId: string, winner: string | null): void {
  const board = loadScoreboard()
  board.gamesPlayed++
  if (winner === null) board.draws++
  else if (winner === localPlayerId) board.wins++
  else board.losses++
  localStorage.setItem(KEY, JSON.stringify(board))
}

export function clearScoreboard(): void {
  localStorage.removeItem(KEY)
}

/** DraftKings Classic golf scoring engine */

/** Finish bonus points by tournament position (1–50) */
export const FINISH_BONUS: Record<number, number> = {
  1: 30, 2: 20, 3: 18, 4: 16, 5: 14, 6: 12, 7: 10, 8: 9, 9: 8, 10: 7,
  11: 6, 12: 6, 13: 6, 14: 6, 15: 6,
  16: 5, 17: 5, 18: 5, 19: 5, 20: 5,
  21: 4, 22: 4, 23: 4, 24: 4, 25: 4,
  26: 3, 27: 3, 28: 3, 29: 3, 30: 3,
  31: 2, 32: 2, 33: 2, 34: 2, 35: 2, 36: 2, 37: 2, 38: 2, 39: 2, 40: 2,
  41: 1, 42: 1, 43: 1, 44: 1, 45: 1, 46: 1, 47: 1, 48: 1, 49: 1, 50: 1,
}

/**
 * Returns the finish bonus for a given tournament position.
 * Positions outside 1–50 receive 0 bonus points.
 */
export function getFinishBonus(position: number): number {
  return FINISH_BONUS[position] ?? 0
}

/**
 * Calculates total stroke fantasy points from hole-by-hole data.
 * Scoring: Double Eagle +13, Eagle +8, Birdie +3, Par +0.5, Bogey -0.5, Double Bogey or worse -1
 */
export function calculateStrokePoints(
  holesData: { score: number; par: number }[]
): number {
  return holesData.reduce((total, { score, par }) => {
    const diff = score - par
    if (diff <= -3) return total + 13 // Double Eagle or better
    if (diff === -2) return total + 8  // Eagle
    if (diff === -1) return total + 3  // Birdie
    if (diff === 0)  return total + 0.5 // Par
    if (diff === 1)  return total - 0.5 // Bogey
    return total - 1                    // Double Bogey or worse
  }, 0)
}

/**
 * Calculates total FPTS for a player: stroke points + finish bonus.
 */
export function calculateTotalFPTS(
  strokePoints: number,
  position: number
): number {
  return strokePoints + getFinishBonus(position)
}

/**
 * Sums FPTS across a contestant's 6 roster players.
 */
export function calculateContestantTotal(
  playerScores: { fpts: number }[]
): number {
  return playerScores.reduce((sum, p) => sum + p.fpts, 0)
}

/**
 * Calculates a contestant's head-to-head record against all opponents.
 * Returns wins, losses, and a formatted record string (e.g. "5W-2L").
 */
export function getHeadToHeadRecord(
  myPts: number,
  opponents: { name: string; pts: number }[]
): { wins: number; losses: number; record: string } {
  let wins = 0
  let losses = 0
  for (const opp of opponents) {
    if (myPts > opp.pts) wins++
    else if (myPts < opp.pts) losses++
  }
  return { wins, losses, record: `${wins}W-${losses}L` }
}

import { PlayerScore } from './types'

interface SportsDataLeaderboard {
  Players: Array<{
    PlayerID: number
    FirstName: string
    LastName: string
    Position: number
    ToPar: number
    Thru: number
    Rounds: Array<{ Score: number }>
  }>
}

// In-memory cache with 5-minute TTL
const cache = new Map<
  string,
  { data: PlayerScore[]; expiresAt: number }
>()

/**
 * Fuzzy match player name from our database against SportsDataIO name.
 * Handles first name initial, middle names, and suffixes.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function fuzzyMatchName(ourName: string, sdName: string): boolean {
  const normalize = (s: string) => s.toLowerCase().trim()
  const our = normalize(ourName)
  const sd = normalize(sdName)

  // Exact match
  if (our === sd) return true

  // Handle "T. Fleetwood" vs "Tommy Fleetwood"
  const sdParts = sd.split(/\s+/)
  const ourParts = our.split(/\s+/)

  // Check if first part matches (initial or full first name)
  if (sdParts.length > 0 && ourParts.length > 0) {
    const sdFirst = sdParts[0]
    const ourFirst = ourParts[0]

    if (sdFirst === ourFirst || sdFirst.startsWith(ourFirst[0])) {
      // Check last name
      if (sdParts.length > 1 && ourParts.length > 0) {
        const sdLast = sdParts[sdParts.length - 1]
        const ourLast = ourParts[ourParts.length - 1]
        if (sdLast === ourLast) return true
      }
    }
  }

  return false
}

/**
 * Fetches live PGA Tour leaderboard from SportsDataIO.
 * Caches results in memory for 5 minutes to avoid rate limiting.
 */
export async function fetchLiveLeaderboard(
  tournamentId: string
): Promise<PlayerScore[]> {
  const apiKey = process.env.GOLF_API_KEY
  if (!apiKey) {
    console.error('GOLF_API_KEY not set')
    return []
  }

  // Check cache
  const cached = cache.get(tournamentId)
  if (cached && cached.expiresAt > Date.now()) {
    console.log(`[Golf API] Cache hit for tournament ${tournamentId}`)
    return cached.data
  }

  try {
    const url = `https://api.sportsdata.io/golf/v2/json/Leaderboard/${tournamentId}?key=${apiKey}`
    const response = await fetch(url)

    if (!response.ok) {
      console.error(`[Golf API] HTTP ${response.status}`)
      return []
    }

    const data = (await response.json()) as SportsDataLeaderboard
    if (!data.Players) {
      console.error('[Golf API] No Players in response')
      return []
    }

    const leaderboard: PlayerScore[] = data.Players.map((p) => ({
      id: `${tournamentId}-${p.PlayerID}`,
      tournament_id: tournamentId,
      player_name: `${p.FirstName} ${p.LastName}`,
      fpts: 0, // Will be calculated by scoring engine on sync
      position: p.Position || null,
      position_display: p.Position ? `T${p.Position}` : null,
      to_par: p.ToPar || 0,
      thru: p.Thru || 0,
      round_scores: p.Rounds?.map((r) => r.Score) || [],
      updated_at: new Date().toISOString(),
    }))

    // Cache for 5 minutes
    cache.set(tournamentId, {
      data: leaderboard,
      expiresAt: Date.now() + 5 * 60 * 1000,
    })

    console.log(`[Golf API] Fetched ${leaderboard.length} players for tournament ${tournamentId}`)
    return leaderboard
  } catch (error) {
    console.error('[Golf API] Fetch failed:', error)
    return []
  }
}

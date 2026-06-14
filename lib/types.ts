export interface Tournament {
  id: string
  name: string
  course: string | null
  dk_contest_id: string | null
  start_date: string | null
  current_round: number
  is_active: boolean
  created_at: string
}

export interface PlayerScore {
  id: string
  tournament_id: string
  player_name: string
  fpts: number
  position: number | null
  position_display: string | null
  to_par: number
  thru: number
  round_scores: number[]
  updated_at: string
}

export interface Roster {
  id: string
  contestant_id: string
  tournament_id: string
  player_name: string
}

export interface Contestant {
  id: string
  tournament_id: string
  name: string
  handle: string
  dk_entry_id: string | null
  total_fpts: number
  rank: number | null
  created_at: string
  roster: PlayerScore[]
}

export interface Commentary {
  id: string
  tournament_id: string
  contestant_id: string
  content: string | null
  prediction: string | null
  watch_player: string | null
  trend: 'up' | 'down' | 'hold' | null
  generated_at: string | null
}

export type LeagueStandings = Contestant[]
